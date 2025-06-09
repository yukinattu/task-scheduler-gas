import tempfile
from seleniumwire import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime
import time
import requests
import re

# ===== 設定 =====
INSTAGRAM_USER = "jypetwice_japan"
SESSIONID = "73295698085%3AGN9zs8UcGVCwu9%3A1%3AAYfILLFlkNkRGo0jasKQ3fmsbPOJyF10ISIFwQvMcg"
WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec"
# =================

def get_story_urls_from_media(username):
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("user-agent=Mozilla/5.0")
    chrome_options.add_argument(f"--user-data-dir={tempfile.mkdtemp()}")  # 競合防止

    seleniumwire_options = {'disable_encoding': True}
    driver = webdriver.Chrome(options=chrome_options, seleniumwire_options=seleniumwire_options)

    driver.get("https://www.instagram.com/")
    driver.add_cookie({
        "name": "sessionid",
        "value": SESSIONID,
        "domain": ".instagram.com",
        "path": "/",
        "secure": True
    })

    story_url = f"https://www.instagram.com/stories/{username}/"
    driver.get(story_url)

    try:
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        print("🎥 ストーリー再生UIが表示されました")
        body = driver.find_element(By.TAG_NAME, "body")
        for _ in range(3):
            body.click()
            time.sleep(0.5)
    except Exception:
        print("⚠️ ストーリーUIの表示に失敗しました")

    print("⏳ .jpg/.mp4リクエストの受信を待機中（40秒）...")
    time.sleep(40)

    story_urls = set()
    debug_urls = []

    for request in driver.requests:
        if request.response:
            url = request.url
            if any(ext in url for ext in [".mp4", ".jpg", ".jpeg", ".webp", ".png"]):
                debug_urls.append(url)
                matches = re.findall(r'/stories/[^/]+/(\d+)', url)
                if not matches:
                    matches = re.findall(r'/(\d{15,})_', url)
                for story_id in matches:
                    full_url = f"https://www.instagram.com/stories/{username}/{story_id}/"
                    story_urls.add(full_url)

    driver.quit()

    # 🔎 デバッグ用出力
    print("📦 抽出されたリクエストURLの例（最大5件）:")
    for url in list(debug_urls)[:5]:
        print(" -", url)

    return story_urls

def post_to_webhook(story_urls):
    if not story_urls:
        print("📭 ストーリーURLが見つかりませんでした。")
        return

    for url in story_urls:
        payload = {
            "publishedDate": datetime.now().strftime("%Y-%m-%d"),
            "platform": "Instagram Story",
            "channel": INSTAGRAM_USER,
            "title": "(ストーリーURL from CDN)",
            "videoUrl": url
        }
        try:
            res = requests.post(WEBHOOK_URL, json=payload)
            print(f"✅ Story URL送信成功: {url}")
        except Exception as e:
            print(f"❌ Webhook送信失敗: {e}")

if __name__ == "__main__":
    try:
        print(f"🔍 {INSTAGRAM_USER} のストーリー個別リンクを抽出中（mp4/jpg経由）...")
        urls = get_story_urls_from_media(INSTAGRAM_USER)
        post_to_webhook(urls)
    except Exception as e:
        print(f"❌ エラー発生: {e}")
