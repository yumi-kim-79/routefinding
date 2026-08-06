# store — 스토어 등록 자료

스크린샷과 문구는 **브라우저에서 직접 업로드**한다(빌드에 들어가지 않는다).
그래도 여기에 함께 넣어 두는 이유: 다음 버전에서 **뭘 올렸었는지 대조**해야 하고,
반려·수정 이력이 문구와 함께 남아야 한다.

```
store/
  METADATA_KO.md              앱 이름·부제·키워드·설명 (양쪽 스토어 공용)
  appstore/screenshots-6.5/   ← ⭐ 실제 업로드용. 1284x2778
  appstore/screenshots-6.9/   1290x2796 (App Store Connect 가 6.9" 칸을 열어줄 때)
  play/screenshots/           Play 스토어용 (16:9 또는 9:16, 최소 320px)
```

## ⚠️ 크기는 App Store Connect 화면에 적힌 것만 받는다

업로드 칸 아래에 허용 크기가 적혀 있고 **1픽셀만 달라도 첨부가 안 된다.**
이번에 겪은 것: 편집 툴이 비율을 맞추느라 1240x2688 / 1281x2778 처럼
**애매하게 반올림한 값**을 뱉었다. 둘 다 거부당했다.

우리 앱 레코드가 요구한 값: **1242x2688 또는 1284x2778** (iPhone 6.5")
→ `screenshots-6.5/` 의 **1284x2778** 을 쓴다.

크기를 다시 맞춰야 하면 원본에서 한 번에 변환한다(재리사이즈를 반복하면 흐려진다):
```bash
cd store/appstore
python3 - <<'EOF'
from PIL import Image
import glob, os
TARGET=(1284,2778)                      # ← 콘솔이 요구하는 값으로 바꾼다
os.makedirs('out', exist_ok=True)
for p in sorted(glob.glob('screenshots-6.9-original/*.png')):
    Image.open(p).convert('RGB').resize(TARGET, Image.LANCZOS).save(
        'out/'+os.path.basename(p), optimize=True)
EOF
```

## 파일 이름 규칙

순서가 그대로 스토어 노출 순서가 되도록 번호를 앞에 붙인다.

```
01-map.png          지도 — 마커가 모여 있는 화면
02-topo.png         개념도 상세 — 사진 위 등반 라인
03-search.png       개념도 검색 결과 목록
04-report.png       루트 제보 / 사진에 라인 그리기
05-log.png          등반일지 · 마이페이지
```
