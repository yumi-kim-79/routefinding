# RouteFinding v2 (루트파인딩)

자연암벽 & 인공벽 클라이머를 위한 루트 정보 & 커뮤니티 모바일 앱
(iOS · Android 동시 지원, React Native 기반)

---

## 🎯 프로젝트 개요

- **서비스**: 클라이밍 루트 데이터베이스 + GPX 트래킹 + 동호회 커뮤니티
- **타깃**: 자연암벽 등반가 + 인공벽 클라이머 (현재 사용자 약 50명)
- **차별화**: 멀티피치 지원, 산별 토포, NFC 인공벽 연동, 승인제 루트 리포트
- **개발자**: 유성 (앱몬스터)
- **착수일**: 2026년 5월 (Flutter v1.2.3 → React Native v2.0 마이그레이션)

### v1 → v2 전환 배경

- 기존 Flutter 코드베이스의 갓 파일(1000줄+) 4개로 인한 유지보수 한계
- RideTalk 등 신규 앱이 RN 기반 → 두 앱 일관된 스택 운영
- TypeScript 도입으로 타입 안정성 확보
- 폴더 구조 재정리 & 상태관리 도입을 통한 확장성 확보

---

## 📁 문서 구조 (`/docs`)

이 프로젝트의 모든 의사결정·명세는 `/docs` 폴더의 `.md` 파일에 기록된다.
**Claude Code는 작업 시작 전 반드시 관련 .md를 읽고, 작업 후 변경사항을 같은 파일에 업데이트한다.**

| 파일 | 내용 | 단계 |
|---|---|---|
| `docs/01_MVP_SPEC.md` | 기능 명세서 (기존 Flutter 기능 = MVP) | ✅ 1단계 |
| `docs/02_DATA_MODEL.md` | Firestore 데이터 모델 (기존 재사용) | ✅ 2단계 |
| `docs/03_TECH_STACK.md` | RN 기술 스택 및 프로젝트 구조 | ✅ 3단계 |
| `docs/04_WIREFRAMES.md` | 화면 와이어프레임 (기존 화면 매핑) | ⏳ 4단계 |
| `docs/05_ROADMAP.md` | 마이그레이션 단계별 로드맵 | ✅ 5단계 |
| `CHANGELOG.md` | 모든 문서·코드 변경 이력 | 항상 |
| `CLAUDE.md` | Claude Code 작업 컨벤션 | 항상 |
| `GETTING_STARTED.md` | 개발 환경 셋업 가이드 | 셋업 시 |

---

## 🌿 브랜치 전략

| 브랜치 | 용도 |
|---|---|
| `main` | **Flutter v1.x** (현재 운영 중, 긴급 패치만) |
| `v2` | **React Native v2.0** (이 브랜치, 신규 개발) |
| `v2/develop` | v2 기능 통합 브랜치 |
| `v2/feature/xxx` | 개별 기능 (예: `v2/feature/auth`) |
| `v2/hotfix/xxx` | 긴급 수정 |

> ⚠️ Flutter 코드는 `main` 브랜치에서만 관리한다. v2 브랜치에선 Flutter 파일을 모두 제거하고 RN으로 다시 시작한다.
> 기존 코드 참고가 필요하면 `git show main:lib/<file>` 로 조회.

---

## 🤖 Claude Code 운영 규칙 (기본 설정)

### 절대 원칙

1. **작업 시작 전**: 관련 `.md` 파일을 모두 읽는다 (`docs/` 폴더 전체 스캔)
2. **작업 진행 중**: 결정사항·구현내용을 메모리로만 두지 말고 즉시 .md에 반영
3. **작업 완료 후**: 변경된 .md 파일과 `CHANGELOG.md` 업데이트, 커밋 메시지에 어떤 .md를 수정했는지 명시
4. **불확실한 결정**: .md에 `[TBD]` 또는 `[QUESTION]` 태그로 표시하고 사용자에게 확인 요청

### 코드 작성 규칙

- **플랫폼 동시 고려**: 모든 기능은 iOS·Android 양쪽 동작을 검증해야 한다
- **플랫폼 분기 명시**: `Platform.OS === 'ios'` 분기는 주석으로 이유를 남긴다
- **네이티브 모듈 사용 시**: 사용 이유와 대안을 .md에 기록
- **외부 SDK 호출**: 비용 발생 가능성을 `docs/03_TECH_STACK.md`에 추적
- **Firebase 호출**: 기존 컬렉션 구조와 일치하는지 `docs/02_DATA_MODEL.md` 참조

