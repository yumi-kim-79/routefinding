# CLAUDE.md

> 이 파일은 **Claude Code**가 프로젝트를 작업할 때 자동으로 읽는 컨벤션 파일이다.
> Claude Code가 이 프로젝트에서 작업을 시작할 때 가장 먼저 이 파일을 참조한다.

---

## 📁 저장소 경로 규칙 (★)

| 저장소 | 경로 |
|---|---|
| RN 앱 | `/Users/yusungyun/StudioProjects/routefinding` |
| Vue 웹 | `/Users/yusungyun/routefinding-web` (⚠️ git 저장소 아님) |

- 둘 다 **맥북 내장 홈 폴더의 실제 폴더**다. 심볼릭 링크가 아니다.
- 문서·안내·명령어에는 **항상 `/Users/yusungyun/...` 절대경로**를 쓴다.
- 셸 명령어는 **`cd /Users/yusungyun/...` 를 포함해서** 그대로 복붙되게 준다.

> ⚠️ **`/Volumes/Dev/...` 경로는 쓰지 않는다.**
> 2026-08~09에 외장 디스크 이미지(`Dev.sparsebundle` → `/Volumes/Dev`)를 개발 루트로 쓰고
> 홈 폴더에 심볼릭 링크를 걸어 뒀던 시기가 있다. 9/28 장애 이후 **그 방식은 폐기**하고
> 9/30에 홈 폴더 실폴더로 복구했다. 외장에는 개발 파일을 두지 않고,
> 홈 폴더에 `/Volumes/...` 로 가는 심볼릭 링크도 만들지 않는다.

---

## 🚨 반드시 따라야 할 작업 절차

### 작업 시작 전 (BEFORE)

1. **`README.md`** 를 읽어 프로젝트 전체 컨텍스트 파악
2. **`docs/` 폴더의 모든 .md 파일** 을 스캔 (특히 작업 관련 문서)
3. **`CHANGELOG.md`** 를 읽어 최근 변경사항 확인
4. **현재 작업이 어느 단계(P0/P1/P2/P3)인지 확인** — 우선순위를 임의로 변경하지 않는다
5. **기존 Flutter 코드 참조가 필요하면** `git show main:lib/<파일명>` 명령어로 조회

### 작업 진행 중 (DURING)

1. 코드 변경과 동시에 관련 .md 파일을 업데이트한다 (메모리 보관 금지)
2. 결정한 내용은 모두 .md에 기록한다
3. 불확실한 결정은 `[TBD]` 또는 `[QUESTION]` 태그로 표시하고 사용자에게 확인 요청
4. iOS·Android 양쪽 영향을 모두 고려한다 (한쪽만 검증하지 않는다)
5. Flutter → RN 마이그레이션 시 기존 동작과 1:1 동등성 확인

### 작업 완료 후 (AFTER)

1. 변경된 .md 파일 목록을 정리
2. **`CHANGELOG.md`의 `[Unreleased]` 섹션에 변경 내용 추가**
3. 커밋 메시지 마지막 줄에 `Docs: <수정한 .md 파일 목록>` 명시
4. 사용자에게 "어떤 .md를 수정했고, 다음 단계 제안은 무엇인지" 보고

---

## 🔢 출시 버전 규칙 (사용자가 말하지 않아도 지킨다)

> 2026-08-29 사용자 지시: **"다음 빌드·배포 때 빌드 번호를 맞춰 줘. 내가 따로 이야기 안 해도."**

### 단일 소스
| 값 | 있는 곳 |
|---|---|
| versionName (앱 표시 버전) | `app/package.json` 의 `version` — Android versionName 이 여기서 온다 |
| Android versionCode | `app/android/app/build.gradle` 의 **기본값** (`-PROUTEFINDING_VERSION_CODE` 로 덮어쓰기 가능) |
| iOS 표시 버전 / 빌드 번호 | `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` (`project.pbxproj`, **2곳씩**) |

### 지켜야 할 것
1. **저장소에 적힌 값은 언제나 "다음에 낼 버전"이다.** 출시가 끝나면 곧바로 다음 값으로 올려 둔다.
   그래야 다음 빌드가 아무 옵션 없이도 맞는 번호로 나온다.
