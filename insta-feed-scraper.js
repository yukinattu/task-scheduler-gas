function extractPostId(url) {
  const match = url?.match(/\/p\/([\w-]+)/);
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
    existingIds = urls.map(u => extractPostId((u || "").trim())).filter(Boolean);
  } catch (e) {
    console.warn("⚠️ Feed URL取得失敗:", e.message);
  }

  for (const user of INSTAGRAM_USERS) {
    try {
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: "networkidle2", timeout: 0 });
      await page.waitForSelector("a[href^='/p/']", { timeout: 10000 });

      const postUrl = await page.evaluate(() =>
        [...document.querySelectorAll("a[href^='/p/']")][0]?.href || null
      );

      if (!postUrl) throw new Error("❌ 投稿が見つかりませんでした");
      const id = extractPostId(postUrl);
      if (!id || existingIds.includes(id)) continue;

      await page.goto(postUrl, { waitUntil: "networkidle2", timeout: 0 });
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
          platform: "Instagram Feed",
          channel: user,
          title,
          videoUrl: postUrl
        })
      });

      console.log(`✅ Feed送信成功: ${user}`);
    } catch (e) {
      console.error(`❌ Feed失敗(${user}):`, e.message);
    }
  }

  await browser.close();
})();
