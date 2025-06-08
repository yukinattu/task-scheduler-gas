const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/XXXXXXXXXXXX/exec";  // ←あなたのGAS Webhookに置換
const INSTAGRAM_USERS = ["nogizaka46_official", "a_n_o2mass", "yasu.ryu9chakra", "takato_fs"];

function extractReelId(url) {
  const match = url?.match(/\/reel\/([\w-]+)/);
  return match ? match[1] : null;
}

(async () => {
  const res = await fetch(WEBHOOK_URL);
  const urls = await res.json();
  const existingIds = urls.map(u => extractReelId(u)).filter(Boolean);

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 ... Chrome/114 Safari/537.36");

  for (const user of INSTAGRAM_USERS) {
    const profileUrl = `https://www.instagram.com/${user}/reels/`;
    console.log(`🚀 Reelsチェック開始: ${user}`);

    try {
      await page.goto(profileUrl, { waitUntil: "networkidle2", timeout: 60000 });
      await page.waitForTimeout(4000);

      const videoUrl = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a[href*='/reel/']"));
        return anchors.length > 0 ? "https://www.instagram.com" + anchors[0].getAttribute("href") : null;
      });

      if (!videoUrl) throw new Error("❌ リール投稿が見つかりませんでした");

      const normalizedUrl = videoUrl.trim().replace(/\/+$/, "");
      const reelId = extractReelId(normalizedUrl);
      if (!reelId || existingIds.includes(reelId)) {
        console.log(`⏭️ 重複リールスキップ: ${reelId}`);
        continue;
      }

      await page.goto(normalizedUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(3000);

      const title = await page.evaluate(() =>
        document.querySelector("meta[property='og:title']")?.content ||
        document.querySelector("meta[property='og:description']")?.content ||
        document.title ||
        "(タイトル不明)"
      );

      const payload = {
        publishedDate: new Date().toISOString().split("T")[0],
        platform: "Instagram Reels",
        channel: user,
        title,
        videoUrl: normalizedUrl
      };

      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log(`✅ Reels送信成功: ${user}`);
    } catch (e) {
      console.error(`❌ Reels失敗（${user}）:`, e.message);
    }
  }

  await browser.close();
})();
