const puppeteer = require('puppeteer');
const axios = require('axios');

const FORM_URL = '';
const COMPANY_NAME = '';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

const sendTelegram = async (message) => {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      }
    );
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
  }
};

(async () => {
  await sendTelegram('🤖 Bot started at 07:55 Cairo time. Trying every second...');

  const deadline = new Date();
  deadline.setUTCHours(6, 5, 0, 0); // 08:05 Cairo = 06:05 UTC

  let success = false;

  while (new Date() < deadline) {
    try {
      const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.goto(FORM_URL, { waitUntil: 'networkidle2' });

      const inputs = await page.$$('input.whsOnd');
      if (!inputs[0]) {
        throw new Error('❌ Input field not found');
      }

      await inputs[0].type(COMPANY_NAME);
      await Promise.all([
        page.click('div[role=button][jsname="M2UYVd"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);

      const confirm = await page.$('div.freebirdFormviewerViewResponseConfirmationMessage');
      const screenshot = await page.screenshot({ fullPage: true });

      if (confirm) {
        await sendTelegram('✅ Form submitted successfully! Sending screenshot...');
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
          {
            chat_id: TELEGRAM_CHAT_ID,
            caption: '📝 Submission Screenshot',
            photo: screenshot
          },
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        await browser.close();
        success = true;
        break;
      } else {
        await sendTelegram('⚠️ Tried but confirmation not found. Retrying...');
        await browser.close();
      }

    } catch (error) {
      await sendTelegram(`🚨 Error: ${error.message}`);
      console.error(error);
    }

    await new Promise(res => setTimeout(res, 1000)); // wait 1 sec
  }

  if (!success) {
    await sendTelegram('⏰ Gave up after 10 minutes (until 08:05 Cairo). No confirmation received.');
  }

})();
