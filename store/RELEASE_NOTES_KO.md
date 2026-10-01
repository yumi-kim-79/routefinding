# 출시 노트 (v2.5.0) — 2026-09-30

| | 값 |
|---|---|
| versionName / MARKETING_VERSION | **2.5.0** |
| Android versionCode | **117** (build.gradle 기본값 — `-P` 불필요) |
| iOS CURRENT_PROJECT_VERSION | **18** |

직전 공개: 양 스토어 **2.4.0**(폐쇄 안내).

⚠️ **이번 변경의 대부분은 관리자 전용**이다(실시간 접속 대시보드·회원 목록).
   일반 사용자에게 보이는 것은 광고 위치 수정과 개인정보 보호 강화뿐이므로
   출시 노트를 그 기준으로 짧게 쓴다. **관리자 기능은 적지 않는다** —
   사용자에게 의미가 없고, 심사자에게는 불필요한 질문거리만 만든다.

## ✅ 배포 전에 끝나 있어야 하는 것
- [x] Realtime Database 생성 (asia-southeast1) + 설정 파일 2개 교체
- [x] `database` · `firestore:rules` · `functions` 배포
- [x] `countPresence` 가 **asia-southeast1** 에 올라감
- [x] `tsc` · `eslint` 0 errors, 실기기 검증 완료
- [ ] 🚨 **웹 개인정보처리방침 배포** — 시행일이 **10월 1일**이다. 앱보다 먼저 올라가야 한다
- [ ] 🚨 **App Store 앱 개인정보 설문 수정** — 아래 참고
- [ ] Play 데이터 보안 양식

### 🚨 App Store 앱 개인정보 설문 — 반드시 고칠 것
접속 현황을 uid 에 묶어 보게 됐으므로,
**「사용 데이터 ▸ 제품 상호 작용」을 '사용자에게 연결되지 않음' → '연결됨' 으로 바꾼다.**
안 바꾸면 신고 내용과 실제가 달라 다음 심사에서 문제가 된다.
나머지 7개 항목과 '추적 = 아니요' 는 그대로 둔다.

---

## 배포

```bash
# ── ① 웹 개인정보처리방침 (앱보다 먼저) ──────────
cd /Users/yusungyun/routefinding-web
unset FIREBASE_TOKEN
firebase deploy --only hosting \
  --account routefinding2025@gmail.com \
  --project routefinding09-4b597
# 확인: https://routefinding09-4b597.web.app/privacy 에 '시행일: 2026년 10월 1일'

# ── ② Android (AAB) ─────────────────────────────
cd /Users/yusungyun/StudioProjects/routefinding/app/android
./gradlew bundleRelease
open app/build/outputs/bundle/release/

# ── ③ iOS ───────────────────────────────────────
cd /Users/yusungyun/StudioProjects/routefinding/app/ios
pod install
open RouteFinding.xcworkspace
# 'Any iOS Device' ▸ Product ▸ Archive ▸ Distribute App ▸ App Store Connect
```

⚠️ `./gradlew clean` 금지 (fbjni prefab 경로가 깨진다).
⚠️ versionCode 117 은 build.gradle 기본값이라 `-P` 를 붙이지 않는다.
⚠️ **App Store Connect 에서 2.5.0 버전을 새로 만들고**(배포 ▸ iOS 앱 옆 [+]) build 18 을 붙인다.
   「버전 출시」는 **"수동으로 이 버전 출시"** 로 둔다.
⚠️ iOS 는 **네이티브 모듈(@react-native-firebase/database)이 늘었으므로 `pod install` 필수**다.

---

## Play 스토어 — "이 업데이트의 새로운 기능" (302자 / 500자 제한)

```
광고가 화면을 가리던 문제를 고쳤습니다.

■ 고친 것
커뮤니티와 마이페이지에서 하단 광고가 다른 화면보다 위로 올라와 내용을 가리던 문제를 고쳤습니다.

■ 개인정보 보호 강화
회원 정보를 조회할 수 있는 범위를 좁혔습니다. 다른 이용자의 이메일 주소는 조회할 수 없습니다.

■ 개인정보처리방침 개정 (10월 1일 시행)
서비스 운영을 위해 접속 현황을 확인하는 기능이 추가되었습니다. 누가 언제 접속했는지에 대한 개인별 기록은 남기지 않습니다.

■ 그 밖에
앱 버전이 마이페이지 프로필 아래에 표시됩니다. 문의하실 때 확인해 주세요.
```

## App Store — "새로운 기능"

```
광고가 화면을 가리던 문제를 고쳤습니다.

■ 고친 것
커뮤니티와 마이페이지에서 하단 광고가 다른 화면보다 위로 올라와 내용을 가리던 문제를
고쳤습니다. 이제 모든 화면에서 같은 위치에 표시됩니다.

■ 개인정보 보호 강화
회원 정보를 조회할 수 있는 범위를 좁혔습니다. 다른 이용자의 이메일 주소는 조회할 수 없습니다.

■ 개인정보처리방침 개정 (10월 1일 시행)
서비스 운영과 장애 대응을 위해 접속 현황을 확인하는 기능이 추가되었습니다.
앱을 사용하는 동안에만 접속 중으로 표시되며, 앱을 닫으면 즉시 사라집니다.
누가 언제 접속해서 언제까지 있었는지에 대한 개인별 접속 기록은 남기지 않습니다.
보관되는 것은 날짜별 접속자 수뿐입니다.
자세한 내용은 개인정보처리방침을 확인해 주세요.

■ 그 밖에
앱 버전이 마이페이지 프로필 아래에 표시됩니다. 문의하실 때 확인해 주세요.

안전한 등반 되세요.
```

