const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const fetch = (...args) => import("node-fetch").then(mod => mod.default(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec";
const EXISTING_URLS_API = WEBHOOK_URL;
const INSTAGRAM_USER = "nogizaka46_official";
const FEED_URL = `https://www.instagram.com/${INSTAGRAM_USER}/`;

function extractPostId(url) {
  const match = url?.match(/\/p\/([^/?]+)/);
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
    console.log("📄 既存Feed ID数:", existingPostIds.length);
  } catch (e) {
    console.warn("⚠️ 既存URL取得失敗:", e.message);
  }

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" +
      (Math.floor(Math.random() * 20) + 90) + ".0.0.0 Safari/537.36"
    );

    await page.goto(FEED_URL, { waitUntil: "networkidle2", timeout: 0 });
    await page.waitForTimeout(3000);

    await page.waitForSelector("article a[href*='/p/']", { timeout: 10000 });

    const postUrls = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("article a[href*='/p/']"))
        .map(a => a.href)
        .filter((v, i, self) => self.indexOf(v) === i);
    });

    if (!postUrls.length) throw new Error("❌ Feed投稿が見つかりませんでした");

    const normalizedUrl = postUrls[0].trim().replace(/\/+$/, "");
    const postId = extractPostId(normalizedUrl);
    if (!postId) throw new Error("❌ Feed IDの抽出失敗");

    if (existingPostIds.includes(postId)) {
      console.log(`⏭️ 重複スキップ: ${postId}`);
      return;
    }

    await page.goto(normalizedUrl, { waitUntil: "networkidle2", timeout: 0 });
    await page.waitForTimeout(3000);

    const titleText = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:title"]');
      return meta?.content || "(タイトル不明)";
    });

    const publishedDate = new Date().toISOString().split("T")[0];
    const data = {
      publishedDate,
      platform: "Instagram Feed",
      channel: INSTAGRAM_USER,
      title: titleText,
      videoUrl: normalizedUrl
    };

    const postRes = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" }
    });

    console.log(`✅ 送信成功:`, await postRes.text());
  } catch (e) {
    console.error(`❌ 処理失敗:`, e.message);
  } finally {
    try {
      if (!page.isClosed()) await page.close();
    } catch (err) {
      console.warn(`⚠️ page.close() エラー: ${err.message}`);
    }
    await browser.close();
  }
})();
