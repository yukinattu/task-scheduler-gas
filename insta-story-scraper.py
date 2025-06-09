from seleniumwire import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime
import tempfile
import time
import requests
import re

# ===== 設定 =====
INSTAGRAM_USER = ""
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
    chrome_options.add_argument(f"--user-data-dir={tempfile.mkdtemp()}")

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

        # 強制スキップ・クリック
        for _ in range(2):
            body.click()
            time.sleep(0.3)
        body.send_keys(Keys.ARROW_RIGHT)
        time.sleep(0.3)

    except Exception:
        print("⚠️ ストーリーUIの表示に失敗しました")

    story_urls = set()
    debug_urls = []

    print("⏳ 通信＆タグのURL抽出を開始（40秒待機）...")
    time.sleep(40)

    # 通信から抽出（従来）
    for request in driver.requests:
        if request.response:
            url = request.url
            if any(ext in url for ext in [".mp4", ".jpg", ".jpeg", ".webp", ".png"]):
                debug_urls.append(url)
                matches = re.findall(r'/(\d{15,})_', url)
                for story_id in matches:
                    full_url = f"https://www.instagram.com/stories/{username}/{story_id}/"
                    story_urls.add(full_url)

    # タグのsrcからも抽出（新規）
    for tag in ["video", "img"]:
        try:
            elements = driver.find_elements(By.TAG_NAME, tag)
            for e in elements:
                src = e.get_attribute("src")
                if src and any(ext in src for ext in [".jpg", ".mp4", ".webp", ".jpeg"]):
                    debug_urls.append(src)
                    matches = re.findall(r'/(\d{15,})_', src)
                    for story_id in matches:
                        full_url = f"https://www.instagram.com/stories/{username}/{story_id}/"
                        story_urls.add(full_url)
        except:
            continue

    driver.quit()

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
            "title": "(ストーリーURL from tag/src)",
            "videoUrl": url
        }
        try:
            res = requests.post(WEBHOOK_URL, json=payload)
            print(f"✅ Story URL送信成功: {url}")
        except Exception as e:
            print(f"❌ Webhook送信失敗: {e}")

if __name__ == "__main__":
    try:
        print(f"🔍 {INSTAGRAM_USER} のストーリー個別リンクを抽出中（通信/タグ両対応）...")
        urls = get_story_urls_from_media(INSTAGRAM_USER)
        post_to_webhook(urls)
    except Exception as e:
        print(f"❌ エラー発生: {e}")
