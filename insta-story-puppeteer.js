const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: "new", // ✅ GitHub Actionsでは必須（GUIなし対応）
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // ✅ セキュリティサンドボックス回避
  });

  const page = await browser.newPage();

  const SESSIONID = '73295698085%3AGN9zs8UcGVCwu9%3A1%3AAYc9xaijxxpS0fqCIa7Qk6JcYRH-wKHgoW71iBsIEA';

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

  // 📡 画像・動画のリクエストを検知
  page.on('request', req => {
    const url = req.url();
    if (url.includes('cdninstagram') && /\.(jpg|jpeg|mp4|webp|png)/.test(url)) {
      console.log('📦 Found media URL:', url);
      storyRequests.push(url);
    }
  });

  await page.goto(storyUrl, { waitUntil: 'networkidle2' });

  // 🕒 ストーリー読み込み待機（描画後のXHRをキャプチャするため）
  await page.waitForTimeout(30000);

  await browser.close();

  if (storyRequests.length === 0) {
    console.log('❌ ストーリーのURLは見つかりませんでした');
  } else {
    console.log(`✅ ${storyRequests.length} 件のメディアURLを検出:`);
    storyRequests.forEach(u => console.log(u));
  }
})();
