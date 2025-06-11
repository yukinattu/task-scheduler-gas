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

  const browser = await puppeteer.launch({
    headless: "new", // 原因1: 新ヘッドレスモードに切り替え
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36");

  for (const channelUrl of YOUTUBE_CHANNELS) {
    for (const mode of ["videos", "shorts"]) {
      const url = `${channelUrl}/${mode}`;
      console.log(`🚀 チェック開始: ${url}`);

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 0 });

        // 原因3: 複数回スクロールして描画を促す
        await page.evaluate(async () => {
          for (let i = 0; i < 3; i++) {
            window.scrollBy(0, window.innerHeight);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        });

        // Shortsは描画完了を明示的に待つ（最大15秒）
        if (mode === "shorts") {
          await page.waitForSelector('a[href*="/shorts/"]', { timeout: 15000 });
        }

        const result = await page.evaluate((mode) => {
          if (mode === "shorts") {
            const anchors = Array.from(document.querySelectorAll('a[href*="/shorts/"]'));
            const first = anchors[0];
            const titleEl =
              first?.closest('ytd-reel-video-renderer')?.querySelector('#details #title') ||
              first?.getAttribute('title') ||
              first?.textContent;
            const href = first?.href;
            const title = titleEl?.trim();
            return href && title ? { videoUrl: href, title } : null;
          } else {
            const item = document.querySelector("ytd-rich-item-renderer, ytd-grid-video-renderer");
            const anchor = item?.querySelector('a#video-title, a#video-title-link');
            const href = anchor?.href;
            const title = anchor?.textContent?.trim();
            return href && title ? { videoUrl: href, title } : null;
          }
        }, mode);

        if (!result) {
          throw new Error("動画DOMが取得できませんでした（描画またはセレクタの不一致）");
        }

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
        // 🔍 原因推定ログ出力
        console.error(`❌ 処理失敗（${url}）: ${e.message}`);
        if (mode === "shorts") {
          console.error("🛠 推定される原因:");
          console.error("  ── 💡 headless環境で描画が壊れている → headless: \"new\" を推奨");
          console.error("  ── 💡 セレクタが不一致 → querySelectorAll で緩めに取得に変更済み");
          console.error("  ── 💡 描画が間に合っていない → スクロール＋待機も実施済み");
          console.error("  ── 💡 それでも失敗する場合 → ページ構造が変更された可能性あり");
        }
      }
    }
  }

  await browser.close();
})();
