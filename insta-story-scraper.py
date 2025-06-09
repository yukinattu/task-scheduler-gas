from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
from datetime import datetime
import time
import requests

# ===== 設定 =====
INSTAGRAM_USER = "a_n_o2mass"
SESSIONID = "73295698085%3AGN9zs8UcGVCwu9%3A1%3AAYfILLFlkNkRGo0jasKQ3fmsbPOJyF10ISIFwQvMcg"
WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec"
# =================

def get_story_page_source(username):
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)")

    driver = webdriver.Chrome(options=options)
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
    time.sleep(5)
    html = driver.page_source
    driver.quit()
    return html

def extract_story_urls_from_dom(html):
    soup = BeautifulSoup(html, "html.parser")
    urls = set()

    for img in soup.find_all("img"):
        src = img.get("src")
        if src and "scontent" in src:
            urls.add(src)

    for video in soup.find_all("video"):
        src = video.get("src")
        if src:
            urls.add(src)

    return urls

def parse_and_send(urls):
    if not urls:
        print("📬 ストーリー画像/動画は見つかりませんでした。")
        return

    for url in urls:
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
        print(f"🔍 {INSTAGRAM_USER} のストーリーを取得中（Selenium）...")
        html = get_story_page_source(INSTAGRAM_USER)
        urls = extract_story_urls_from_dom(html)
        parse_and_send(urls)
    except Exception as e:
        print(f"❌ エラー発生: {e}")