## 심사 메모에 덧붙일 것 (App Store)

```
== What changed in 2.5.0 ==
· Fixed the bottom ad banner position on two tabs, where a duplicated safe-area
  inset pushed it over the content.
· Tightened Firestore rules: the user collection can no longer be listed by
  ordinary signed-in users, only fetched one document at a time. This prevents
  enumeration of other members' email addresses.
· Added an administrator-only view of current sign-in activity, used for
  operations and outage response. It shows who is using the app right now and
  daily totals. No per-user session history is stored - only daily counts and a
  "last seen date" per user. The privacy policy was updated accordingly
  (effective 2026-10-01).
```

---

# 출시 노트 (v2.4.0) — 2026-09-15

| | 값 |
|---|---|
| versionName / MARKETING_VERSION | **2.4.0** |
| Android versionCode | **116** (build.gradle 기본값 — `-P` 불필요) |
| iOS CURRENT_PROJECT_VERSION | **17** |

직전 공개: 양 스토어 **2.3.0**(즐겨찾기 목록 · 대표 사진 30장).
이번 내용은 **폐쇄 안내 하나**다.

⚠️ 9/14 에 만든 `app-release.aab` 는 **versionCode 115** 라 이미 올라간 것과 겹친다.
   `app-release-2.3.0-115.aab.old` 로 이름을 바꿔 뒀다. 새로 빌드해서 쓸 것.

## ✅ 배포 전 확인
- [x] `tsc` · `eslint` 0 errors
- [x] 실기기 검증 완료 (구역 폐쇄 → 상세 안내창 · 배너 · 목록 배지)
- [ ] 🚨 **Firestore 규칙이 먼저 배포돼 있어야 한다** — 아래 참고
- [x] 색인 불필요 (`closure.closed` 는 Firestore 가 단일 필드 색인을 자동 생성)
- [x] Functions 변경 없음

### 🚨 규칙을 먼저 배포한다
앱을 먼저 내보내면 **관리자가 폐쇄를 저장할 때 거부된다.**
이번 규칙 변경은 보안 수정이기도 하다 — `crags.closure` 를 관리자 전용으로 막았고,
루트 작성자가 자기 루트의 폐쇄를 스스로 풀 수 있던 구멍을 닫았다.

```bash
cd /Users/yusungyun/StudioProjects/routefinding
unset FIREBASE_TOKEN
firebase deploy --only firestore:rules \
  --account routefinding2025@gmail.com \
  --project routefinding09-4b597
```

## 빌드

```bash
# ── Android (AAB) ─────────────────────────────
cd /Users/yusungyun/StudioProjects/routefinding/app/android
./gradlew bundleRelease
open app/build/outputs/bundle/release/

# ── iOS ───────────────────────────────────────
cd /Users/yusungyun/StudioProjects/routefinding/app/ios
pod install
open RouteFinding.xcworkspace
# 'Any iOS Device' ▸ Product ▸ Archive ▸ Distribute App ▸ App Store Connect
```

⚠️ `./gradlew clean` 금지 (fbjni prefab 경로가 깨진다).
   꼬이면 `./gradlew --stop; rm -rf app/.cxx app/build build .gradle`
⚠️ versionCode 116 은 build.gradle 기본값이라 `-P` 를 붙이지 않는다.
⚠️ App Store Connect 에서 **2.4.0 버전을 새로 만들고**(배포 ▸ iOS 앱 옆 [+]) build 17 을 붙인다.
   「버전 출시」는 **"수동으로 이 버전 출시"** 로 둔다.

---

## Play 스토어 — "이 업데이트의 새로운 기능"

```
등반이 제한된 루트를 알려드립니다.

■ 폐쇄 안내
사유지 분쟁·낙석·산불 등으로 등반이 제한된 루트와 구역에 안내가 표시됩니다.
개념도를 열면 안내창이 뜨고, 닫아도 화면 위에 표시가 남습니다.
목록과 지도에서도 폐쇄된 루트를 바로 알아볼 수 있습니다.

개념도와 사진은 폐쇄 중에도 그대로 보실 수 있고, 정보 제보와 수정도 계속 하실 수 있습니다.
폐쇄가 풀리면 안내는 사라집니다.

현장 상황은 바뀔 수 있으니 가시기 전에 한 번 더 확인해 주세요.
```

## App Store — "새로운 기능"

