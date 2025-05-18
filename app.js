require('dotenv').config();
const puppeteer = require('puppeteer');
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const chatId = process.env.TELEGRAM_CHAT_ID;
const formUrl = process.env.URL_FORM;
const answer = process.env.ANSWER_COMPANY_NAME;

let browser;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: false, // visible browser for debugging; set to true for headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 },
    });
    await bot.sendMessage(chatId, "🚀 Browser launched (visible)");
  }
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    await bot.sendMessage(chatId, "🛑 Browser closed");
  }
}

async function sendMessage(msg, imagePath = null) {
  try {
    await bot.sendMessage(chatId, msg);
    if (imagePath) {
      await bot.sendPhoto(chatId, imagePath);
    }
  } catch (err) {
    console.error("Telegram Error:", err.message);
  }
}

async function waitForFormAvailability(page, inputSelector) {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      await page.goto(formUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      await page.waitForSelector(inputSelector, { timeout: 10000 });
      await sendMessage(`✅ Form is available (attempt ${attempt})`);
      return true; // form is available
    } catch (e) {
      
        // Every 10 tries, notify on Telegram to avoid spam
      await sendMessage(`⚠️ Form not available yet (attempt ${attempt}), retrying in 1 second...`);
      
      await delay(1000);
    }
  }
}

async function runBot() {
  await initBrowser();
  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/115.0 Safari/537.36'
  );

  const inputSelector = 'input[type="text"]';

  await waitForFormAvailability(page, inputSelector);

  try {
    await sendMessage("✅ Starting submission...");

    // Clear and type input slowly
    await page.focus(inputSelector);
    await page.click(inputSelector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(inputSelector, answer, { delay: 100 });

    const inputValue = await page.$eval(inputSelector, el => el.value);
    console.log('Input value after typing:', inputValue);

    // Screenshot before submit
    const beforeSubmitPath = 'before_submit.png';
    await page.screenshot({ path: beforeSubmitPath });
    await sendMessage("📸 Screenshot before submit", beforeSubmitPath);

    // Submit form
    const submitButtonSelector = 'div[role="button"]';
    try {
      await page.click(submitButtonSelector);
    } catch {
      await page.keyboard.press('Enter');
    }
    await sendMessage("🚀 Submit button clicked or Enter pressed, waiting for confirmation...");

    // Wait for confirmation or timeout
    try {
      await page.waitForFunction(() =>
        document.body.innerText.includes("Your response has been recorded"),
        { timeout: 10000 }
      );

      const successScreenshot = 'after_submit_success.png';
      await page.screenshot({ path: successScreenshot });
      await sendMessage("✅ Submission confirmed!", successScreenshot);

    } catch {
      const failureScreenshot = 'after_submit_failure.png';
      await page.screenshot({ path: failureScreenshot });

      const pageText = await page.evaluate(() => document.body.innerText);
      console.log("Submission not confirmed. Page text snapshot:\n", pageText);
      await sendMessage("⚠️ Submission NOT confirmed — check screenshot.", failureScreenshot);
    }

  } catch (err) {
    await sendMessage("❗ Error:\n" + err.message);
    console.error(err);
  } finally {
    await page.close();
  }
}

(async () => {
  try {
    await runBot();
  } catch (e) {
    console.error("Unexpected error:", e);
  } finally {
    await closeBrowser();
  }
})();
