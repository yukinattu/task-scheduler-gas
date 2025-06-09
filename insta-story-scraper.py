import requests
from bs4 import BeautifulSoup
from datetime import datetime

# ===== 設定（変更する場所） =====
INSTAGRAM_USER = "a_n_o2mass"  # 対象アカウント
SESSIONID = "7132102982%3ANXl2NyhzamYhN2%3A4%3AAYeRrUxljqU7hNVdgFTi4oHjmXPBH38fhVktY1Un5g"
WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec"
# ==============================

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Cookie": f"sessionid={SESSIONID};"
}

def get_story_html(username):
    url = f"https://www.instagram.com/stories/{username}/"
    res = requests.get(url, headers=headers)
    if res.status_code != 200:
        raise Exception(f"📛 Storyページ取得失敗: HTTP {res.status_code}")
    return res.text

def extract_story_urls(html):
    soup = BeautifulSoup(html, "html.parser")
    scripts = soup.find_all("script")
    for script in scripts:
        if 'video_versions' in script.text or 'display_url' in script.text:
            return script.text
    return ""

def parse_and_send(script_text):
    # 動画URL抽出（最低限の正規表現マッチ）
    import re
    urls = re.findall(r'"video_url":"([^"]+)"', script_text)
    urls = list(set([url.replace("\\u0026", "&").replace("\\", "") for url in urls]))

    if not urls:
        print("📭 ストーリー動画は見つかりませんでした。")
        return

    for url in urls:
        payload = {
            "publishedDate": datetime.now().strftime("%Y-%m-%d"),
            "platform": "Instagram Story",
            "channel": INSTAGRAM_USER,
            "title": "(タイトル不明・ストーリー)",
            "videoUrl": url
        }
        res = requests.post(WEBHOOK_URL, json=payload)
        print(f"✅ Story送信成功: {res.text}")

if __name__ == "__main__":
    try:
        print(f"🔍 {INSTAGRAM_USER} のストーリーを取得中...")
        html = get_story_html(INSTAGRAM_USER)
        script = extract_story_urls(html)
        if script:
            parse_and_send(script)
        else:
            print("📭 ストーリー用のスクリプトデータが見つかりませんでした。")
    except Exception as e:
        print(f"❌ エラー発生: {e}")