```
등반이 제한된 루트를 알려드립니다.

■ 폐쇄 안내
사유지 분쟁, 낙석, 산불, 문화재 보수처럼 한동안 등반이 제한되는 경우가 있습니다.
이제 그런 루트와 구역에 안내가 표시됩니다.

· 개념도를 열면 안내창이 뜹니다. 닫기를 누르면 바로 내용을 보실 수 있습니다.
· 닫은 뒤에도 화면 맨 위에 표시가 남습니다. 눌러서 다시 볼 수 있습니다.
· 개념도 목록과 지도에서도 폐쇄된 루트를 바로 알아볼 수 있습니다.
· 암장 정보 화면에서도 확인하실 수 있습니다.

■ 폐쇄되어도 자료는 그대로입니다
개념도와 사진, 피치와 난이도는 폐쇄 중에도 그대로 보실 수 있습니다.
정보 제보와 수정, 완등 기록도 계속 하실 수 있습니다.
폐쇄가 풀리면 안내만 사라지고 원래대로 돌아옵니다.

현장 상황은 바뀔 수 있습니다. 가시기 전에 관리 기관이나 지역 클라이머에게
한 번 더 확인해 주세요. 잘못된 내용이 있으면 마이페이지 ▸ 문의로 알려주시면
바로 고치겠습니다.

안전한 등반 되세요.
```

---

# 출시 노트 (v2.3.0) — 2026-09-14

| | 값 |
|---|---|
| versionName / MARKETING_VERSION | **2.3.0** |
| Android versionCode | **115** (build.gradle 기본값 — `-P` 불필요) |
| iOS CURRENT_PROJECT_VERSION | **16** |

직전 공개: 양 스토어 **2.2.x**. 이번엔 두 스토어 사용자가 같은 자리에서 올라오므로
**출시 노트를 양쪽 같은 내용으로 쓴다** (2.2.1 때와 다른 점 — 그때는 iOS 에 2.2.0 이
나간 적이 없어서 노트를 따로 썼다).

## ✅ 배포 전 확인
- [x] `tsc` · `eslint` 0 errors
- [x] **Firestore 규칙·색인 배포 불필요** — 즐겨찾기는 `users/{uid}/my_routes` 이고
      규칙이 `isOwner(userId)` 라 쿼리에 조건을 더 붙이지 않아도 통과한다.
      (완등 목록 사고와 다른 점. 66차 참고)
- [x] Functions 변경 없음
- [ ] 실기기: 개념도 첫 화면 즐겨찾기 · 지도 ★ 칩 · 마이페이지 탭 · 사진 10장 이상 업로드

## ⚠️ 알려진 불일치
**웹(routefinding-web)은 대표 사진이 아직 8장이다.** 앱에서 30장으로 올린 제보를
웹에서 **수정하면 8장으로 잘린다.** 웹을 손볼 때 `src/views/ConceptEditView.vue` 의
상한을 같이 올릴 것. (지금은 웹에서 개념도를 수정하는 사람이 관리자뿐이라 보류)

---

## Play 스토어 — "이 업데이트의 새로운 기능" (247자 / 500자 제한)

```
즐겨찾기를 이제 모아서 볼 수 있습니다.

■ 즐겨찾기 목록
★를 누른 루트를 개념도 탭 첫 화면, 지도, 마이페이지에서 바로 볼 수 있습니다. 눌러서 상세로 들어갑니다. 지도에서는 ★ 칩으로 즐겨찾기만 골라 볼 수 있습니다.

■ 대표 사진 30장
멀티피치 루트를 위해 루트 제보의 대표 사진을 8장에서 30장으로 늘렸습니다. 올리는 동안 몇 장째인지 표시됩니다.

■ 고친 것
즐겨찾기를 눌렀을 때 엉뚱한 화면이 열리던 문제를 고쳤습니다.
```

## App Store — "새로운 기능" (4,000자 제한)

```
즐겨찾기를 이제 모아서 볼 수 있습니다.

■ 즐겨찾기 목록
★를 누른 루트가 세 곳에 모입니다.
· 개념도 탭 — 검색하기 전 첫 화면에 바로 보입니다
· 지도 — 상단 ★ 칩을 누르면 즐겨찾기한 루트만 지도에 남습니다
· 마이페이지 ▸ 즐겨찾기 — 등반지·루트명으로 찾을 수 있습니다
목록에서 누르면 개념도 상세로 바로 들어가고, ★를 다시 누르면 그 자리에서 해제됩니다.

■ 대표 사진을 30장까지
멀티피치 루트는 사진 여덟 장으로는 설명이 안 된다는 의견을 주셨습니다.
루트 제보의 대표 사진을 8장에서 30장으로 늘렸습니다.
여러 장을 올릴 때는 지금 몇 장째인지 보여드립니다.

■ 고친 것
즐겨찾기한 루트를 눌렀을 때 엉뚱한 화면이 열리던 문제를 고쳤습니다.

안전한 등반 되세요.
```

## 🚨 App Store Connect — 새 버전을 **만들어야** 한다
2.2.0 버전 기록은 이미 배포됐다. 거기에 새 빌드를 붙일 수 없다.
**배포 ▸ iOS 앱 옆 [+] ▸ 2.3.0** 으로 새 버전을 만든 뒤 build 16 을 붙인다.

⚠️ 2.2.0 때 **ASC 버전 표기(2.2.0)와 빌드 버전(2.2.1)이 어긋난 채로 나갔다.**
   이번엔 ASC 버전도 `2.3.0`, `MARKETING_VERSION` 도 2.3.0 이라 맞는다. 이 상태를 유지할 것.
⚠️ 「버전 출시」는 **"수동으로 이 버전 출시"** 로 둔다.

---

