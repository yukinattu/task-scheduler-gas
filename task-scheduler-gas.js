const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwoxLcJd6rVKXX8lk6c1uhIo4puPJHMbTZwhpq2L1IMfK1mm07QNhyUYOyg-lK4e1Y8/exec";
const EXISTING_URLS_API = WEBHOOK_URL;
const TIKTOK_USERS = ["nogizaka46_official", "kurumin0726"];

function extractVideoId(url) {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

(async () => {
  // ✅ 既存URL一覧を取得
  let existingVideoIds = [];
  try {
    const res = await fetch(EXISTING_URLS_API);
    const urls = await res.json();
    existingVideoIds = urls
      .map(url => extractVideoId(url))
      .filter(Boolean);
    console.log("📄 既存動画ID数:", existingVideoIds.length);
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

      const videoUrl = await page.evaluate(() => {
        const anchor = document.querySelector("a[href*='/video/']");
        return anchor ? anchor.href : null;
      });

      if (!videoUrl) throw new Error("❌ 投稿が見つかりませんでした");

      const videoId = extractVideoId(videoUrl);
      if (!videoId) throw new Error("❌ 動画IDの抽出に失敗");

      if (existingVideoIds.includes(videoId)) {
        console.log(`⏭️ 重複スキップ: ${videoId}`);
        continue;
      }

      // ▶ タイトル取得のため動画ページに遷移
      await page.goto(videoUrl, { waitUntil: "networkidle2", timeout: 0 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      const title = await page.evaluate(() => {
        const el = document.querySelector('[data-e2e="browse-video-desc"]');
        return el?.innerText || "(タイトル不明)";
      });

      const publishedDate = new Date().toISOString().split("T")[0];
      const data = {
        publishedDate,
        platform: "TikTok",
        channel: TIKTOK_USER,
        title,
        videoUrl: videoUrl.trim().replace(/\/$/, '') // 末尾スラッシュ除去
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
