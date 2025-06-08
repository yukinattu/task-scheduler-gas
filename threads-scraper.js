const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/XXXXXXXXXXXX/exec";
const USERS = ["a_n_o2mass", "sayaka_okada", "seina0227"];

function extractPostId(url) {
  const match = url?.match(/\/(\d{19})$/);
  return match ? match[1] : null;
}

(async () => {
  const res = await fetch(WEBHOOK_URL);
  const urls = await res.json();
  const existingIds = urls.map(u => extractPostId(u)).filter(Boolean);

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 ... Chrome/114 Safari/537.36");

  for (const user of USERS) {
    try {
      const profileUrl = `https://www.threads.net/@${user}`;
      await page.goto(profileUrl, { waitUntil: "networkidle2", timeout: 60000 });
      await page.waitForTimeout(4000);

      const postUrl = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a[href*='/']"));
        return anchors.map(a => a.href).find(h => /\d{19}$/.test(h)) || null;
      });

      if (!postUrl) throw new Error("投稿が見つかりませんでした");
      const postId = extractPostId(postUrl);
      if (!postId || existingIds.includes(postId)) continue;

      await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2000);
      const title = await page.evaluate(() =>
        document.querySelector("meta[property='og:title']")?.content || document.title
      );

      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishedDate: new Date().toISOString().split("T")[0],
          platform: "Threads",
          channel: user,
          title,
          videoUrl: postUrl
        })
      });

      console.log(`✅ Threads送信: ${user}`);
    } catch (e) {
      console.error(`❌ Threads失敗: ${user}`, e.message);
    }
  }

  await browser.close();
})();