# 출시 노트 (v2.2.1) — 2026-09-08

| | 값 |
|---|---|
| versionName / MARKETING_VERSION | **2.2.1** |
| Android versionCode | **114** (build.gradle 기본값 — `-P` 불필요) |
| iOS CURRENT_PROJECT_VERSION | **15** |

2.2.0(113) 은 Play 에 나갔다가 완등 목록 `permission-denied` 로 2.2.1 이 대체한다.
App Store 2.2.0 은 심사 대기 중 **취소**했으므로 애플 쪽에는 2.2.1 이 첫 공개다.

⚠️ **두 스토어의 출시 노트가 서로 다르다. 아래 이유 때문에 바꿔 쓰면 안 된다.**

| 스토어 | 사용자가 올라오는 지점 | 그래서 |
|---|---|---|
| Play | 2.0.9 또는 2.2.0 | 아직 2.0.9 인 사람이 대부분이다. Play 는 **최신 노트 하나만** 보여주므로 2.2.0 기능 설명을 그대로 싣고 고친 것을 뒤에 붙인다 |
| App Store | 2.0.9 | 2.2.0 이 나간 적이 없다. **버그 수정을 적으면 안 된다** — 사용자가 겪은 적 없는 문제다 |

---

## Play 스토어 — "이 업데이트의 새로운 기능" (383자 / 500자 제한)

```
커뮤니티와 완등 기록이 생겼습니다.

■ 완등 기록
오른 루트를 남기면 루트마다 별점과 완등한 사람이 쌓입니다. 등반일지에서 루트를 고르면 완등도 함께 기록됩니다.

■ 도전 중
아직 못 깬 루트를 담아 두세요. 완등하면 자동으로 빠집니다.

■ 커뮤니티
자유·등반지·중고거래·파티 모집 게시판과 댓글. 등반일지를 공개할 수 있습니다.

■ 암장 정보
접근 방법·주차·대중교통·화장실·식수를 클라이머 누구나 채울 수 있습니다.

■ 베타 영상
루트마다 유튜브·인스타 영상을 붙여 동작을 미리 봅니다.

■ 그 밖에
루트 제보가 승인 없이 바로 올라갑니다. 개념도 목록이 구역별로 묶입니다. 지도가 내 위치 주변에서 시작합니다.

■ 고친 것
완등 목록이 보이지 않던 문제를 고쳤습니다.
```

## App Store — "새로운 기능" (4,000자 제한)

> 버그 수정 문구를 넣지 않는다. 애플 쪽엔 2.2.0 이 나간 적이 없다.

```
루트파인딩에 커뮤니티와 등반 기록이 생겼습니다.

■ 완등 기록
오른 루트를 남겨 보세요. 등반 스타일(온사이트·플래시·레드포인트·톱로핑·세컨), 별점,
시도 횟수, 신은 암벽화, 한 줄 메모를 함께 남길 수 있습니다.
기록이 쌓이면 루트마다 평균 별점과 완등한 사람이 보이고, 마이페이지에서 내 완등 수와
최고 난이도, 다녀온 등반지를 한눈에 볼 수 있습니다.
공개하고 싶지 않은 기록은 '나만 보기'로 남기면 됩니다.

■ 등반일지와 완등 기록이 이어졌습니다
일지를 쓸 때 오른 루트를 고르면 장소와 루트명이 자동으로 채워지고, 완등 기록도 함께 남습니다.
전에 완등한 루트는 검색 없이 바로 고를 수 있습니다.

■ 도전 중
아직 못 깬 루트를 담아 두세요. '붙음'을 눌러 시도 횟수를 세고, 완등을 기록하면
목록에서 자동으로 빠집니다.

■ 커뮤니티
자유 · 등반지 · 중고거래 · 파티 모집 게시판이 생겼습니다. 사진과 글을 올리고 댓글로
이야기할 수 있습니다. 등반일지를 커뮤니티에 공개할 수도 있습니다.
불쾌한 글은 신고하거나 그 사용자를 차단할 수 있고, 신고는 24시간 안에 확인합니다.

■ 암장 정보
접근 방법, 주차, 대중교통, 일조, 추천 시즌, 화장실과 식수 정보를 볼 수 있습니다.
클라이머라면 누구나 이 정보를 채울 수 있고, 채운 분의 닉네임이 남습니다.
등반 금지나 낙석 같은 경고는 화면 맨 위에 표시됩니다.

■ 베타 영상
루트마다 유튜브·인스타그램 등반 영상을 붙일 수 있습니다. 가기 전에 동작을 미리 보세요.

■ 난이도 채우기
난이도가 비어 있는 루트에서 알려주실 수 있습니다. 같은 난이도를 여러 분이 알려주면
자동으로 반영됩니다.

■ 그 밖에 달라진 것
· 루트 제보가 운영자 승인 없이 바로 올라갑니다. 잘못된 정보는 수정 제안으로 고칠 수 있습니다.
· 개념도 목록이 구역별로 묶여 보기 편해졌습니다.
· 지도를 열면 내 위치 주변에서 시작합니다.
· 등반일지에 사진을 넣을 수 있습니다.

안전한 등반 되세요.
```

---

# 출시 노트 (v2.2.0) — 2026-09-08

