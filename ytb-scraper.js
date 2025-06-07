// ✅ Node.js - YouTube動画取得 + GAS連携（GitHub Actions用）
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyUYFIXRDjTnidH5ZGeI-39BqlwsMuxELhV_XnBlqGTN_J1Vz--gl5Wr3mNBlaM79U1/exec";
const EXISTING_URLS_API = WEBHOOK_URL;
const YOUTUBE_CHANNELS = [
  "https://www.youtube.com/@soshina",       // 粗品
  "https://www.youtube.com/@KYOUPOKE"       // 今日ポケ
  // 他にも追加可能
];

function extractVideoId(url) {
  const match = url?.match(/[?&]v=([\w-]{11})|\/shorts\/([\w-]{11})|\/watch\?v=([\w-]{11})/);
  return match ? (match[1] || match[2] || match[3]) : null;
}

(async () => {
  let existingVideoIds = [];
  try {
    const res = await fetch(EXISTING_URLS_API);
    const urls = await res.json();
    existingVideoIds = urls
      .map(url => extractVideoId(url?.toString().trim()))
      .filter(Boolean);
    console.log("📄 既存動画ID数:", existingVideoIds.length);
  } catch (e) {
    console.warn("⚠️ 既存URL取得失敗:", e.message);
  }

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36");

  for (const channelUrl of YOUTUBE_CHANNELS) {
    console.log(`🚀 チェック開始: ${channelUrl}`);
    try {
      await page.goto(`${channelUrl}/videos`, { waitUntil: "networkidle2", timeout: 0 });
      await page.waitForTimeout(3000);

      const result = await page.evaluate(() => {
        const videoLink = document.querySelector("a#video-title");
        const href = videoLink?.href;
        const title = videoLink?.textContent?.trim();
        return href && title ? { videoUrl: href, title } : null;
      });

      if (!result) throw new Error("❌ 投稿が見つかりませんでした");

      const normalizedUrl = result.videoUrl.trim();
      const videoId = extractVideoId(normalizedUrl);
      if (!videoId || existingVideoIds.includes(videoId)) {
        console.log(`⏭️ 重複スキップ: ${videoId}`);
        continue;
      }

      const platform = normalizedUrl.includes("/shorts/") ? "YouTube Shorts" : "YouTube";
      const publishedDate = new Date().toISOString().split("T")[0];
      const data = {
        publishedDate,
        platform,
        channel: channelUrl.split("/").pop(),
        title: result.title,
        videoUrl: normalizedUrl
      };

      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });

      console.log(`✅ 送信成功: ${result.title}（${platform}）`);
    } catch (e) {
      console.error(`❌ 処理失敗（${channelUrl}）:`, e.message);
    }
  }

  await browser.close();
})();
