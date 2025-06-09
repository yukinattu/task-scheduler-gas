from seleniumwire import webdriver  # ← selenium-wireで通信傍受
from selenium.webdriver.chrome.options import Options
from datetime import datetime
import time
import requests

# ===== 設定 =====
INSTAGRAM_USER = ""  # ← 対象アカウント（例: sakurazaka46jp）
SESSIONID = "73295698085%3AGN9zs8UcGVCwu9%3A1%3AAYfILLFlkNkRGo0jasKQ3fmsbPOJyF10ISIFwQvMcg"
WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec"
# =================

def get_story_media_urls(username):
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("user-agent=Mozilla/5.0")

    seleniumwire_options = {
        'disable_encoding': True
    }

    driver = webdriver.Chrome(options=chrome_options, seleniumwire_options=seleniumwire_options)
    driver.get("https://www.instagram.com/")
    driver.add_cookie({
        "name": "sessionid",
        "value": SESSIONID,
        "domain": ".instagram.com",
        "path": "/",
        "secure": True
    })

    # ストーリーURLへアクセス
    driver.get(f"https://www.instagram.com/stories/{username}/")
    time.sleep(6)

    # 通信の中から画像/動画URLを抽出
    urls = set()
    for request in driver.requests:
        if request.response and (
            "cdninstagram" in request.url and
            (".mp4" in request.url or ".jpg" in request.url or ".jpeg" in request.url)
        ):
            urls.add(request.url)

    driver.quit()
    return urls

def post_to_webhook(media_urls):
    if not media_urls:
        print("📭 ストーリー動画/画像は見つかりませんでした。")
        return

    for url in media_urls:
        payload = {
            "publishedDate": datetime.now().strftime("%Y-%m-%d"),
            "platform": "Instagram Story",
            "channel": INSTAGRAM_USER,
            "title": "(DOM抽出ストーリー)",
            "videoUrl": url
        }
        try:
            res = requests.post(WEBHOOK_URL, json=payload)
            print(f"✅ Story送信成功: {res.text}")
        except Exception as e:
            print(f"❌ Webhook送信失敗: {e}")

if __name__ == "__main__":
    try:
        print(f"🔍 {INSTAGRAM_USER} のストーリーを取得中（selenium-wire）...")
        urls = get_story_media_urls(INSTAGRAM_USER)
        post_to_webhook(urls)
    except Exception as e:
        print(f"❌ エラー発生: {e}")