| | 값 |
|---|---|
| versionName / MARKETING_VERSION | **2.2.0** |
| Android versionCode | **113** (build.gradle 기본값 — `-P` 불필요) |
| iOS CURRENT_PROJECT_VERSION | **14** |

직전 공개 버전: 양 스토어 **2.0.9**(9/3).
⚠️ **2.1.0(커뮤니티)은 스토어에 안 나갔다.** 2.2.0 에 2.1.0 내용이 전부 포함된다 —
사용자에게는 **커뮤니티가 이번에 처음 생기는 것**이므로 출시 노트에 같이 적는다.

## ✅ 배포 전 확인 (이미 끝났어야 하는 것)
- [x] `firestore.rules` · `firestore.indexes.json` 배포
- [x] `functions` 배포 (`countSend` · `applyDifficultySuggestion` · `syncPublicLog` · `countCommunityComment` · `generateThumbnail`)
- [x] Storage 규칙에 `post_images/` · `log_images/`
- [x] 게시판 5개 생성 (자유 · 등반지 · 중고거래 · **파티 모집** · 등반일지)
- [x] `sends` 색인 3개 '사용 설정됨'

## 빌드

```bash
# ── Android (AAB) ─────────────────────────────
cd /Users/yusungyun/StudioProjects/routefinding/app/android
./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
open app/build/outputs/bundle/release/

# ── iOS ───────────────────────────────────────
cd /Users/yusungyun/StudioProjects/routefinding/app/ios
pod install
open RouteFinding.xcworkspace
# Xcode ▸ 기기 대상을 'Any iOS Device' ▸ Product ▸ Archive ▸ Distribute App
```

⚠️ `./gradlew clean` 은 쓰지 않는다 (fbjni prefab 경로가 깨진다).
   지워야 하면 `./gradlew --stop; rm -rf app/.cxx app/build build .gradle`
⚠️ versionCode 113 은 build.gradle 기본값이라 `-P` 를 붙이지 않는다.

## Play 스토어 / App Store 공통 (Play 제한 500자)

```
커뮤니티와 완등 기록이 생겼습니다.

■ 완등 기록
오른 루트를 남기면 루트마다 별점과 완등한 사람이 쌓입니다. 등반일지에서 루트를 고르면 완등도 함께 기록됩니다.

■ 도전 중
아직 못 깬 루트를 담아 두세요. 완등하면 자동으로 빠집니다.

■ 커뮤니티
자유·등반지·중고거래·파티 모집 게시판과 댓글. 등반일지를 공개할 수 있습니다.

■ 암장 정보
접근 방법·주차·대중교통·화장실·식수를 클라이머 누구나 채울 수 있습니다.

■ 베타 영상
루트마다 유튜브·인스타 영상을 붙여 동작을 미리 봅니다.

■ 그 밖에
루트 제보가 승인 없이 바로 올라갑니다. 개념도 목록이 구역별로 묶입니다. 지도가 내 위치 주변에서 시작합니다.
```

## App Store 심사 메모 (Review Notes)

> ⚠️ **사용자 생성 콘텐츠(UGC)가 들어간 첫 공개 버전**이다. 심사지침 1.2 대응을
>    적지 않으면 반려된다. 이 앱은 이미 4번 반려된 이력이 있다.

```
This version adds user-generated content (community boards, route comments,
send logs, crag information).
Safeguards, all shipped in this build:
· Report: tap ⋯ on any post or comment → 6 report reasons.
· Block: tap ⋯ → Block this user. Managed under My Page ▸ My Profile ▸ Blocked users.
· Auto-hide: content reaching 3 reports is hidden before moderator review.
· Moderation: admin reviews reports under My Page ▸ 신고 관리, within 24 hours.
· Terms: users must accept community rules (zero tolerance for objectionable
  content and abusive users) before their first post.
· Profanity filter blocks obvious abuse at submit time; contact details are
  blocked in the marketplace and partner-finding boards.
· Crag info and route corrections are logged with the editor's name and can be
  reverted by the admin.
Contact for content issues: yusung790926@gmail.com
```

## 출시 **다음 날**

- Remote Config `latest_version_android` / `latest_version_ios` 를 **2.2.0** 으로 게시
- ⚠️ **당일에 올리지 않는다.** Play 는 게시 직후에도 기기까지 퍼지는 데 시간이 걸려서,
  아직 못 받은 사용자에게 업데이트 안내만 뜨고 스토어에는 '열기' 만 보인다(53차 사고).

## 출시 후 볼 것 (사용자 피드백 받기)

| 지표 | 어디서 | 뜻 |
|---|---|---|
| `sends` 문서 수 | Firestore | 완등 기록이 실제로 쌓이는가 — **v2.5 랭킹의 조건(1,000건)** |
| `difficulty_suggestions` | Firestore | 난이도 제안이 들어오는가 (리드 97% 공백) |
| `crags` 문서 수 | Firestore | 접근 정보를 사용자가 채우는가 |
| `community_posts` | Firestore | 게시판별로 어디가 살아나는가 |
| 마이페이지 ▸ 문의 | 앱 | 버그·요청 |
| 마이페이지 ▸ 🔧 수정 제안 | 앱 | 데이터 오류 제보 |

---

# 출시 노트 (v2.1.0) — 2026-09-07

