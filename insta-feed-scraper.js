const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/XXXXXXXXXXXX/exec";
const USERS = ["nogizaka46_official", "a_n_o2mass", "yasu.ryu9chakra", "takato_fs"];

function extractPostId(url) {
  const match = url?.match(/\/p\/([\w-]+)/);
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
      const profile = `https://www.instagram.com/${user}/`;
      await page.goto(profile, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(3000);
      const postUrl = await page.evaluate(() => {
        const a = document.querySelector("a[href^='/p/']");
        return a ? "https://www.instagram.com" + a.getAttribute("href") : null;
      });

      if (!postUrl) throw new Error("投稿なし");
      const postId = extractPostId(postUrl);
      if (!postId || existingIds.includes(postId)) continue;

      await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(3000);
      const title = await page.evaluate(() =>
        document.querySelector("meta[property='og:title']")?.content || document.title
      );

      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishedDate: new Date().toISOString().split("T")[0],
          platform: "Instagram Feed",
          channel: user,
          title,
          videoUrl: postUrl
        })
      });

      console.log(`✅ Feed送信: ${user}`);
    } catch (e) {
      console.error(`❌ Feed失敗: ${user}`, e.message);
    }
  }

  await browser.close();
})();
