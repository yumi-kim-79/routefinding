# CLAUDE.md

> 이 파일은 **Claude Code**가 프로젝트를 작업할 때 자동으로 읽는 컨벤션 파일이다.
> Claude Code가 이 프로젝트에서 작업을 시작할 때 가장 먼저 이 파일을 참조한다.

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
