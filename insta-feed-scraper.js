const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec";
const EXISTING_URLS_API = WEBHOOK_URL;
const INSTAGRAM_USERS = ["nogizaka46_official", "a_n_o2mass", "yasu.ryu9chakra"];

// ▶️ 投稿URLからID抽出（投稿ID）
function extractPostId(url) {
  const match = url?.match(/\/p\/([\w-]+)/);
  return match ? match[1] : null;
}

(async () => {
  let existingPostIds = [];

  try {
    const res = await fetch(EXISTING_URLS_API);
    const urls = await res.json();
    existingPostIds = urls
      .map(url => extractPostId((url || "").toString().trim().replace(/\/+$/, "")))
      .filter(Boolean);
    console.log("📄 既存投稿ID数:", existingPostIds.length);
  } catch (e) {
    console.warn("⚠️ 既存URL取得失敗:", e.message);
  }

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36");

  for (const user of INSTAGRAM_USERS) {
    const profileUrl = `https://www.instagram.com/${user}/`;

    console.log(`🚀 チェック開始: ${user}`);

    try {
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 0 });
      await page.waitForTimeout(5000);

      const postUrl = await page.evaluate(() => {
        const anchor = document.querySelector("article a[href*='/p/']");
        return anchor ? anchor.href : null;
      });

      if (!postUrl) throw new Error("❌ 投稿が見つかりませんでした");

      const normalizedUrl = postUrl.trim().replace(/\/+$/, "");
      const postId = extractPostId(normalizedUrl);

      if (!postId) throw new Error("❌ 投稿ID抽出失敗");
      if (existingPostIds.includes(postId)) {
        console.log(`⏭️ 重複スキップ: ${postId}`);
        continue;
      }

      await page.goto(normalizedUrl, { waitUntil: "domcontentloaded", timeout: 0 });
      await page.waitForTimeout(3000);

      const title = await page.evaluate(() => {
        const meta = document.querySelector("meta[property='og:title']");
        return meta?.content || "(タイトル不明)";
      });

      const publishedDate = new Date().toISOString().split("T")[0];

      const data = {
        publishedDate,
        platform: "Instagram Feed",
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
