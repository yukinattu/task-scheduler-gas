const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // ← ストーリー描画のため「非headless」に
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();

  const SESSIONID = '73295698085%3AGN9zs8UcGVCwu9%3A1%3AAYc9xaijxxpS0fqCIa7Qk6JcYRH-wKHgoW71iBsIEA'; // InstagramのセッションIDを貼る

  await page.setCookie({
    name: 'sessionid',
    value: SESSIONID,
    domain: '.instagram.com',
    path: '/',
    httpOnly: true,
    secure: true
  });

  const username = 'a_n_o2mass';
  const storyUrl = `https://www.instagram.com/stories/${username}/`;

  const storyRequests = [];

  page.on('request', req => {
    const url = req.url();
    if (url.includes('cdninstagram') && /\.(jpg|jpeg|mp4|webp|png)/.test(url)) {
      console.log('📦 Found media URL:', url);
      storyRequests.push(url);
    }
  });

  await page.goto(storyUrl, { waitUntil: 'networkidle2' });

  // ストーリー描画が安定するまで待機
  await page.waitForTimeout(30000); // 30秒程度（必要に応じて）

  await browser.close();

  if (storyRequests.length === 0) {
    console.log('❌ ストーリーのURLは見つかりませんでした');
  } else {
    console.log(`✅ ${storyRequests.length} 件のメディアURLを検出:`);
    storyRequests.forEach(u => console.log(u));
  }
})();