### 커밋 컨벤션

```
<type>(<scope>): <subject>

[body]

Docs: 수정된 .md 파일 목록
```

타입:
- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서만 수정
- `refactor`: 리팩토링
- `chore`: 빌드/설정
- `test`: 테스트
- `migrate`: Flutter → RN 마이그레이션

예시:
```
migrate(auth): 로그인 화면 RN 이전

- LoginScreen.tsx 구현 (Flutter login_screen.dart 대응)
- Firebase Auth 연동
- 자동 로그인 로직 포함

Docs: 01_MVP_SPEC.md, CHANGELOG.md
```

---

## 🛠 기술 스택 요약

자세한 내용은 `docs/03_TECH_STACK.md` 참조

| 계층 | 기술 |
|---|---|
| 앱 (크로스플랫폼) | React Native 0.74+ (TypeScript) |
| 상태관리 | [TBD: Zustand 또는 Redux Toolkit] |
| 네비게이션 | React Navigation 6+ |
| 백엔드 | Firebase (Auth, Firestore, Storage, FCM, Functions) — **기존 프로젝트 재사용** |
| 지도 | [TBD: Google Maps (기존) vs Kakao Map (RideTalk과 통일)] |
| GPX | react-native-gpx-parser 등 (조사 필요) |
| 광고 | react-native-google-mobile-ads (AdMob) |
| NFC | react-native-nfc-manager |

---

## 📦 폴더 구조 (예정)

```
routefinding/                    ← v2 브랜치 루트
├── README.md                    ← 이 파일
├── CLAUDE.md                    ← Claude Code 컨벤션
├── CHANGELOG.md                 ← 변경 이력
├── GETTING_STARTED.md           ← 개발 환경 셋업
├── docs/                        ← 모든 .md 명세서
│   ├── 01_MVP_SPEC.md
│   ├── 02_DATA_MODEL.md
│   ├── 03_TECH_STACK.md
│   ├── 04_WIREFRAMES.md
│   └── 05_ROADMAP.md
├── app/                         ← React Native 앱
│   ├── ios/
│   ├── android/
│   ├── src/
│   │   ├── screens/             ← 화면 컴포넌트
│   │   ├── components/          ← 공통 컴포넌트
│   │   ├── services/            ← Firebase, 지도, NFC
│   │   ├── stores/              ← 상태 관리
│   │   ├── hooks/               ← 커스텀 훅
│   │   ├── navigation/          ← React Navigation
│   │   ├── types/               ← TypeScript 타입
│   │   ├── utils/               ← 유틸리티
│   │   ├── constants/           ← 상수
│   │   └── theme/               ← 디자인 시스템
│   └── package.json
├── functions/                   ← Firebase Cloud Functions (기존 재사용)
└── .github/
    └── workflows/               ← CI/CD (예정)
```

---

## 🚀 개발 단계 (현재 위치)

```
[0] 문서 작성              ← ✅ 진행 중 (이 단계)
[1] v2 브랜치 셋업 & RN 초기화
[2] Firebase 연결 & 인증 화면
[3] 핵심 화면 마이그레이션 (지도, 루트, 게시판)
[4] 부가 기능 (GPX, NFC, FCM, 광고)
[5] 베타 테스트 (현재 50명)
[6] v2.0 출시
```

자세한 일정은 `docs/05_ROADMAP.md` 참조.

---

## 📊 기존 앱(v1) 정보

| 항목 | 내용 |
|---|---|
| 프레임워크 | Flutter 3.7.2+ |
| 버전 | v1.2.3 (빌드 39) |
| 화면 수 | 46개 (.dart 파일) |
| 코드 라인 | 약 25,000줄 |
| 갓 파일 | 4개 (1000줄 초과) — v2에서 모두 분해 예정 |
| 사용자 수 | 약 50명 |
| 백엔드 | Firebase (그대로 v2에서 재사용) |

기존 코드 참조: `git checkout main` 또는 `git show main:lib/<file.dart>`

---

## 📞 사용자(개발자) 정보

- 이름: 유성 (yusungyun)
- GitHub: [@yumi-kim-79](https://github.com/yumi-kim-79)
- 회사: 앱몬스터
- 관련 프로젝트: [RideTalk](https://github.com/yumi-kim-79/ridetalk) (RN 패턴 참조)
- 개발 스택: React Native, Firebase, TypeScript, Flutter (전환 중)

---

## 📜 라이선스

Private (상업용 서비스, 외부 공개 금지)
