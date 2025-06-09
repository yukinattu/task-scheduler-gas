from seleniumwire import webdriver
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
from datetime import datetime
import time
import requests

# ===== 設定 =====
INSTAGRAM_USER = ""
SESSIONID = "73295698085%3AGN9zs8UcGVCwu9%3A1%3AAYfILLFlkNkRGo0jasKQ3fmsbPOJyF10ISIFwQvMcg"
WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec"
# =================

def get_highlight_urls(username):
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

    profile_url = f"https://www.instagram.com/{username}/"
    driver.get(profile_url)
    time.sleep(5)

    soup = BeautifulSoup(driver.page_source, "html.parser")
    highlight_urls = []

    for a in soup.find_all("a", href=True):
        if a["href"].startswith("/stories/highlights/"):
            full_url = f"https://www.instagram.com{a['href']}"
            if full_url not in highlight_urls:
                highlight_urls.append(full_url)

    driver.quit()
    return highlight_urls

def post_to_webhook(highlight_urls):
    if not highlight_urls:
        print("📭 ハイライトURLが見つかりませんでした。")
        return

    for url in highlight_urls:
        payload = {
            "publishedDate": datetime.now().strftime("%Y-%m-%d"),
            "platform": "Instagram Story Highlight",
            "channel": INSTAGRAM_USER,
            "title": "(ハイライトURL)",
            "videoUrl": url
        }
        try:
            res = requests.post(WEBHOOK_URL, json=payload)
            print(f"✅ ハイライトURL送信成功: {url}")
        except Exception as e:
            print(f"❌ Webhook送信失敗: {e}")

if __name__ == "__main__":
    try:
        print(f"🔍 {INSTAGRAM_USER} のハイライトリンクを取得中...")
        urls = get_highlight_urls(INSTAGRAM_USER)
        post_to_webhook(urls)
    except Exception as e:
        print(f"❌ エラー発生: {e}")