| | 값 |
|---|---|
| versionName / MARKETING_VERSION | **2.1.0** |
| Android versionCode | **112** (build.gradle 기본값 — `-P` 불필요) |
| iOS CURRENT_PROJECT_VERSION | **13** |

직전 공개 버전: **양 스토어 모두 2.0.9**(9/3 출시).
이번 것은 기능 추가라 **마이너를 올렸다**(2.0.x → 2.1.0).

## ⚠️ 앱을 올리기 **전에** 끝내야 하는 것

이 넷 중 하나라도 빠지면 커뮤니티 탭이 **빈 화면**이 된다.

```bash
# 0) ⚠️ 이 셸에 CI 토큰이 남아 있으면 계정이 조용히 바뀐다
unset FIREBASE_TOKEN

cd /Users/yusungyun/StudioProjects/routefinding

# 1) 보안 규칙 + 복합 색인
firebase deploy --only firestore:rules,firestore:indexes \
  --account routefinding2025@gmail.com --project routefinding09-4b597

# 2) 게시판 4개 만들기 (한 번만)
cd functions && node ../tools/seed_boards.js && cd ..

# 3) Cloud Functions (댓글 수 카운터 + post_images 썸네일)
# ⚠️ 런타임을 Node 22 로 올렸다 → 함수 전체가 재배포된다. 개별 지정하지 말고 한 번에.
firebase deploy --only functions \
  --account routefinding2025@gmail.com --project routefinding09-4b597

# 배포 후 썸네일이 계속 만들어지는지 한 번 본다 (sharp 네이티브 바이너리)
firebase functions:log --only generateThumbnail \
  --account routefinding2025@gmail.com --project routefinding09-4b597
```

## ⚠️ Storage 규칙 (콘솔에서 직접 — 저장소에 파일이 없다)

새 경로 **두 개**를 로그인 사용자가 쓸 수 있어야 한다. 안 열면 사진 업로드가 실패한다.

```
match /post_images/{postId}/{file}  { allow read: if true; allow write: if request.auth != null; }
match /log_images/{uid}/{logId}/{file} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.uid == uid;
}
```

⚠️ 복합 색인은 **만들어지는 데 몇 분 걸린다.** 콘솔 ▸ Firestore ▸ 색인에서
'사용 설정됨' 으로 바뀐 것을 확인하고 앱을 심사에 올린다.

## 빌드

```bash
cd /Users/yusungyun/StudioProjects/routefinding/app

# Android (AAB) — versionCode 112 는 build.gradle 기본값이라 -P 가 필요 없다
cd android && ./gradlew bundleRelease && cd ..
# 산출물: android/app/build/outputs/bundle/release/app-release.aab

# iOS
cd ios && pod install && cd ..
# Xcode ▸ Product ▸ Archive ▸ Distribute App
```

⚠️ `./gradlew clean` 은 이 프로젝트에서 쓰지 않는다 (fbjni prefab 경로가 깨진다).
   지워야 하면 `./gradlew --stop; rm -rf app/.cxx app/build build .gradle`.

## Play 스토어 / App Store 공통 (Play 제한 500자)

```
커뮤니티가 열렸습니다.

■ 게시판
자유·등반지·중고거래 게시판에 사진과 글을 올리고 댓글로 이야기할 수 있습니다.

■ 등반지 게시판
어느 바위를 다녀왔는지, 바위 상태와 접근로가 어땠는지 나눠 보세요.

■ 중고거래
쓰지 않는 장비를 회원끼리 사고팔 수 있습니다. 직거래를 권장하며, 선입금을 요구하는 상대를 조심하세요.
로프·하네스·헬멧처럼 추락 하중을 받는 장비는 이력을 알 수 없는 중고 거래를 권하지 않습니다.

■ 등반일지 공개
등반일지에 사진을 넣을 수 있고, 원하는 일지만 골라 커뮤니티에 공개할 수 있습니다. 공개를 끄면 바로 내려갑니다.

■ 안전
불쾌한 글은 신고하거나 그 사용자를 차단할 수 있습니다. 신고는 24시간 안에 확인합니다.
```

## App Store 심사 메모 (Review Notes 에 넣을 것)

> ⚠️ 이번 버전은 **사용자 생성 콘텐츠(UGC)** 가 처음 들어간다. 심사지침 1.2 대응을
>    적어 주지 않으면 반려된다.

```
This version adds user-generated content (community boards).
Safeguards, all shipped in this build:
· Report: tap ⋯ on any post or comment → 6 report reasons.
· Block: tap ⋯ → Block this user. Managed under My Page ▸ My Profile ▸ Blocked users.
· Auto-hide: content reaching 3 reports is hidden before moderator review.
· Moderation: admin account reviews reports under My Page ▸ 신고 관리, within 24 hours.
· Terms: users must accept community rules (zero tolerance for objectionable
  content and abusive users) before their first post.
· Profanity filter blocks obvious abuse at submit time.
Contact for content issues: yusung790926@gmail.com
```

## 출시 다음 날

- Remote Config `latest_version_android` / `latest_version_ios` 를 **2.1.0** 으로 게시한다.
- ⚠️ **출시 당일에 올리지 않는다.** Play 는 게시 직후에도 기기까지 퍼지는 데 시간이 걸려서,
  아직 못 받은 사용자에게 업데이트 안내만 뜨고 스토어에는 '열기' 만 보인다(53차 사고).

