const TIKTOK_USERS = ["nogizaka46_official", "kurumin0726", "anovamos", "minami.0819", "ibu.x.u"];

function extractVideoId(url) {
  const match = url?.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);

  let existingVideoIds = [];
  try {
    const res = await fetch(EXISTING_URLS_API);
    const urls = await res.json();
    existingVideoIds = urls.map(u => extractVideoId((u || "").trim())).filter(Boolean);
  } catch (e) {
    console.warn("⚠️ 既存URL取得失敗:", e.message);
  }

  for (const user of TIKTOK_USERS) {
    try {
      const profile = `https://www.tiktok.com/@${user}`;
      await page.goto(profile, { waitUntil: "networkidle2", timeout: 0 });
      await page.waitForTimeout(3000);

      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(1000);
      }

      const videoUrl = await page.evaluate(() => {
        const anchors = [...document.querySelectorAll("a[href*='/video/']")];
        return anchors.length ? anchors[0].href : null;
      });

      if (!videoUrl) throw new Error("❌ 動画が見つかりませんでした");
      const id = extractVideoId(videoUrl);
      if (!id || existingVideoIds.includes(id)) continue;

      await page.goto(videoUrl, { waitUntil: "networkidle2", timeout: 0 });
      await page.waitForTimeout(2000);

      const title = await page.evaluate(() =>
        document.querySelector('[data-e2e="browse-video-desc"]')?.innerText || document.title || "(タイトル不明)"
      );

      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishedDate: new Date().toISOString().split("T")[0],
          platform: "TikTok",
          channel: user,
          title,
          videoUrl
        })
      });

      console.log(`✅ TikTok送信成功: ${user}`);
    } catch (e) {
      console.error(`❌ TikTok処理失敗(${user}):`, e.message);
    }
  }

  await browser.close();
})();
