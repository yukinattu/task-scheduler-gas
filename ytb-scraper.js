const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec";
const EXISTING_URLS_API = WEBHOOK_URL;

const YOUTUBE_CHANNELS = [
  "https://www.youtube.com/@soshina",
  "https://www.youtube.com/@KYOUPOKE",
  "https://www.youtube.com/@shimofuritube",
  "https://www.youtube.com/@seiya_inimini",
  "https://www.youtube.com/@prime_ABEMA",
  "https://www.youtube.com/@RIPSLYME-w"
];

function extractVideoId(url) {
  const match = url?.match(/[?&]v=([\w-]{11})|\/shorts\/([\w-]{11})|\/watch\?v=([\w-]{11})/);
  return match ? (match[1] || match[2] || match[3]) : null;
}

function isShorts(url) {
  return url.includes("/shorts/");
}

(async () => {
  let existingVideoIds = [];

  try {
    const res = await fetch(EXISTING_URLS_API);
    const urls = await res.json();
    existingVideoIds = urls.map(url => extractVideoId((url || "").toString().trim())).filter(Boolean);
    console.log("📄 既存動画ID数:", existingVideoIds.length);
  } catch (e) {
    console.warn("⚠️ 既存URL取得失敗:", e.message);
  }

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36");

  for (const channelUrl of YOUTUBE_CHANNELS) {
    for (const mode of ["videos", "shorts"]) {
      const url = `${channelUrl}/${mode}`;
      console.log(`🚀 チェック開始: ${url}`);

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 0 });

        // Lazyロード対策（スクロールで要素描画促進）
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 2);
        });
        await page.waitForTimeout(3000);

        // Shortsのみセレクタを明示的に待機
        if (mode === "shorts") {
          await page.waitForSelector('ytd-reel-video-renderer a[href*="/shorts/"]', { timeout: 10000 });
        }

        const result = await page.evaluate((mode) => {
          if (mode === "shorts") {
            const reel = document.querySelector('ytd-reel-video-renderer');
            const anchor = reel?.querySelector('a[href*="/shorts/"]');
            const titleEl = reel?.querySelector('#details #title');
            const href = anchor?.href;
            const title = titleEl?.textContent?.trim();
            return href && title ? { videoUrl: href, title } : null;
          } else {
            const item = document.querySelector("ytd-rich-item-renderer, ytd-grid-video-renderer");
            const anchor = item?.querySelector('a#video-title, a#video-title-link');
            const href = anchor?.href;
            const title = anchor?.textContent?.trim();
            return href && title ? { videoUrl: href, title } : null;
          }
        }, mode);

        if (!result) throw new Error("❌ 投稿が見つかりませんでした");

        const normalizedUrl = result.videoUrl.trim();
        const videoId = extractVideoId(normalizedUrl);

        if (!videoId || existingVideoIds.includes(videoId)) {
          console.log(`⏭️ 重複スキップ: ${videoId}`);
          continue;
        }

        const publishedDate = new Date().toISOString().split("T")[0];
        const platform = isShorts(normalizedUrl) ? "YouTube Shorts" : "YouTube";

        const data = {
          publishedDate,
          platform,
          channel: channelUrl.split("/").pop(),
          title: result.title,
          videoUrl: normalizedUrl
        };

        const postRes = await fetch(WEBHOOK_URL, {
          method: "POST",
          body: JSON.stringify(data),
          headers: { "Content-Type": "application/json" }
        });

        console.log(`✅ 送信成功（${platform}）: ${result.title}`);
      } catch (e) {
        console.error(`❌ 処理失敗（${url}）:`, e.message);
      }
    }
  }

  await browser.close();
})();
