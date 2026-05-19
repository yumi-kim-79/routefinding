# 📋 CHANGELOG

이 프로젝트의 모든 변경 사항은 이 파일에 기록된다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 를 따른다.
버전 관리는 [Semantic Versioning](https://semver.org/lang/ko/) 을 따른다.

---

## [Unreleased] — v2.0 마이그레이션 진행 중

### 📁 문서

#### Added
- `README.md` 작성 (RideTalk 패턴 채택)
- `CLAUDE.md` 작성 (Claude Code 작업 컨벤션)
- `docs/01_MVP_SPEC.md` 작성 (기존 Flutter 기능 = MVP)
- `docs/02_DATA_MODEL.md` 작성 (Firestore 모델, 기존 구조 유지)
- `docs/03_TECH_STACK.md` 작성 (RN + Firebase 스택)
- `docs/04_WIREFRAMES.md` 작성 (Flutter → RN 매핑표)
- `docs/05_ROADMAP.md` 작성 (5 Phase 마이그레이션 계획)
- `GETTING_STARTED.md` 작성 (개발 환경 셋업 가이드)
- `CHANGELOG.md` 작성 (이 파일)

### 🏗️ 코드 / 셋업 (Phase 1 — 2026-05-19)

#### Added
- `app/` 에 **React Native 0.76.9** 프로젝트 초기화 (`@react-native-community/cli`, TypeScript 템플릿)
  - 앱명 `RouteFinding` → iOS `RouteFinding.xcworkspace` (GETTING_STARTED.md와 일치)
  - 의존성 설치 완료 (yarn Berry, `node_modules` 생성)
  - `package.json`에 `typecheck`(tsc --noEmit), `clean`(react-native clean) 스크립트 추가
- `app/package.json`에 `packageManager: yarn@3.6.4` 핀
- 개발 환경 결정 확정: Node 20.x LTS(v20.20.2, nvm), RN 0.76.9, yarn Berry 3.6.4
- **`app/src/` 폴더 구조 생성** — `03_TECH_STACK.md` 확정 구조 그대로 27개 디렉터리, 각 폴더에 `.gitkeep` + 용도 설명 `README.md`
  - `App.tsx` → `src/App.tsx` 이동, `index.js`·`__tests__/App.test.tsx` import 경로 갱신
  - 타입체크(`yarn typecheck`) 통과 확인

#### Removed
- 루트의 v1 잔재 파일 git 추적 제거 (전량 `~/Backups/routefinding-data/`에 백업됨)
  - `bouldering_data.csv`, `routes.json`, `approach.gpx` — 일반 루트/샘플 시드 데이터 (v2는 Firestore가 원천, NFC 원천 `*_nfc.csv` 아님)
  - 루트 `package.json`, `package-lock.json` — RN 앱은 `app/`로 이동되어 루트 툴링 불필요
  - 판별 결과 NFC 원천 파일 없음 → `docs/data-archive/` 보존 불필요

#### Changed
- **번들 ID를 기존 v1 그대로 유지하도록 네이티브 프로젝트 수정**
  - Android: `namespace`/`applicationId`/Java 패키지 → `com.yusung.routefinding` (전체 리네임)
  - iOS: 앱 타깃 `PRODUCT_BUNDLE_IDENTIFIER` → `com.yusungyun.RouteFinding`, 테스트 타깃 → `com.yusungyun.RouteFinding.tests`
  - 사유: 기존 Firebase 앱·50명 유저 무중단 전환
- **패키지 매니저: yarn classic 1.22 계획 → yarn Berry 3.6.4 채택**
  - 사유: 시스템 환경이 이미 Berry로 통일됨(다른 Vue/Firebase 프로젝트), classic yarn deprecated, 매번 `YARN_IGNORE_PATH=1` 우회 부담 제거, 모던 기준
  - 관련 docs(`03_TECH_STACK.md`, `GETTING_STARTED.md`)를 yarn 3.x(Berry) 기준으로 갱신

### 🌿 브랜치

#### Added
- `v2` 브랜치 (현재 활성, Flutter 잔재 정리 완료 → RN 코드 시작)

### ⚠️ 해결 대기 ([TBD])
- [TBD] 상태관리 라이브러리 (Zustand vs Redux Toolkit) — RideTalk 패턴 확인 후 결정
- [TBD] 지도 SDK (Google Maps vs Kakao Map) — 사용자 결정 필요
- [TBD] 디자인 토큰 (RideTalk 것 그대로 vs 새로 설계)
- ~~[TBD] iOS/Android 패키지명 (기존 그대로 vs v2 신규)~~ → ✅ **해결**: 기존 v1 그대로 유지 (2026-05-19)

### ❓ 질문 ([QUESTION])
- [QUESTION] 하단 탭바 정확한 구성
- [QUESTION] 갓 파일 4개의 내부 기능 상세 (map_input, generic_route_detail, mypage, crew_detail)
- [QUESTION] 이미지 에디터의 정확한 용도
- [QUESTION] 크루 채팅방의 백엔드 (Firestore vs RTDB)
- [QUESTION] 인공벽 매장 시스템 도입 시점 (v2.0 vs v2.1+)

---

## [1.2.3] — Flutter 기존 버전 (현재 운영 중)

### 📊 현황
- 빌드 번호: 39
- 사용자: 약 50명
- 플랫폼: Android, iOS
- 백엔드: Firebase
- 코드: Flutter 3.7.2+, Dart

→ 이 버전은 v2.0 출시 시까지 `main` 브랜치에서 유지. 긴급 패치만 적용.

---

*변경 사항 추가 시 [Unreleased] 섹션 최상단에 기록. 출시 시 버전 번호로 이동.*
