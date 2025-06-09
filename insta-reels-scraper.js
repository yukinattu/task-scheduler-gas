const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec";
const EXISTING_URLS_API = WEBHOOK_URL;
const INSTAGRAM_USER = "nogizaka46_official";
const REELS_URL = `https://www.instagram.com/${INSTAGRAM_USER}/reels/`;

// ⬇️ InstagramのログインセッションID
const INSTAGRAM_SESSIONID = "7132102982%3A1woRTzWRC3s791%3A3%3AAYdQb3HrbWt5FawavmpEQMhXmDSNEtHCycciSK286w";

function extractVideoId(url) {
  const match = url?.match(/\/reel\/([^/?]+)/);
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
    console.log("📄 既存Reel ID数:", existingVideoIds.length);
  } catch (e) {
    console.warn("⚠️ 既存URL取得失敗:", e.message);
  }

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();

  try {
    // ✅ セッションCookieのセット
    await page.setCookie({
      name: "sessionid",
      value: INSTAGRAM_SESSIONID,
      domain: ".instagram.com",
      path: "/",
      httpOnly: true,
      secure: true
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" +
      (Math.floor(Math.random() * 20) + 90) + ".0.0.0 Safari/537.36"
    );

    await page.goto(REELS_URL, { waitUntil: "networkidle2", timeout: 0 });
    await page.waitForTimeout(5000);

    const isBlocked = await page.evaluate(() => {
      return document.body.innerText.includes("ログイン") || document.querySelector("form input[name='username']") !== null;
    });
    if (isBlocked) throw new Error("❌ InstagramによるBot検知またはログインスクリーン表示");

    await page.waitForSelector("a[href*='/reel/']", { timeout: 10000 });

    const reelUrls = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href*='/reel/']"))
        .map(a => a.href)
        .filter((v, i, self) => self.indexOf(v) === i);
    });

    if (!reelUrls.length) throw new Error("❌ Reelsが見つかりませんでした");

    const normalizedUrl = reelUrls[0].trim().replace(/\/+$/, "");
    const videoId = extractVideoId(normalizedUrl);
    if (!videoId) throw new Error("❌ Reel IDの抽出失敗");

    if (existingVideoIds.includes(videoId)) {
      console.log(`⏭️ 重複スキップ: ${videoId}`);
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
      platform: "Instagram Reels",
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
