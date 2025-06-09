import instaloader
from datetime import datetime
import requests

# 設定（ここは適宜変更）
INSTAGRAM_USER = "a_n_o2mass"  # 対象アカウント
SESSION_USERNAME = "milimori111"  # セッションファイル名（ログイン済み）
WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxtWswB_s3RZDCcA45dHT2zfE6k8GjaskiT9CpaqEGEvmPtHsJrgrS7cQx5gw1qvd8/exec"

# インスタンス生成
L = instaloader.Instaloader()

# セッションファイルからログイン状態をロード
try:
    L.load_session_from_file(SESSION_USERNAME)
    print(f"✅ セッションファイル {SESSION_USERNAME} を読み込みました。")
except Exception as e:
    print(f"❌ セッション読み込み失敗: {e}")
    exit(1)

# プロフィール取得
try:
    profile = instaloader.Profile.from_username(L.context, INSTAGRAM_USER)
    print(f"👤 {INSTAGRAM_USER} のプロフィールを取得しました")
except Exception as e:
    print(f"❌ プロフィール取得失敗: {e}")
    exit(1)

# ストーリー取得（直近のもの）
try:
    stories = L.get_stories(userids=[profile.userid])
    found = False
    for story in stories:
        for item in story.get_items():
            story_url = item.url
            taken_at = item.date_local.strftime("%Y-%m-%d")
            title = item.caption or "(キャプションなし)"

            payload = {
                "publishedDate": taken_at,
                "platform": "Instagram Story",
                "channel": INSTAGRAM_USER,
                "title": title,
                "videoUrl": story_url
            }

            res = requests.post(WEBHOOK_URL, json=payload)
            print(f"✅ Story送信成功: {res.text}")
            found = True
    if not found:
        print("📭 ストーリーは見つかりませんでした。")
except Exception as e:
    print(f"❌ ストーリー取得失敗: {e}")
