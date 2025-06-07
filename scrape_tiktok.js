const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/1Up9RPWZuyz8CXqRhidQhd6bjb-iHXTGXS3jsaDBabAU/exec";
const TIKTOK_USER = "nogizaka46_official";

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']  // ← sandbox回避オプションを追加
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36"
  );

  const url = `https://www.tiktok.com/@${TIKTOK_USER}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  await new Promise(resolve => setTimeout(resolve, 5000));
  await page.evaluate(() => window.scrollBy(0, 1000));
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const videoElements = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href*='/video/']"));
      if (anchors.length === 0) return null;
      return {
        videoUrl: anchors[0].href,
        title: anchors[0].innerText || "(タイトル不明)"
      };
    });

    if (!videoElements) throw new Error("❌ 投稿が見つかりませんでした");

    const publishedDate = new Date().toISOString().split("T")[0];
    const data = {
      publishedDate,
      platform: "TikTok",
      channel: TIKTOK_USER,
      title: videoElements.title,
      videoUrl: videoElements.videoUrl
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" }
    });

    console.log("✅ 投稿送信完了:", await res.text());
  } catch (e) {
    console.error("❌ 投稿取得失敗:", e.message);
  }

  await browser.close();
})();
