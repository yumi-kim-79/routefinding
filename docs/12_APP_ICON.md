# 12. 앱 아이콘

> 2026-08-06. TestFlight 업로드가 **아이콘 없음**으로 거부되면서 발견했다.
> 확인해 보니 안드로이드도 **React Native 기본 아이콘(초록 로봇)** 이 그대로 들어가 있었다.
> Play 스토어의 목록 이미지는 v1 것이 남아 있어 지금까지 드러나지 않았다.

---

## 1. 원본 (단일 소스)

```
assets/app-icon-1024.png      1024x1024, RGB(알파 없음)
```

**아이콘을 바꾸려면 이 파일만 교체하고 §3 스크립트를 다시 돌린다.**

---

## 2. 생성물

### iOS — 단일 크기 방식 (Xcode 14+)
```
app/ios/RouteFinding/Images.xcassets/AppIcon.appiconset/
  AppIcon.png       1024x1024 RGB   ← 알파 채널이 있으면 애플이 업로드를 거부한다
  Contents.json     idiom: universal / platform: ios / size: 1024x1024
```
나머지 크기는 Xcode가 빌드할 때 만든다. 예전처럼 20종을 넣을 필요가 없다.

### Android
```
mipmap-{mdpi..xxxhdpi}/ic_launcher.png        48 / 72 / 96 / 144 / 192  (정사각)
mipmap-{mdpi..xxxhdpi}/ic_launcher_round.png  같은 크기, 원형 마스크
mipmap-anydpi-v26/ic_launcher{,_round}.xml    적응형 아이콘 (Android 8+)
drawable-{mdpi..xxxhdpi}/ic_launcher_foreground.png  108dp 캔버스
values/ic_launcher_background.xml             #31322B (원본 모서리 색 실측)
```

---

## 3. 다시 만드는 법

`assets/app-icon-1024.png` 를 바꾼 뒤 저장소 루트에서:

```bash
python3 tools/make_app_icons.py
```

---

## 4. ⚠️ 적응형 아이콘에서 겪은 함정

**첫 시도**: 원본을 66/108 로 줄여 **투명** 캔버스에 얹었다.
→ 원본이 자기 배경색(어두운 사각형)을 품고 있어서 **가운데에 네모 자국**이 보였다.

**두 번째**: 그럼 전경을 원본으로 **꽉 채우면**(full-bleed) 되지 않나?
→ 안 된다. 적응형 아이콘은 **바깥 19.4% 가 잘릴 수 있다**(런처 모양에 따라).
   원본 실측 여백은 위 **12.7%** · 아래 **15%** 라서 **산 꼭대기와 'FINDING' 글자가 잘린다.**

**해결**: 전경을 **배경색으로 가득 채우고**, 원본에서 **내용만 잘라내(bbox)** 안전영역(58%)에
맞춰 가운데 놓는다. 이음매도 없고 잘리지도 않는다.
덤으로 원본이 왼쪽으로 치우쳐 있던 것(좌 18.7% / 우 26.0%)도 가운데로 맞춰졌다.

`<monochrome>` 은 **일부러 뺐다.** 전경이 불투명이라 테마 아이콘으로 쓰면 통짜 사각형이 된다.
넣으려면 로고만 남긴 투명 실루엣을 따로 만들어야 한다.
