import csv
import json

AUTHOR_UID = "TtLuDvHKG2g7EXAkHMw15z1avu03"

input_csv = "final_merged.csv"
output_json = "routes.json"

routes = []
with open(input_csv, encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        route = {
            "latitude": row.get("위도", ""),
            "longitude": row.get("경도", ""),
            "mountain": row.get("산이름", ""),
            "zone": row.get("구역", ""),
            "routeName": row.get("루트이름", ""),
            "overview": row.get("등반개요", ""),
            "typeRoot": row.get("등반형태", ""),
            "equipment": row.get("등반장비", ""),
            "avgDifficulty": row.get("평균난이도", ""),
            "pioneer": row.get("개척자", ""),
            "imageUrl": row.get("루트이미지URL", ""),
            "status": "approved",
            "authorUid": AUTHOR_UID
        }
        routes.append(route)

with open(output_json, "w", encoding="utf-8") as f:
    json.dump(routes, f, ensure_ascii=False, indent=2)

print(f"routes.json 변환 완료! (총 {len(routes)}개)")
