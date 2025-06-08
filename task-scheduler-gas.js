const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/XXXXXXXXXXXX/exec";
const TIKTOK_USERS = ["nogizaka46_official", "kurumin0726", "anovamos", "ibu.x.u"];

function extractVideoId(url) {
  const match = url?.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

(async () => {
  const res = await fetch(WEBHOOK_URL);
  const urls = await res.json();
  const existingIds = urls.map(u => extractVideoId(u)).filter(Boolean);

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 ... Chrome/114 Safari/537.36");

  for (const user of TIKTOK_USERS) {
    try {
      const profileUrl = `https://www.tiktok.com/@${user}`;
      await page.goto(profileUrl, { waitUntil: "networkidle2", timeout: 60000 });
      await page.waitForTimeout(3000);
      await page.evaluate(() => window.scrollBy(0, 1000));

      const videoUrl = await page.evaluate(() => {
        const a = document.querySelector("a[href*='/video/']");
        return a?.href || null;
      });

      if (!videoUrl) throw new Error("動画リンクなし");
      const videoId = extractVideoId(videoUrl);
      if (!videoId || existingIds.includes(videoId)) continue;

      await page.goto(videoUrl, { waitUntil: "networkidle2", timeout: 60000 });
      await page.waitForTimeout(3000);
      const title = await page.evaluate(() =>
        document.querySelector('[data-e2e="browse-video-desc"]')?.innerText || document.title
      );

      const payload = {
        publishedDate: new Date().toISOString().split("T")[0],
        platform: "TikTok",
        channel: user,
        title,
        videoUrl
      };

      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log(`✅ TikTok送信: ${user}`);
    } catch (e) {
      console.error(`❌ TikTok失敗: ${user}`, e.message);
    }
  }

  await browser.close();
})();