---

# 출시 노트 (v2.0.0)

> Play 스토어 '이 업데이트의 새로운 기능'은 **500자 제한**이다.
> ⚠️ v1(1.2.3) 사용자가 이 업데이트를 받는다. **없어진 기능을 밝히지 않으면 문의가 들어온다.**

---

## Play 스토어 — 이 업데이트의 새로운 기능

```
루트파인딩이 v2로 새롭게 바뀌었습니다.

■ 지도
전국 암벽 루트를 한 화면에서 봅니다. 가까이 있는 루트는 묶어서 표시합니다.

■ 개념도
등반지·구역·루트명으로 검색하고, 사진 위에 그려진 등반 라인을 확대해서 볼 수 있습니다.

■ 루트제보
사진을 찍어 그 자리에서 라인과 글자를 그려 제보할 수 있습니다. 보고 있던 개념도에서 바로 제보하면 등반지·구역·좌표가 자동으로 채워집니다.

■ 등반일지
날짜·장소·동반자·장비·소요 시간을 기록하고 검색할 수 있습니다.

■ 그 밖에
· 즐겨찾기
· 접근로 GPX 보기
· 실행 속도 개선, 앱 용량 축소

※ 게시판과 크루 기능은 이번 개편에서 제외되었습니다.
```

---

## App Store — '이 버전의 새로운 기능'

**첫 출시에는 필요 없다**(앱 설명이 그 역할을 한다).
다음 업데이트부터 위 내용을 같은 형식으로 넣으면 된다.

---

## 다음 버전부터 쓰는 요령

- **바뀐 것만** 쓴다. 기능 소개는 앱 설명(`METADATA_KO.md`)의 몫이다.
- **없어지거나 달라진 것을 먼저** 쓴다. 사용자가 궁금해하는 건 그쪽이다.
- 버그 수정은 "안정성 개선" 같은 뭉뚱그린 말 대신 **무엇이 고쳐졌는지** 적는다.
  (예: "사진 업로드 중 앱이 종료되던 문제 수정")

---

# 출시 노트 (v2.0.5) — 2026-08-29

| | 값 |
|---|---|
| versionName / MARKETING_VERSION | **2.0.5** |
| Android versionCode | **106** (`-PROUTEFINDING_VERSION_CODE=106`) |
| iOS CURRENT_PROJECT_VERSION | **8** |

⚠️ **Play 와 App Store 의 직전 공개 버전이 다르다.**
- App Store: 2.0.4 출시됨 → 2.0.5 는 **피치 수정만** 안내하면 된다
- Play: 공개 버전은 **2.0.3** (2.0.4/105 는 빌드만 하고 올리지 않았다)
  → Play 노트는 **2.0.4 내용까지 함께** 담는다

## Play 스토어 — 이 업데이트의 새로운 기능 (335자 / 제한 500자)

```
■ 사진이 훨씬 빨라졌습니다
개념도를 열면 사진이 곧바로 보이고, 사진이 많은 루트도 기다림 없이 넘어갑니다.

■ 고친 것
· 피치를 누르면 그 피치의 사진과 정보를 볼 수 있습니다 (루트 대표 사진이 열리던 문제)
· 사진을 받는 중인데 '사진 없음'으로 보이던 문제
· 뒤로가기를 누르면 목록을 건너뛰고 지도까지 나가던 문제
· 프로필 사진과 일부 목록 사진이 보이지 않던 문제
· 전체화면에서 손가락으로 확대·축소가 안 되던 문제

■ 새로 생긴 것
· 문의하기 — 마이페이지에서 의견·오류를 보내고 답변을 받습니다
· 사진 편집기 '보기' 모드 — 선을 그리지 않고 확대해서 볼 수 있습니다
```

## App Store — 이 버전의 새로운 기능

```
피치 상세 화면이 추가되었습니다.

· 피치를 누르면 그 피치의 사진과 정보(길이·등반 형태·난이도·장비)를 볼 수 있습니다.
  이전에는 루트의 첫 사진이 열려 피치 사진을 볼 수 없었습니다.
· 피치에 사진이 여러 장이면 모두 볼 수 있습니다.
· 검토 중인 사진을 눌렀을 때 다른 사진이 열리던 문제도 함께 고쳤습니다.
```

## 심사 답변 (필요할 때)
코드 변경만 있는 버그 수정 업데이트다. 권한·수집 데이터·연령 등급에 바뀐 것이 없다.

---

# 출시 노트 (v2.0.9) — 2026-09-03

| | 값 |
|---|---|
| versionName / MARKETING_VERSION | **2.0.9** |
| Android versionCode | **111** (build.gradle 기본값 — `-P` 불필요) |
| iOS CURRENT_PROJECT_VERSION | **12** |

직전 공개 버전: **양 스토어 모두 2.0.8**(9/1 출시).
따라서 2.0.9 에 새로 담기는 것은 **54차(버전 표시) + 53차(업데이트 안내 개선)** 둘뿐이다.
44~52차는 이미 2.0.8 로 나갔으므로 노트에 다시 적지 않는다.

## Play 스토어 / App Store 공통 (108자 / Play 제한 500자)

