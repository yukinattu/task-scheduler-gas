const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec";
const EXISTING_URLS_API = WEBHOOK_URL;
const INSTAGRAM_USERS = ["nogizaka46_official", "yasu.ryu9chakra"];

function extractVideoId(url) {
  const match = url?.match(/\/reel\/([\w-]+)/);
  return match ? match[1] : null;
}

(async () => {
  let existingVideoIds = [];

  try {
    const res = await fetch(EXISTING_URLS_API);
    const urls = await res.json();
    existingVideoIds = urls
      .map(url => extractVideoId((url || "").toString().trim().replace(/\/+$/, "")))
      .filter(Boolean);
    console.log("📄 既存動画ID数:", existingVideoIds.length);
  } catch (e) {
    console.warn("⚠️ 既存URL取得失敗:", e.message);
  }

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36");

  for (const user of INSTAGRAM_USERS) {
    const profileUrl = `https://www.instagram.com/${user}/reels/`;
    console.log(`🚀 チェック開始: ${user}`);

    try {
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 0 });

      let videoUrl = null;

      // 最大3回スクロールしてリールリンクを探索
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(1000);

        videoUrl = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll("a[href*='/reel/']"));
          return anchors.length > 0 ? anchors[0].href : null;
        });

        if (videoUrl) break;
      }

      if (!videoUrl) throw new Error("❌ リールが見つかりませんでした");

      const normalizedUrl = videoUrl.trim().replace(/\/+$/, "");
      const videoId = extractVideoId(normalizedUrl);

      if (!videoId) throw new Error("❌ 動画ID抽出失敗");
      if (existingVideoIds.includes(videoId)) {
        console.log(`⏭️ 重複スキップ: ${videoId}`);
        continue;
      }

      await page.goto(normalizedUrl, { waitUntil: "domcontentloaded", timeout: 0 });
      await page.waitForTimeout(3000);

      const title = await page.evaluate(() => {
        const ogTitle = document.querySelector("meta[property='og:title']");
        const ogDesc = document.querySelector("meta[property='og:description']");
        return ogTitle?.content || ogDesc?.content || "(タイトル不明)";
      });

      const publishedDate = new Date().toISOString().split("T")[0];

      const data = {
        publishedDate,
        platform: "Instagram Reels",
        channel: user,
        title,
        videoUrl: normalizedUrl
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
