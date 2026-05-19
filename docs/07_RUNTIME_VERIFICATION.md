# 🧪 07_RUNTIME_VERIFICATION.md — 런타임 검증 기록

> Phase별 에뮬레이터/실기기 런타임 검증 결과와 트러블슈팅 교훈 누적.
> 빌드/타입 게이트와 별개로 "실제 실행되는지" 확인 기록.

---

## Phase 1 — 2026-05-19 (Android 에뮬레이터)

**환경**: Android 에뮬레이터(Pixel, API 34+), Node 20.20.2, RN 0.76.9, yarn Berry 3.6.4, Firebase `routefinding09-4b597`. iOS는 1-2.5 보류 트랙(미검증).

### 결과

| # | 항목 | 결과 |
|---|---|---|
| 1 | Splash → Login 흐름 | ✅ |
| 2 | 회원가입 → 이메일 인증 → 게이트 통과 | ✅ |
| 3 | 로그인 성공 → MainTabs 진입 | ✅ |
| 4 | 4탭 표시 (게시판/개념도/지도/마이페이지) | ✅ |
| 5 | 게시판 탭 플레이스홀더 표시 | ✅ ("v1 탭0 /board") |
| 6 | 디자인 토큰 (primary blue/타이포/간격) | ✅ |
| 7 | 4탭 아이콘 자리 | ✅ (X 표시 = 아이콘 라이브러리 `[TBD]`, 의도된 상태) |
| 8 | 각 탭 클릭 전환 | ⏳ 선택 검증 (미확인) |
| 9 | 앱 완전 종료 후 자동 로그인 복원 | ⏳ 선택 검증 (미확인) |

→ **핵심 인증/네비/디자인 흐름 런타임 동작 확인**. 8·9는 선택 항목으로 추후 확인.

### 결론
Phase 1 (1-1~1-6) **Android 기준 기능 완료 + 런타임 검증 통과**.
iOS 빌드는 `docs/06_iOS_BUILD_NOTES.md` 보류 트랙 유지(별도).

---

## 🐞 트러블슈팅 교훈

### Notifee "native module not found" 빨간 화면 (스테일 번들)

**증상**: `EarlyJsError: Notifee native module not found.` (`NotifeeNativeModule@... / NotifeeApiModule@...`)

**진단 사실**: `@notifee/react-native`는 프로젝트·node_modules(앱/부모/홈)·`@react-native-firebase/*`·yarn.lock **어디에도 없음**. `@react-native-firebase/messaging` v24는 notifee를 import하지 않음. 즉 **의존성 문제 아님**.

**실제 원인**: 디바이스/Metro의 **스테일 번들**. RN 0.76 bridgeless split-bundle 환경에서 이전 상태의 번들이 남아 실행됨.

**해결**: **Metro 8081 점유 프로세스 정리 + 깨끗한 Metro 재시작** (옵션 D 변형). 1차 클린(uninstall/gradlew clean/`$TMPDIR/metro-*`/reset-cache)만으론 부족했고, **포트 점유 좀비 Metro**가 옛 번들을 계속 서빙한 것이 핵심.

**다음에 동일 증상 시 체크리스트**:
1. `lsof -ti:8081 | xargs kill -9` (좀비 Metro 종료) — **가장 효과적**
2. `adb uninstall com.yusung.routefinding`
3. `watchman watch-del-all`
4. `rm -rf $TMPDIR/metro-* node_modules/.cache`
5. 에뮬레이터 콜드 부트(`-no-snapshot-load`) 고려
6. `corepack yarn start --reset-cache` → 새 터미널 `corepack yarn android`
7. 그래도면 → 서빙 번들 직접 확인:
   `curl -s 'http://localhost:8081/index.bundle?platform=android&dev=true&minify=false' -o /tmp/rf.bundle` 후 모듈 경로 추적

**교훈**: "코드/의존성에 없는데 번들에 있다" = 거의 항상 **스테일/좀비 Metro·디바이스 캐시**. 의존성(설치/다운그레이드)부터 건드리면 양파 까기. **포트 점유 프로세스 정리**를 클린 절차 1순위로.

---

---

## Phase 2-1 — 다음 세션 검증 대기 (2026-05-19 시점 미확인)

> 아래는 typecheck/Android 빌드만 통과, **런타임 미확인**. 다음 세션에서 확인.

### 사전 절차 (필수 — 좀비 Metro 교훈)

```bash
lsof -ti:8081 | xargs kill -9 2>/dev/null     # ← 1순위
adb uninstall com.yusung.routefinding 2>/dev/null
watchman watch-del-all 2>/dev/null; rm -rf $TMPDIR/metro-* node_modules/.cache
# 에뮬레이터 wipe(콜드부트) → corepack yarn start --reset-cache / corepack yarn android
```

### 체크리스트

| # | 항목 | 기대 |
|---|---|---|
| 1 | 하단 **5탭** 표시 | 게시판/개념도/루트 위치/크루/마이페이지 (v1 home_screen 1:1) |
| 2 | 탭 전환 | 5탭 각 placeholder 정상 전환 |
| 3 | 마이페이지 진입 | ProfileHeader(아바타+닉네임+로그아웃) + 5탭 스위처(내 제보 관리/내글/내댓글/MY ROUTE/마이프로필) |
| 4 | MyPage 탭 스위처 | 가로 스크롤 탭 선택 시 본문 전환, 활성 탭 primary 색 |
| 5 | ProfileWithCrown | 등급별 테두리색(5.15 gold…5.7 blue/그외 lightBlue), 5.15/14/13만 👑, 사진 없으면 👤 |
| 6 | 로그아웃 | ProfileHeader 로그아웃 → Auth 스택 복귀 |
| 7 | (Phase 1 잔여) | 앱 완전 종료 후 자동 로그인 복원, 탭 클릭 전환 |

→ 결과 ✅/❌ + ❌면 logcat/Metro 스택 원문. 큰 결정·양파면 멈추고 보고.

---

*Phase별 검증 시 이 문서에 결과/교훈을 누적한다.*