```
· 마이페이지 아래에서 설치된 앱 버전을 확인할 수 있습니다.
· 업데이트 안내 화면을 다듬었습니다. 스토어에 새 버전이 아직 올라오지 않은 동안에도 안내를 닫고 앱을 그대로 사용할 수 있습니다.
```

## 심사 답변 (필요할 때)
표시 항목 추가와 안내 화면 개선이다. 권한·수집 데이터·연령 등급에 바뀐 것이 없다.

## ⚠️ 출시 후 (규칙: RC 는 다음 날)
- 출시 당일에는 **Remote Config 를 건드리지 않는다.**
- 다음 날 Play Console ▸ 최신 버전 및 번들의 **'설치한 사용자 수' 가 0.00% 를 벗어나면**
  `latest_version_android` / `latest_version_ios` 를 **2.0.9** 로 게시한다.
- ⚠️ 현재 RC 는 **2.0.7** 로 내려가 있다. **2.0.8 을 거치지 말고 2.0.9 로 한 번에** 올린다
  (2.0.8 사용자도 어차피 2.0.9 로 올라가야 하므로 RC 를 두 번 만질 이유가 없다).

---

# 출시 노트 (v2.0.8) — 2026-08-31

| | 값 |
|---|---|
| versionName / MARKETING_VERSION | **2.0.8** |
| Android versionCode | **110** (build.gradle 기본값 — `-P` 불필요) |
| iOS CURRENT_PROJECT_VERSION | **11** |

⚠️ **2.0.6 · 2.0.7 은 스토어에 나가지 않았다**(빌드·TestFlight 로 번호만 소진).
스토어 최신은 **Play 2.0.4(106) / App Store 2.0.5(8)** 이므로,
아래 노트는 그 사용자들이 받는 기준으로 **44~52차를 모두** 담았다.

담긴 작업: 44~52차
(피치 상세 화면 · 큰 화면 지원 · 비트맵 메모리 · iOS 하단 안전영역 · 목록 썸네일 제거 ·
 목록 두 줄 재구성 · 요약 항목 보강 · 상세 빠른 작업 2×2 · 상세 순서 정리)

## Play 스토어 — 이 업데이트의 새로운 기능 (430자 / 제한 500자)

```
■ 목록이 훨씬 빨라졌습니다
개념도 목록에서 썸네일을 없애 글자만 보여줍니다. 스크롤이 부드럽고 데이터도 덜 씁니다. 한 화면에 보이는 루트 수도 늘었습니다.

■ 보이는 정보가 많아졌습니다
· 목록에 난이도·길이·등반 형태·장비·피치 수가 함께 나옵니다
· 지도에서 연 목록도 개념도 탭과 똑같이 보입니다

■ 피치 상세가 생겼습니다
· 피치를 누르면 그 피치의 사진과 정보(길이·형태·난이도·장비)를 봅니다
· 사진은 옆으로 넘겨 보고, 기기 화면에 맞춰 크기가 조절됩니다

■ 루트 상세 정리
· 사진 → 기본 정보 → 피치 → 접근로 순으로 먼저 보여줍니다
· 길찾기·등반일지·즐겨찾기·사진 등록은 아래 '빠른 작업'에 모았습니다

■ 그 밖에
· 태블릿·크롬북처럼 GPS 없는 큰 화면 기기에서도 설치할 수 있습니다
· 사진을 그릴 때 쓰는 메모리를 줄였습니다
```

## App Store — 이 버전의 새로운 기능

```
목록은 가볍게, 정보는 더 많이 보이도록 다듬었습니다.

■ 개념도 목록
· 썸네일 대신 글자만 보여줍니다. 스크롤이 부드럽고 한 화면에 보이는 루트가 늘었습니다.
· 난이도·길이·등반 형태·장비·피치 수가 함께 나옵니다.
· 지도에서 연 목록도 개념도 탭과 똑같이 보입니다.

■ 피치 상세
· 피치를 누르면 그 피치의 사진과 정보(길이·등반 형태·난이도·장비)를 볼 수 있습니다.
· 사진은 옆으로 넘겨 보고, 기기 화면에 맞춰 크기가 조절됩니다.
· 화면이 짧은 아이폰에서 아래 정보가 가리던 문제를 고쳤습니다.

■ 루트 상세
· 사진 → 기본 정보 → 피치 → 접근로 순으로 내용을 먼저 보여줍니다.
· 길찾기·등반일지·즐겨찾기·사진 등록은 아래 '빠른 작업'에 모았습니다.
```

## 심사 답변 (필요할 때)
UI 정리와 버그 수정이다. 권한·수집 데이터·연령 등급에 바뀐 것이 없다.

## ⚠️ '큰 화면 기기' 줄은 Play 에만
`uses-feature required="false"` 로 **설치 가능 기기가 늘어난다**(태블릿·크롬북).
iOS 는 아이폰 전용(`TARGETED_DEVICE_FAMILY = 1`) 그대로라 이 줄을 넣지 않는다.

## ⚠️ 노트에 넣지 않은 것
R8 전체 모드 명시, 뷰어 사진 목록 버그, 관리자 버튼 이동 —
사용자에게 보이는 변화가 아니거나 관리자만 쓰는 기능이다.