2. **출시 노트를 달라고 하면 = 출시 직전이다.** 버전 올리기를 함께 한다(사용자가 말하지 않아도).
3. **버전 세 자리(2.0.x)는 두 스토어를 항상 같게** 맞춘다. 빌드 번호(versionCode / 빌드)만 각자 간다.
4. Android `versionCode` 와 iOS 빌드 번호는 **한 번 올라가면 절대 못 내린다.** 스토어에 올라간 값을 다시 쓰면 거부된다.
5. 빌드 명령을 안내하기 전에 **산출물과 소스의 시각을 비교**한다. 소스가 더 새것일 때만 재빌드가 필요하다
6. **Remote Config `latest_version_*` 은 출시 다음 날 올린다.** (2026-09-01 사용자 지시)
   출시 당일에 올리면 "새 버전이 있습니다 → 스토어엔 '열기'" 를 사용자가 겪는다.
   스토어는 **게시 완료와 기기 배포가 별개**라, 각 기기의 Play/App Store 가 카탈로그를
   새로 받기까지 몇 시간~하루가 걸리기 때문이다.
   - 확인 지표: Play Console ▸ 최신 버전 및 번들 ▸ **'설치한 사용자 수' 가 0.00% 를 벗어남**
   - 출시 당일 할 일은 **업로드·출시까지**. RC 는 **다음 날 따로** 한다
   - 자세한 경위와 사용자 안내 문구는 `docs/11_UPDATE_GATE.md §2-0-2`.

### 출시 이력 (여기를 보고 다음 값을 정한다)
| 날짜 | Play (code / name) | App Store (name / build) |
|---|---|---|
| 2026-08-28 | — | 2.0.4 / 7 |
| 2026-08-29 | **106 / 2.0.4** | **2.0.5 / 8** |
| 2026-08-31 | **107 / 2.0.6** | **2.0.6 / 9** |
| 2026-08-31 (소진) | 108 · 109 / 2.0.7 | 2.0.6 / 9, 2.0.7 / 10 · 11 |
| 2026-09-01 **출시** | **110 / 2.0.8** | **2.0.8 / 11** |
| 다음 (저장소 현재 값) | **111 / 2.0.9** | **2.0.9 / 12** |

⚠️ **스토어에 실제로 나가 있는 최신은 Play 2.0.4(106) / App Store 2.0.5(8)** 이다.
   2.0.6·2.0.7 은 빌드·TestFlight 로만 소진됐다. 출시 노트를 쓸 때 기준은 **2.0.4 / 2.0.5** 다.

⚠️ **같은 2.0.x 안에서도 빌드 번호는 계속 올라간다.** TestFlight 에 한 번 올린 빌드 번호는
   다시 쓸 수 없다(Play 도 같은 versionCode 를 거부한다). 표시 버전(2.0.7)은 그대로 두고
   빌드 번호만 올리는 경우가 많다 — 그때도 저장소 값은 **다음에 낼 번호**로 유지한다.

⚠️ 2026-08-29 에 두 스토어의 표시 버전이 **어긋났었다**(Play 2.0.4 / App Store 2.0.5).
Android 를 package.json 을 올리기 **전에** 빌드했기 때문이다.
2.0.6 에서 다시 맞췄다. **버전을 먼저 올리고 빌드한다** — 이 순서를 지키면 다시 어긋나지 않는다.

---

## 📂 문서 우선순위

작업 시작 전 읽어야 할 문서를 우선순위대로 나열:

```
1. README.md                  ← 프로젝트 전체 개요 (필수)
2. CLAUDE.md                  ← 이 파일 (필수)
3. docs/01_MVP_SPEC.md        ← 기능 명세 (코딩 작업 시 필수)
4. docs/02_DATA_MODEL.md      ← 데이터 구조 (DB 작업 시 필수)
5. docs/03_TECH_STACK.md      ← 기술 결정 (라이브러리 선택 시 필수)
6. docs/04_WIREFRAMES.md      ← UI 구조 (화면 작업 시 필수)
7. docs/05_ROADMAP.md         ← 일정 (스프린트 시작 시 필수)
8. CHANGELOG.md               ← 변경 이력 (항상 마지막에 업데이트)
```

---

## 🔄 Flutter → RN 마이그레이션 특수 규칙

routefinding은 기존 Flutter 앱을 RN으로 다시 만드는 작업이다. 다음 규칙을 추가로 따른다:

### 기존 코드 참조 방법

