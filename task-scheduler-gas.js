const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwoxLcJd6rVKXX8lk6c1uhIo4puPJHMbTZwhpq2L1IMfK1mm07QNhyUYOyg-lK4e1Y8/exec";
const EXISTING_URLS_API = WEBHOOK_URL;
const TIKTOK_USERS = ["nogizaka46_official", "kurumin0726"]; // 複数アカウント対応

(async () => {
  // ✅ 既存URL一覧を取得
  let existingUrls = [];
  try {
    const res = await fetch(EXISTING_URLS_API);
    existingUrls = await res.json();
    console.log("📄 既存URL数:", existingUrls.length);
  } catch (e) {
    console.warn("⚠️ 既存URL取得失敗:", e.message);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36"
  );

  for (const TIKTOK_USER of TIKTOK_USERS) {
    const url = `https://www.tiktok.com/@${TIKTOK_USER}`;
    console.log(`🚀 チェック開始: ${TIKTOK_USER}`);

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
      await new Promise(resolve => setTimeout(resolve, 5000));
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise(resolve => setTimeout(resolve, 2000));

      const videoElements = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a[href*='/video/']"));
        if (anchors.length === 0) return null;
        return {
          videoUrl: anchors[0].href,
          title: anchors[0].innerText || "(タイトル不明)"
        };
      });

      if (!videoElements) throw new Error("❌ 投稿が見つかりませんでした");

      // ✅ 重複チェック
      if (existingUrls.includes(videoElements.videoUrl)) {
        console.log(`⏭️ 重複スキップ: ${videoElements.videoUrl}`);
        continue;
      }

      const publishedDate = new Date().toISOString().split("T")[0];
      const data = {
        publishedDate,
        platform: "TikTok",
        channel: TIKTOK_USER,
        title: videoElements.title,
        videoUrl: videoElements.videoUrl
      };

      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });

      console.log(`✅ 送信成功（${TIKTOK_USER}）:`, await res.text());
    } catch (e) {
      console.error(`❌ 処理失敗（${TIKTOK_USER}）:`, e.message);
    }
  }

  await browser.close();
})();
