const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec";
const EXISTING_URLS_API = WEBHOOK_URL;

const TIKTOK_USERS = [
  "nogizaka46_official",
  "kurumin0726",
  "anovamos",
  "minami.0819",
  "ibu.x.u"
];

function extractVideoId(url) {
  const match = url?.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

(async () => {
  let existingVideoIds = [];
  try {
    const res = await fetch(EXISTING_URLS_API);
    const urls = await res.json();
    existingVideoIds = urls
      .map(url => extractVideoId((url || "").trim().replace(/\/+$/, "")))
      .filter(Boolean);
    console.log("📄 既存動画ID数:", existingVideoIds.length);
  } catch (e) {
    console.warn("⚠️ 既存URL取得失敗:", e.message);
  }

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

  for (const user of TIKTOK_USERS) {
    const profileUrl = `https://www.tiktok.com/@${user}`;
    console.log(`🚀 チェック開始: ${user}`);
    try {
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 0 });
      await page.waitForTimeout(4000);

      // ⬇️ 複数の動画リンクを抽出して最初の1件を取得
      const videoUrls = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a[href*='/video/']"));
        return anchors.map(a => a.href.trim().replace(/\/+$/, ""));
      });

      if (!videoUrls.length) throw new Error("❌ 動画が見つかりませんでした");

      const latestUrl = videoUrls[0];
      const videoId = extractVideoId(latestUrl);
      if (!videoId || existingVideoIds.includes(videoId)) {
        console.log(`⏭️ スキップ: ${videoId}`);
        continue;
      }

      // ▶ 動画ページへ遷移しタイトル取得
      await page.goto(latestUrl, { waitUntil: "domcontentloaded", timeout: 0 });
      await page.waitForTimeout(3000);

      const title = await page.evaluate(() => {
        return document.querySelector('[data-e2e="browse-video-desc"]')?.innerText || "(タイトル不明)";
      });

      const data = {
        publishedDate: new Date().toISOString().split("T")[0],
        platform: "TikTok",
        channel: user,
        title,
        videoUrl: latestUrl
      };

      const postRes = await fetch(WEBHOOK_URL, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });

      console.log(`✅ 送信成功（${user}）:`, await postRes.text());
    } catch (e) {
      console.error(`❌ 処理失敗（${user}）:`, e.message);
    }
  }

  await browser.close();
})();