```bash
# 특정 Flutter 파일 보기 (체크아웃 없이)
git show main:lib/login_screen.dart

# 특정 폴더 보기
git ls-tree main lib/

# 두 버전 비교 (예시)
git diff main:lib/login_screen.dart v2/app/src/screens/auth/LoginScreen.tsx
```

### 1:1 대응 원칙

- 각 화면 마이그레이션 시 **기존 Flutter 화면의 모든 기능을 보존**한다 (MVP)
- 새 기능 추가는 **v2.0 출시 후 v2.1+에서** 진행한다
- 기능 변경/제거는 사용자 명시적 승인 필요 (`[QUESTION]` 태그 사용)

### 매핑 추적

- 각 화면 작업 시 `docs/04_WIREFRAMES.md`에 매핑 추가:
  ```
  | 화면 | Flutter | RN | 상태 |
  | 로그인 | lib/login_screen.dart (305줄) | app/src/screens/auth/LoginScreen.tsx | ✅ 완료 |
  ```

### 갓 파일 분해 원칙

기존 Flutter의 1000줄+ 파일을 RN으로 옮길 때, **반드시 분해**한다:

| Flutter 파일 | 분해 후 RN 구조 |
|---|---|
| `map_input_screen.dart` (1618줄) | `MapInputScreen.tsx` + 5~7개 컴포넌트 + 2~3개 훅 |
| `generic_route_detail_screen.dart` (1402줄) | `RouteDetailScreen.tsx` + 컴포넌트 분리 |
| `mypage_screen.dart` (1163줄) | `MyPageScreen.tsx` + 탭별 분리 |
| `crew_detail_screen.dart` (1049줄) | `CrewDetailScreen.tsx` + 섹션별 분리 |

---

## ⌨️ 키보드 · 하단 고정 UI (2026-09-07 확정)

이 앱은 `targetSdk 36` + `edgeToEdgeEnabled=true` 다.
**안드로이드 15(API 35)부터 edge-to-edge 에서는 `adjustResize` 가 무시되어,
키보드가 떠도 창이 줄지 않는다.**

그래서 다음 두 가지는 **이 프로젝트에서 쓰지 말 것** — 아무 일도 하지 않는다:

- ❌ `KeyboardAvoidingView` (줄어든 창 높이로 계산하므로 결과가 항상 0)
- ❌ "하단에 넉넉히 여백을 준다" 식의 고정 padding

대신:

- 스크롤이 있는 폼 → **`components/common/KeyboardAwareScroll`** 을 쓴다
  (자리 비우기 + 포커스된 칸 자동 밀어올리기까지 한다)
- 하단에 **고정된** 입력 바·도구 바 → **`hooks/useKeyboardSpace()`** 의 `space` 만큼
  컨테이너 아래를 직접 줄인다

⚠️ `useSafeAreaInsets().bottom` 만 주면 **키보드가 뜬 순간 그대로 덮인다.**
   인셋은 내비게이션 바만 피할 뿐이다.

⚠️ 새 화면에 `TextInput` 을 넣었다면 **키보드를 올린 상태로 실기기에서 확인**할 것.
   "스크롤하면 보인다"는 통과가 아니다 — 누른 칸이 **바로 보여야** 한다.

## ⚠️ 절대 하면 안 되는 것

- ❌ 우선순위(P0/P1/P2/P3)를 사용자 확인 없이 변경
- ❌ MVP에서 명시적으로 제외(P3)된 기능을 임의로 추가
- ❌ 외부 SDK/라이브러리를 .md에 기록 없이 도입
- ❌ Firebase 데이터 구조를 `docs/02_DATA_MODEL.md` 업데이트 없이 변경
- ❌ iOS만 또는 Android만 동작하는 기능을 양쪽 검증 없이 머지
- ❌ 결제·인증·푸시처럼 실제 비용·보안과 연결된 기능을 테스트 없이 main 머지
- ❌ `[TBD]` 표시된 항목을 사용자에게 확인 없이 임의 결정
- ❌ **기존 Firebase 데이터 스키마 변경** (현재 50명 유저 데이터 보호) — 변경 필요 시 마이그레이션 스크립트와 함께 설계
- ❌ **`v2` 브랜치에서 Flutter 코드 복원** — Flutter는 `main` 브랜치에서만 관리
- ❌ **`main` 브랜치에 v2 코드 푸시** (별도 출시 시점에 v2 → main 머지 전까지)

---

