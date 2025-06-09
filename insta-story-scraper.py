from seleniumwire import webdriver
from selenium.webdriver.chrome.options import Options
from datetime import datetime
import time
import requests
import re

# ===== 設定 =====
INSTAGRAM_USER = "hinatazaka46tw"
SESSIONID = "73295698085%3AGN9zs8UcGVCwu9%3A1%3AAYfILLFlkNkRGo0jasKQ3fmsbPOJyF10ISIFwQvMcg"
WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec"
# =================

def get_story_urls_from_media(username):
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
            # URL中からstory_idっぽい数字列を抽出
            matches = re.findall(r'/(\d{15,})_', request.url)
            for story_id in matches:
                full_url = f"https://www.instagram.com/stories/{username}/{story_id}/"
                story_ids.add(full_url)

    driver.quit()
    return story_ids

def post_to_webhook(story_urls):
    if not story_urls:
        print("📭 ストーリーURLが見つかりませんでした。")
        return

    for url in story_urls:
        payload = {
            "publishedDate": datetime.now().strftime("%Y-%m-%d"),
            "platform": "Instagram Story",
            "channel": INSTAGRAM_USER,
            "title": "(推測IDから生成)",
            "videoUrl": url
        }
        try:
            res = requests.post(WEBHOOK_URL, json=payload)
            print(f"✅ ストーリーURL送信成功: {url}")
        except Exception as e:
            print(f"❌ Webhook送信失敗: {e}")

if __name__ == "__main__":
    try:
        print(f"🔍 {INSTAGRAM_USER} のストーリー個別リンクを抽出中（mp4/jpg経由）...")
        urls = get_story_urls_from_media(INSTAGRAM_USER)
        post_to_webhook(urls)
    except Exception as e:
        print(f"❌ エラー発生: {e}")
