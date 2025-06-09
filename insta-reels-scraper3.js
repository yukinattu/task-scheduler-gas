const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEBHOOK";
const EXISTING_URLS_API = WEBHOOK_URL;
const INSTAGRAM_USER = "a_n_o2mass";

const REELS_URL = `https://www.instagram.com/${INSTAGRAM_USER}/reels/`;
const FEED_URL = `https://www.instagram.com/${INSTAGRAM_USER}/`;
const STORY_URL = `https://www.instagram.com/stories/${INSTAGRAM_USER}/`;
const THREADS_URL = `https://www.threads.net/@${INSTAGRAM_USER}`;

const INSTAGRAM_SESSIONID = "YOUR_INSTAGRAM_SESSION_ID";

function extractId(url, type) {
  const match = url?.match(type === 'reel' ? /\/reel\/([^/?]+)/ : /\/p\/([^/?]+)/);
  return match ? match[1] : null;
}

async function scrapeAndPost(page, url, type, existingIds) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
  await page.waitForTimeout(5000);

  const selector = `a[href*='/${type}/']`;
  await page.waitForSelector(selector, { timeout: 10000 });

  const postUrls = await page.evaluate((type) => {
    return Array.from(document.querySelectorAll(`a[href*='/${type}/']`))
      .map(a => a.href)
      .filter((v, i, self) => self.indexOf(v) === i);
  }, type);

  if (!postUrls.length) throw new Error(`❌ ${type}が見つかりませんでした`);

  const normalizedUrl = postUrls[0].trim().replace(/\/+\$/, "");
  const id = extractId(normalizedUrl, type);
  if (!id) throw new Error(`❌ ${type} IDの抽出失敗`);

  if (existingIds.includes(id)) {
    console.log(`⏭️ 重複スキップ: ${id}`);
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
    platform: type === "reel" ? "Instagram Reels" : "Instagram Feed",
    channel: INSTAGRAM_USER,
    title: titleText,
    videoUrl: normalizedUrl
  };

  const postRes = await fetch(WEBHOOK_URL, {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" }
  });

  console.log(`✅ 送信成功 (${type}):`, await postRes.text());
}

async function checkAndPostStory(page) {
  try {
    await page.goto(STORY_URL, { waitUntil: "networkidle2", timeout: 0 });
    await page.waitForTimeout(5000);

    const isUnavailable = await page.evaluate(() =>
      document.body.innerText.includes("This story is unavailable")
    );

    if (!isUnavailable) {
      const publishedDate = new Date().toISOString().split("T")[0];
      const data = {
        publishedDate,
        platform: "Instagram Story",
        channel: INSTAGRAM_USER,
        title: "",
        videoUrl: ""
      };

      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });

      console.log(`✅ Story 送信成功:`, await res.text());
    } else {
      console.log("⏭️ ストーリーは現在投稿されていません");
    }
  } catch (e) {
    console.warn("⚠️ ストーリーチェック失敗:", e.message);
  }
}

async function scrapeThreads(page) {
  try {
    await page.goto(THREADS_URL, { waitUntil: "networkidle2", timeout: 0 });
    await page.waitForTimeout(5000);

    const threadContent = await page.evaluate(() => {
      const post = document.querySelector("article div[dir='auto']");
      return post?.innerText || "";
    });

    if (threadContent) {
      const publishedDate = new Date().toISOString().split("T")[0];
      const data = {
        publishedDate,
        platform: "Threads",
        channel: INSTAGRAM_USER,
        title: threadContent.slice(0, 100),
        videoUrl: THREADS_URL
      };

      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });

      console.log("✅ Threads 送信成功:", await res.text());
    } else {
      console.log("⏭️ Threads投稿は見つかりませんでした");
    }
  } catch (e) {
    console.warn("⚠️ Threads取得失敗:", e.message);
  }
}

(async () => {
  let existingIds = [];
  try {
    const res = await fetch(EXISTING_URLS_API);
    const urls = await res.json();
    existingIds = urls.map(url => {
      return extractId((url || "").toString().trim().replace(/\/+\$/, ""), url.includes("/reel") ? "reel" : "p");
    }).filter(Boolean);
    console.log("📄 既存投稿 ID数:", existingIds.length);
  } catch (e) {
    console.warn("⚠️ 既存URL取得失敗:", e.message);
  }

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();

  try {
    await page.setCookie({
      name: "sessionid",
      value: INSTAGRAM_SESSIONID,
      domain: ".instagram.com",
      path: "/",
      httpOnly: true,
      secure: true
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36"
    );

    await scrapeAndPost(page, REELS_URL, "reel", existingIds);
    await scrapeAndPost(page, FEED_URL, "p", existingIds);
    await checkAndPostStory(page);
    await scrapeThreads(page);

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
