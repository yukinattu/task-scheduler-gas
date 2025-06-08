const INSTAGRAM_USERS = ["nogizaka46_official", "a_n_o2mass", "yasu.ryu9chakra", "takato_fs"];

function extractReelId(url) {
  const match = url?.match(/\/reel\/([\w-]+)/);
  return match ? match[1] : null;
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);

  let existingIds = [];
  try {
    const res = await fetch(EXISTING_URLS_API);
    const urls = await res.json();
    existingIds = urls.map(u => extractReelId((u || "").trim())).filter(Boolean);
  } catch (e) {
    console.warn("⚠️ Reels URL取得失敗:", e.message);
  }

  for (const user of INSTAGRAM_USERS) {
    try {
      await page.goto(`https://www.instagram.com/${user}/reels/`, { waitUntil: "networkidle2", timeout: 0 });
      await page.waitForSelector("a[href*='/reel/']", { timeout: 10000 });

      const videoUrl = await page.evaluate(() =>
        [...document.querySelectorAll("a[href*='/reel/']")][0]?.href || null
      );

      if (!videoUrl) throw new Error("❌ Reelsが見つかりませんでした");
      const id = extractReelId(videoUrl);
      if (!id || existingIds.includes(id)) continue;

      await page.goto(videoUrl, { waitUntil: "networkidle2", timeout: 0 });
      await page.waitForTimeout(2000);

      const title = await page.evaluate(() =>
        document.querySelector("meta[property='og:title']")?.content ||
        document.querySelector("meta[property='og:description']")?.content ||
        "(タイトル不明)"
      );

      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishedDate: new Date().toISOString().split("T")[0],
          platform: "Instagram Reels",
          channel: user,
          title,
          videoUrl
        })
      });

      console.log(`✅ Reels送信成功: ${user}`);
    } catch (e) {
      console.error(`❌ Reels失敗(${user}):`, e.message);
    }
  }

  await browser.close();
})();
