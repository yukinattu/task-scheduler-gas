import instaloader
import requests
import os
from datetime import datetime

# Webhook URL（GASで発行済のURLをここに入れてください）
WEBHOOK_URL = "https://script.google.com/macros/s/XXXXX/exec"

# チェック対象のInstagramユーザー
INSTAGRAM_USERS = ["a_n_o2mass", "nogizaka46_official", "yasu.ryu9chakra", "takato_fs"]

# 保存済みのURLリスト（ローカルファイル運用）
EXISTING_IDS_FILE = "existing_story_ids.txt"

# 既存IDの読み込み（ローカルファイルベース）
def load_existing_ids():
    if not os.path.exists(EXISTING_IDS_FILE):
        return set()
    with open(EXISTING_IDS_FILE, "r") as f:
        return set(line.strip() for line in f.readlines())

# 既存IDの保存
def save_existing_ids(ids):
    with open(EXISTING_IDS_FILE, "w") as f:
        for id in ids:
            f.write(id + "\n")

# メイン処理
def main():
    existing_ids = load_existing_ids()
    new_ids = set()

    L = instaloader.Instaloader()
    for user in INSTAGRAM_USERS:
        try:
            profile = instaloader.Profile.from_username(L.context, user)
            for story in L.get_stories(userids=[profile.userid]):
                for item in story.get_items():
                    story_id = str(item.mediaid)
                    if story_id in existing_ids:
                        continue
                    post_data = {
                        "publishedDate": datetime.now().strftime("%Y-%m-%d"),
                        "platform": "Instagram Story",
                        "channel": user,
                        "title": item.caption or "(タイトル不明)",
                        "videoUrl": item.url  # 動画または画像のURL
                    }
                    res = requests.post(WEBHOOK_URL, json=post_data)
                    print(f"✅ 送信成功（{user}）: {story_id} - {res.text}")
                    new_ids.add(story_id)
        except Exception as e:
            print(f"❌ エラー（{user}）: {e}")

    save_existing_ids(existing_ids.union(new_ids))

if __name__ == "__main__":
    main()
