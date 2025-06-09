from seleniumwire import webdriver
from selenium.webdriver.chrome.options import Options
from datetime import datetime
import time
import requests
import re

# ===== 設定 =====
INSTAGRAM_USER = "official_ske48"
SESSIONID = "73295698085%3AGN9zs8UcGVCwu9%3A1%3AAYfILLFlkNkRGo0jasKQ3fmsbPOJyF10ISIFwQvMcg"
WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec"
# =================

def get_story_id_urls(username):
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

    story_url = f"https://www.instagram.com/stories/{username}/"
    driver.get(story_url)
    time.sleep(6)

    story_ids = set()
    for request in driver.requests:
        if request.response and "cdninstagram" in request.url and (".mp4" in request.url or ".jpg" in request.url):
            # ストーリーIDをURL内から抽出（15桁以上の数字の後にアンダースコアがあるもの）
            matches = re.findall(r'/(\d{15,})_', request.url)
            for match in matches:
                story_ids.add(match)

    driver.quit()

    return [f"https://www.instagram.com/stories/{username}/{story_id}/" for story_id in story_ids]

def post_to_webhook(story_urls):
    if not story_urls:
        print("📭 ストーリーURLが見つかりませんでした。")
        return

    for url in story_urls:
        payload = {
            "publishedDate": datetime.now().strftime("%Y-%m-%d"),
            "platform": "Instagram Story",
            "channel": INSTAGRAM_USER,
            "title": "(ストーリーURL)",
            "videoUrl": url
        }
        try:
            res = requests.post(WEBHOOK_URL, json=payload)
            print(f"✅ ストーリーURL送信成功: {url}")
        except Exception as e:
            print(f"❌ Webhook送信失敗: {e}")

if __name__ == "__main__":
    try:
        print(f"🔍 {INSTAGRAM_USER} のストーリー個別リンクを抽出中...")
        urls = get_story_id_urls(INSTAGRAM_USER)
        post_to_webhook(urls)
    except Exception as e:
        print(f"❌ エラー発生: {e}")
