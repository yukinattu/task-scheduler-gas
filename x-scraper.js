const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec";
const EXISTING_URLS_API = WEBHOOK_URL;
const X_USERS = ["aNo2mass", "miyu_honda1", "nogizaka46", "ABEMA", "annkw5tyb", "hirox246"];

// ▶️ 投稿URLから19桁のTweet IDを抽出
function extractPostId(url) {
  const match = url?.match(/\/status\/(\d{19})/);
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

  for (const user of X_USERS) {
    const profileUrl = `https://x.com/${user}`;
    console.log(`🚀 チェック開始: ${user}`);

    try {
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 0 });
      await page.waitForTimeout(5000);

      // ▶️ 投稿リンクを抽出（/status/19桁ID）
      const postUrl = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        const valid = anchors.map(a => a.href).find(h => /\/status\/\d{19}/.test(h));
        return valid || null;
      });

      if (!postUrl) throw new Error("❌ 投稿が見つかりませんでした");

      const normalizedUrl = postUrl.trim().replace(/\/+$/, "");
      const postId = extractPostId(normalizedUrl);

      if (!postId) throw new Error("❌ 投稿ID抽出失敗");
      if (existingPostIds.includes(postId)) {
        console.log(`⏭️ 重複スキップ: ${postId}`);
        continue;
      }

      // ▶️ 投稿詳細ページへ遷移
      await page.goto(normalizedUrl, { waitUntil: "domcontentloaded", timeout: 0 });
      await page.waitForTimeout(3000);

      // ▶️ 本文の1行目をタイトルとして抽出
      const title = await page.evaluate(() => {
        const tweetText = document.querySelector('div[data-testid="tweetText"]');
        return tweetText?.innerText?.split("\n")[0]?.trim() || "(本文不明)";
      });

      const publishedDate = new Date().toISOString().split("T")[0];
      const data = {
        publishedDate,
        platform: "X",
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
