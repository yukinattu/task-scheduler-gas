const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec";
  // ← 自分のWebhookに戻す
const TIKTOK_USERS = ["nogizaka46_official", "kurumin0726", "anovamos"];

function extractVideoId(url) {
  const match = url?.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

(async () => {
  let existingVideoIds = [];
  try {
    const res = await fetch(WEBHOOK_URL);
    const urls = await res.json(); // ← ここがinvalid-jsonの場合、GAS側のレスポンス形式ミス
    existingVideoIds = urls.map(url => extractVideoId(url)).filter(Boolean);
  } catch (e) {
    console.error("⚠️ 既存URL取得失敗:", e.message);
  }

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)...");

  for (const user of TIKTOK_USERS) {
    const profileUrl = `https://www.tiktok.com/@${user}`;
    try {
      await page.goto(profileUrl, { waitUntil: "networkidle2" });
      await page.waitForTimeout(3000);

      const videoUrl = await page.evaluate(() => {
        const a = document.querySelector("a[href*='/video/']");
        return a?.href || null;
      });

      if (!videoUrl) continue;
      const videoId = extractVideoId(videoUrl);
      if (!videoId || existingVideoIds.includes(videoId)) continue;

      await page.goto(videoUrl, { waitUntil: "networkidle2" });
      await page.waitForTimeout(2000);
      const title = await page.evaluate(() => {
        return document.querySelector('[data-e2e="browse-video-desc"]')?.innerText || "(タイトル不明)";
      });

      const data = {
        publishedDate: new Date().toISOString().split("T")[0],
        platform: "TikTok",
        channel: user,
        title,
        videoUrl
      };

      await fetch(WEBHOOK_URL, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });

      console.log(`✅ 送信完了：${user}`);
    } catch (e) {
      console.error(`❌ 処理失敗（${user}）: ${e.message}`);
    }
  }

  await browser.close();
})();
