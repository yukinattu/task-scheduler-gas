const THREADS_USERS = ["a_n_o2mass", "sayaka_okada", "seina0227"];

function extractThreadsId(url) {
  const match = url?.match(/\/post\/(\d+)/);
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
    existingIds = urls.map(u => extractThreadsId((u || "").trim())).filter(Boolean);
  } catch (e) {
    console.warn("⚠️ Threads URL取得失敗:", e.message);
  }

  for (const user of THREADS_USERS) {
    try {
      const profile = `https://www.threads.net/@${user}`;
      await page.goto(profile, { waitUntil: "networkidle2", timeout: 0 });
      await page.waitForTimeout(3000);

      const postUrl = await page.evaluate(() =>
        [...document.querySelectorAll("a[href*='/post/']")].find(a => a.href.includes("/post/"))?.href || null
      );

      if (!postUrl) throw new Error("❌ 投稿が見つかりませんでした");
      const id = extractThreadsId(postUrl);
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
          platform: "Threads",
          channel: user,
          title,
          videoUrl: postUrl
        })
      });

      console.log(`✅ Threads送信成功: ${user}`);
    } catch (e) {
      console.error(`❌ Threads失敗(${user}):`, e.message);
    }
  }

  await browser.close();
})();
