from seleniumwire import webdriver
from selenium.webdriver.chrome.options import Options
from datetime import datetime
import time
import requests
import json

# ===== 設定 =====
INSTAGRAM_USER = ""
SESSIONID = "73295698085%3AGN9zs8UcGVCwu9%3A1%3AAYfILLFlkNkRGo0jasKQ3fmsbPOJyF10ISIFwQvMcg"
WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec"
# =================

def get_story_urls(username):
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

    story_urls = set()
    for request in driver.requests:
        if request.response and "/api/v1/feed/reels_media/" in request.url:
            try:
                body = request.response.body.decode("utf-8")
                data = json.loads(body)
                items = data.get("reel", {}).get("items", [])
                for item in items:
                    story_id = item.get("id")
                    if story_id:
                        full_url = f"https://www.instagram.com/stories/{username}/{story_id}/"
                        story_urls.add(full_url)
            except Exception as e:
                print("❌ JSON解析失敗:", e)

    driver.quit()
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
        print(f"🔍 {INSTAGRAM_USER} のストーリーIDリンクを取得中...")
        urls = get_story_urls(INSTAGRAM_USER)
        post_to_webhook(urls)
    except Exception as e:
        print(f"❌ エラー発生: {e}")
