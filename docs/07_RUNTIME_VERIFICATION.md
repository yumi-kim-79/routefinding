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

*Phase별 검증 시 이 문서에 결과/교훈을 누적한다.*
