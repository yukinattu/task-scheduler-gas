from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from bs4 import BeautifulSoup
from datetime import datetime
import time
import requests
import re

# ===== 設定 =====
INSTAGRAM_USER = "akb48"
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

def extract_story_urls(html):
    soup = BeautifulSoup(html, "html.parser")
    scripts = soup.find_all("script")
    for script in scripts:
        if "video_url" in script.text or "display_url" in script.text:
            return script.text
    return ""

def parse_and_send(script_text):
    urls_video = re.findall(r'"video_url":"([^"]+)"', script_text)
    urls_image = re.findall(r'"display_url":"([^"]+)"', script_text)

    all_urls = set(
        url.replace("\u0026", "&").replace("\", "")
        for url in urls_video + urls_image
    )

    if not all_urls:
        print("📭 ストーリー動画/画像は見つかりませんでした。")
        return

    for url in all_urls:
        payload = {
            "publishedDate": datetime.now().strftime("%Y-%m-%d"),
            "platform": "Instagram Story",
            "channel": INSTAGRAM_USER,
            "title": "(タイトル不明・ストーリー)",
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
        script = extract_story_urls(html)
        if script:
            parse_and_send(script)
        else:
            print("📭 スクリプト内にストーリー情報が見つかりませんでした。")
    except Exception as e:
        print(f"❌ エラー発生: {e}")
