
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec";
const EXISTING_URLS_API = WEBHOOK_URL;
const INSTAGRAM_USER = "sayaka_okada";

const REELS_URL = `https://www.instagram.com/${INSTAGRAM_USER}/reels/`;
const FEED_URL = `https://www.instagram.com/${INSTAGRAM_USER}/`;
const STORY_URL = `https://www.instagram.com/stories/${INSTAGRAM_USER}/`;
const THREADS_URL = `https://www.threads.net/@${INSTAGRAM_USER}`;

const INSTAGRAM_SESSIONID = "73295698085%3ALu2YBiMIgHLOfG%3A8%3AAYfOlJxDa3gSGVlRcAVgdMDI3NEpkSp8TzL7ejqw0Q";

function extractId(url, type) {
  if (type === "threads") {
    const match = url.match(/\/[@][^/]+\/post\/([^/?]+)/);
    return match ? match[1] : null;
  }
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
    platform: type === 'reel' ? "Instagram Reels" : "Instagram Feed",
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

    const isUnavailable = await page.evaluate(() => {
      return document.body.innerText.includes("This story is unavailable");
    });

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

async function scrapeThreads(page, existingIds) {
  try {
    await page.goto(THREADS_URL, { waitUntil: "networkidle2", timeout: 0 });
    await page.waitForTimeout(6000);

    try {
      await page.waitForSelector("article", { timeout: 10000 });
    } catch {
      await page.screenshot({ path: "threads_error.png" });
      console.error("❌ article セレクタが見つかりません（スクショ threads_error.png を確認）");
      return;
    }

    const postData = await page.evaluate(() => {
      const articles = document.querySelectorAll("article");
      if (!articles.length) return null;

      const firstArticle = articles[0];

      const textDivs = Array.from(firstArticle.querySelectorAll("div[dir='auto']"));
      const content = textDivs.map(div => div.innerText).join("\n").trim();

      const anchorTags = Array.from(firstArticle.querySelectorAll("a[href*='/@']"));
      const postLink = anchorTags.find(a => a.href.includes("/post/"))?.href;

      return {
        content,
        href: postLink?.startsWith("http") ? postLink : `https://www.threads.net${postLink}`
      };
    });

    if (!postData || !postData.href) {
      console.log("⏭️ Threads投稿は見つかりませんでした");
      return;
    }

    const normalizedUrl = postData.href.trim();
    const id = extractId(normalizedUrl, "threads");
    if (!id) throw new Error("❌ Threads ID抽出失敗");

    if (existingIds.includes(id)) {
      console.log(`⏭️ Threads 重複スキップ: ${id}`);
      return;
    }

    const publishedDate = new Date().toISOString().split("T")[0];
    const data = {
      publishedDate,
      platform: "Threads",
      channel: INSTAGRAM_USER,
      title: postData.content.slice(0, 100),
      videoUrl: normalizedUrl
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" }
    });

    console.log("✅ Threads 送信成功:", await res.text());
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
      if (url.includes("/reel")) return extractId(url, "reel");
      if (url.includes("/p/")) return extractId(url, "p");
      if (url.includes("/post/")) return extractId(url, "threads");
      return null;
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
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" +
      (Math.floor(Math.random() * 20) + 90) + ".0.0.0 Safari/537.36"
    );

    await scrapeAndPost(page, REELS_URL, "reel", existingIds);
    await scrapeAndPost(page, FEED_URL, "p", existingIds);
    await checkAndPostStory(page);
    await scrapeThreads(page, existingIds);

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
