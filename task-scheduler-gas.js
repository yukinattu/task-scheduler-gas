const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec";
const EXISTING_URLS_API = WEBHOOK_URL;
const TIKTOK_USER = "nogizaka46_official";

// ▶️ 動画URLから video ID を抽出
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
      .map(url => extractVideoId((url || "").toString().trim().replace(/\/+$/, "")))
      .filter(Boolean);
    console.log("📄 既存動画ID数:", existingVideoIds.length);
  } catch (e) {
    console.warn("⚠️ 既存URL取得失敗:", e.message);
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();
  const profileUrl = `https://www.tiktok.com/@${TIKTOK_USER}`;
  console.log(`🚀 チェック開始: ${TIKTOK_USER}`);

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" +
      (Math.floor(Math.random() * 20) + 90) + ".0.0.0 Safari/537.36"
    );

    await page.goto(profileUrl, { waitUntil: "networkidle2", timeout: 0 });
    await page.waitForTimeout(5000);

    // ✅ puzzle画面を検出（複数条件で判定）
    const isPuzzle = await page.evaluate(() => {
      return (
        document.body.innerText.includes("Verify to continue") ||
        !!document.querySelector("#captcha-container") ||
        !!document.querySelector("div[data-e2e='captcha-page']")
      );
    });

    const title = await page.title();
    if (isPuzzle || title.toLowerCase().includes("tiktok") === false) {
      const screenshotPath = `puzzle_${TIKTOK_USER}.png`;
      await page.screenshot({ path: screenshotPath });
      console.log(`📸 puzzle画面を検出・保存: ${screenshotPath}`);
      throw new Error("🚧 Bot検知によりpuzzle画面に遷移しました");
    }

    // ✅ 遅延読み込み対応スクロール
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(2000);
    }

    // ✅ 投稿リンクを取得
    await page.waitForSelector("a[href*='/video/']", { timeout: 10000 });
    const videoUrls = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href*='/video/']"))
        .map(a => a.href)
        .filter((v, i, self) => self.indexOf(v) === i);
    });

    if (!videoUrls.length) throw new Error("❌ 投稿が見つかりませんでした");

    const normalizedUrl = videoUrls[0].trim().replace(/\/+$/, "");
    const videoId = extractVideoId(normalizedUrl);
    if (!videoId) throw new Error("❌ 動画IDの抽出に失敗");

    if (existingVideoIds.includes(videoId)) {
      console.log(`⏭️ 重複スキップ: ${videoId}`);
      return;
    }

    // ✅ タイトル取得のために動画ページへ遷移
    await page.goto(normalizedUrl, { waitUntil: "networkidle2", timeout: 0 });
    await page.waitForTimeout(3000);

    const titleText = await page.evaluate(() => {
      const el = document.querySelector('[data-e2e="browse-video-desc"]');
      return el?.innerText || "(タイトル不明)";
    });

    const publishedDate = new Date().toISOString().split("T")[0];
    const data = {
      publishedDate,
      platform: "TikTok",
      channel: TIKTOK_USER,
      title: titleText,
      videoUrl: normalizedUrl
    };

    const postRes = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" }
    });

    console.log(`✅ 送信成功（${TIKTOK_USER}）:`, await postRes.text());
  } catch (e) {
    console.error(`❌ 処理失敗（${TIKTOK_USER}）:`, e.message);
  } finally {
    try {
      if (!page.isClosed()) await page.close();
    } catch (err) {
      console.warn(`⚠️ page.close() エラー: ${err.message}`);
    }

    await browser.close();
  }
})();
