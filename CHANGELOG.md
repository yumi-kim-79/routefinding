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

### 🌿 브랜치

#### Added
- `v2` 브랜치 생성 (예정)
  - Flutter 파일 제거 후 RN 코드 시작

### ⚠️ 해결 대기 ([TBD])
- [TBD] 상태관리 라이브러리 (Zustand vs Redux Toolkit) — RideTalk 패턴 확인 후 결정
- [TBD] 지도 SDK (Google Maps vs Kakao Map) — 사용자 결정 필요
- [TBD] 디자인 토큰 (RideTalk 것 그대로 vs 새로 설계)
- [TBD] iOS/Android 패키지명 (기존 그대로 vs v2 신규)

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
