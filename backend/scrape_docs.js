const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://api-docs.serpstat.com/docs/serpstat-public-api/fbbvt84sg54bg-rank-tracker-api', { waitUntil: 'load' });
    await page.waitForTimeout(5000);

    const html = await page.content();
    const textMatches = Array.from(html.matchAll(/"title":"([^"]+)"/g)).map(m => m[1]);
    console.log('Titles found built in JSON data:', [...new Set(textMatches)]);

    await browser.close();
})();