## 🌟 코드 작성 원칙

### TypeScript 우선

- 모든 .js 파일은 .ts/.tsx로 작성
- `any` 타입 금지, 명확한 타입 정의
- Firestore 데이터는 `src/types/` 에 정의된 타입으로 변환 후 사용

### 플랫폼 분기

```typescript
// 좋은 예: 분기 이유를 주석으로 명시
if (Platform.OS === 'ios') {
  // iOS의 NFC는 사용자가 명시적으로 시작해야 함 (Android는 자동)
  await NfcManager.requestSession();
}

// 나쁜 예: 이유 없이 분기
if (Platform.OS === 'ios') {
  doSomething();
}
```

### 외부 서비스 호출

- 비용 발생 호출(Firebase 쓰기, AdMob 노출 등)은 별도 service 모듈로 분리
- 호출 횟수와 비용을 `docs/03_TECH_STACK.md`에서 추적
- Firestore 쿼리는 가능한 한 캐싱 (특히 `concepts/{mountain}/routes` 같은 자주 안 바뀌는 데이터)

### Firebase 사용 원칙

- **기존 컬렉션 구조 변경 금지** (`docs/02_DATA_MODEL.md` 참조)
- Firestore Rules 변경 시 별도 PR로 분리, 사용자 승인 필수
- App Check 유지 (기존 v1에서 이미 적용됨)
- FCM 토큰은 기존 `users/{userId}.fcmToken` 필드 그대로 사용

### 에러 처리

- 위치 권한 거부, 네트워크 단절은 사용자 친화적 메시지로 표시
- 산속/등반장 사용 환경 고려 — 큰 글자, 큰 버튼, 오프라인 대응
- 자연암벽 사용 환경 = GPS 약함, 네트워크 불안정 → 캐싱과 폴백 필수

### 디자인 시스템

- `src/theme/` 에서 색상, 타이포, 간격 정의
- 화면 내 색상 하드코딩 금지 → 항상 theme에서 가져오기
- 다크모드 처음부터 고려

---

## 🔍 작업 시작 시 체크리스트

Claude Code가 새 세션을 시작할 때 다음 순서로 진행:

- [ ] `README.md` 읽음
- [ ] 작업 관련 `docs/0X_*.md` 파일 읽음
- [ ] `CHANGELOG.md` 의 `[Unreleased]` 확인
- [ ] 사용자가 요청한 작업이 P0/P1/P2/P3 중 어디 속하는지 판단
- [ ] 작업 범위가 MVP에 포함되는지 확인 (P3에 들어있으면 사용자 확인 필요)
- [ ] (마이그레이션 작업이면) 대응하는 Flutter 파일을 `git show main:lib/<파일>` 로 확인
- [ ] 작업 완료 후 .md 업데이트 + CHANGELOG 추가 + 커밋 메시지 작성

---

## 💬 사용자와 소통 규칙

- 결정이 필요한 시점에 멈추고 묻는다 (혼자 결정하지 않는다)
- 한 번에 하나씩 묻는다 (질문 폭격 금지)
- 답변에 우선순위 추천(P0/P1/P2/P3 분류)을 포함한다
- 비용/시간이 많이 드는 결정은 대안 2~3개를 제시한다
- Flutter 코드와 다르게 구현해야 할 부분은 이유를 명시하고 사용자에게 확인

---

## 🛠 개발 환경

- Node.js 20.x LTS
- npm 또는 yarn (yarn 권장)
- React Native 0.74+ (TypeScript)
- Xcode 15+ (iOS)
- Android Studio Hedgehog+ (Android)
- Firebase CLI
- Git

자세한 셋업은 `GETTING_STARTED.md` 참조.

---

## 🔗 관련 프로젝트

- **RideTalk** ([github.com/yumi-kim-79/ridetalk](https://github.com/yumi-kim-79/ridetalk))
  - 동일 개발자의 RN 앱 (참조용 패턴)
  - 폴더 구조, CLAUDE.md, 문서 구조 모두 동일하게 채택

- **routefinding v1 (Flutter)** ([main 브랜치](https://github.com/yumi-kim-79/routefinding/tree/main))
  - 현재 운영 중인 Flutter 앱 (~50명 사용)
  - v2 마이그레이션의 기능 명세 원천

---

이 파일이 수정될 경우 `CHANGELOG.md`에 반드시 기록한다.
