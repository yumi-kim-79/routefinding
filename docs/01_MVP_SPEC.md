# 📋 01_MVP_SPEC.md — MVP 기능 명세서

> **목적**: routefinding v2 (RN)의 MVP 범위 정의
> **원칙**: 기존 Flutter v1.2.3의 모든 기능 = v2 MVP. 신규 기능은 v2.0 출시 후 추가.

---

## 🎯 MVP 정의

> **"v1.2.3 사용자가 v2로 전환해도 잃는 기능이 없어야 한다"**

기존 Flutter 화면 46개를 모두 RN으로 이전한다.
새 기능 추가는 v2.1+에서 진행한다 (`05_ROADMAP.md` 참조).

---

## 📊 우선순위 시스템

| 순위 | 의미 | 적용 |
|---|---|---|
| **P0** | Critical — 없으면 앱이 안 돌아감 | 인증, 메인 네비게이션 |
| **P1** | High — 핵심 기능 | 지도, 루트 상세, 게시판, 크루 |
| **P2** | Medium — 보조 기능 | 알림, 마이페이지, 이미지 에디터 |
| **P3** | Nice to have — v2.1+로 미룰 수 있음 | AI 추천, 등반 통계 |

---

## 🗂️ 도메인 영역

routefinding은 **3개 도메인**이 결합된 앱:

```
1. 클라이밍 데이터    ← 자연암벽 루트, 인공벽 정보
2. 트래킹 & 지도      ← GPS, GPX, 접근로
3. 커뮤니티           ← 게시판, 댓글, 크루(동호회)
```

추가로:
```
4. 사용자 시스템      ← 인증, 프로필, 알림
5. 관리자 시스템      ← 루트 리포트 승인
```

---

## 1. 🔐 인증 (P0)

### 1.1 스플래시 (P0)
- **기존**: `lib/splash_screen.dart`
- **기능**:
  - 앱 첫 실행 또는 버전 업데이트 시 표시
  - splash_video.mp4 재생 (영상 스플래시)
  - 자동 로그인 체크 → 홈 또는 로그인 화면으로 분기
- **마이그레이션 노트**: react-native-video 사용

### 1.2 로그인 (P0)
- **기존**: `lib/login_screen.dart` (305줄)
- **기능**:
  - 이메일/비밀번호 로그인
  - "비밀번호 찾기"
  - "회원가입" 링크
  - 자동 로그인 (FirebaseAuth `currentUser` 체크)
- **Firebase**: Firebase Auth

### 1.3 회원가입 (P0)
- **기존**: `lib/sign_up_screen.dart` (305줄)
- **기능**:
  - 이메일/비밀번호/닉네임 입력
  - 이메일 인증
  - 프로필 사진 업로드
  - 약관 동의

---

## 2. 🏠 메인 네비게이션 (P0)

### 2.1 홈 화면 (P0)
- **기존**: `lib/home_screen.dart`
- **기능**:
  - 메인 진입점
  - 공지사항 표시
  - 최근 루트 리포트
  - 빠른 진입 (지도, 크루, 게시판)

### 2.2 하단 탭바 (P0)
- **기존**: `lib/bottom_nav_bar.dart`
- **탭 구성**: [QUESTION] 정확한 탭 구성 확인 필요
  - 홈
  - 지도/루트
  - 게시판
  - 크루
  - 마이페이지

---

## 3. 🗺️ 지도 & 루트 (P1)

### 3.1 지도 화면 (P1)
- **기존**: `lib/map_screen.dart` (711줄)
- **기능**:
  - Google Maps [TBD: Google vs Kakao] 지도 표시
  - 산/등반지 마커 (클러스터링)
  - 사용자 위치 표시
  - 마커 탭 → 루트 상세
- **패키지**: react-native-maps

### 3.2 지도 입력/편집 (P1) 🚨 갓 파일
- **기존**: `lib/map_input_screen.dart` (**1618줄**)
- **기능**: [TBD: 정확한 기능 확인 필요]
  - 새 등반지 위치 등록
  - GPX 업로드/표시
  - 접근로(approach) 그리기
  - 마커 편집
- **마이그레이션 노트**: 반드시 5~7개 컴포넌트로 분해

### 3.3 루트 화면 (P1)
- **기존**: `lib/route_screen.dart`
- **기능**: 루트 목록/검색

### 3.4 컨셉(산) 리스트 (P1)
- **기존**: `lib/concept_list_screen.dart` (595줄)
- **기능**:
  - 산별 루트 토포 표시
  - Firestore: `concepts/{mountain}/routes/`

### 3.5 루트 상세 (P1) 🚨 갓 파일
- **기존**: `lib/generic_route_detail_screen.dart` (**1402줄**)
- **기능**: [TBD: 정확한 기능 확인 필요]
  - 루트 정보 (등급, 길이, 피치 수)
  - 사진/토포
  - 등반 기록
  - 후기/평가
- **마이그레이션 노트**: 탭/섹션 컴포넌트로 분해

### 3.6 피치 상세 (P1)
- **기존**: `lib/pitch_detail_screen.dart`
- **기능**: 멀티피치 루트의 각 피치 상세
- **Firestore**: `route_reports/{reportId}/pitches/{pitchId}`

---

## 4. 📋 루트 리포트 (P1)

### 4.1 리포트 목록 (P1)
- **기존**: `lib/route_report_list_screen.dart`, `lib/report_list_screen.dart`
- **기능**: 승인된 루트 리포트 목록
- **Firestore**: `route_reports/` (status='approved')

### 4.2 리포트 상세 (P1)
- **기존**: `lib/report_detail_screen.dart`
- **기능**: 리포트 상세 + 피치 목록

### 4.3 리포트 작성 (P1)
- **기존**: [QUESTION] 별도 화면 없음? `map_input_screen.dart`에 포함?
- **기능**: 사용자가 새 루트 리포트 작성

### 4.4 관리자 승인 화면 (P2)
- **기존**: `lib/route_report_admin_screen.dart`
- **기능**:
  - 대기 중인 리포트 검토
  - 승인/반려
- **권한**: 관리자만 (현재 하드코딩: `yusung790926@gmail.com` → v2에선 Custom Claims로 이전)

---

## 5. 🥾 트래킹 (P1)

### 5.1 접근로 트래킹 (P1)
- **기존**: `lib/screens/approach_tracking_screen.dart`
- **기능**:
  - GPS 실시간 위치
  - 접근로 GPX 표시
  - 경로 안내

### 5.2 등반 트래킹 (P1)
- **기존**: `lib/screens/tracking_screen.dart` (422줄)
- **기능**:
  - 등반 시작/종료
  - GPS 기록
  - 등반 통계

### 5.3 GPX 액션 (P1)
- **기존**: `lib/widgets/gpx_action_buttons.dart`
- **기능**:
  - GPX 파일 공유
  - GPX 저장
  - GPX 외부 앱으로 열기

---

## 6. 👥 크루 (동호회) (P1)

### 6.1 크루 메인 (P1)
- **기존**: `lib/crew_main_screen.dart`
- **기능**: 크루 목록, 검색, 가입

### 6.2 크루 생성 (P1)
- **기존**: `lib/crew_create_screen.dart`
- **기능**: 새 크루 만들기

### 6.3 크루 상세 (P1) 🚨 갓 파일
- **기존**: `lib/crew_detail_screen.dart` (**1049줄**)
- **기능**: [TBD: 정확한 기능 확인 필요]
  - 크루 정보
  - 멤버 목록
  - 크루 게시판
  - 채팅방 진입
- **마이그레이션 노트**: 탭별로 분해

### 6.4 크루 가입 신청 (P1)
- **기존**: `lib/crew_join_form_screen.dart`
- **기능**: 크루 가입 신청서 작성

### 6.5 크루 게시판 (P1)
- **기존**: `lib/crew_board_tab.dart`, `lib/crew_post_*.dart` (4개)
- **기능**:
  - 크루 내 게시글 목록/작성/상세

### 6.6 크루 채팅방 (P1)
- **기존**: `lib/CrewChatRoomScreen.dart`
- **기능**: 크루원끼리 채팅
- **Firebase**: Firestore 기반 [QUESTION] 또는 RTDB?

---

## 7. 📋 게시판 (P1)

### 7.1 게시판 메인 (P1)
- **기존**: `lib/board_screen.dart` (443줄), `lib/notice_board_screen.dart`
- **기능**: 카테고리별 게시글 목록

### 7.2 카테고리별 게시글 (P1)
- **기존**: `lib/category_posts_screen.dart`
- **기능**: 카테고리 필터링

### 7.3 게시글 상세 (P1)
- **기존**: `lib/post_detail_screen.dart` (990줄)
- **기능**:
  - 게시글 본문
  - 댓글/대댓글
  - 좋아요/스크랩

### 7.4 게시글 작성/수정 (P1)
- **기존**: `lib/write_post_screen.dart`, `lib/edit_post_screen.dart`
- **기능**: 글 작성/수정, 이미지 첨부

### 7.5 댓글 상세 (P1)
- **기존**: `lib/comment_detail_screen.dart` (624줄)
- **기능**: 댓글 + 대댓글 관리

---

## 8. 👤 사용자 (P1~P2)

### 8.1 마이페이지 (P1) 🚨 갓 파일
- **기존**: `lib/mypage_screen.dart` (**1163줄**)
- **기능**: [TBD: 정확한 기능 확인 필요]
  - 내 프로필
  - 내 등반 기록 (`users/{userId}/my_routes/`)
  - 내가 쓴 글/댓글
  - 등급/뱃지
  - 설정
- **마이그레이션 노트**: 탭으로 분해 (프로필/기록/내 글/설정)

### 8.2 사용자 프로필 (P1)
- **기존**: `lib/user_profile_screen.dart` (351줄)
- **기능**: 다른 사용자 프로필 보기

### 8.3 프로필 위젯 (왕관 포함) (P2)
- **기존**: `lib/common/profile_with_crown.dart`, `lib/widgets/my_profile_tab.dart`
- **기능**: 등급 표시용 프로필 (왕관 아이콘)

---

## 9. 🔔 알림 (P2)

### 9.1 알림 목록 (P2)
- **기존**: `lib/screens/notification_list_screen.dart` (285줄)
- **기능**: FCM 알림 히스토리
- **Firestore**: `notifications/`

### 9.2 FCM 푸시 (P0)
- **기존**: `main.dart`에 포함
- **기능**:
  - 백그라운드 메시지 핸들러
  - 토큰 저장 (`users/{userId}.fcmToken`)
  - 토픽 구독 ('all')
  - 로컬 알림 표시
- **패키지**: `@react-native-firebase/messaging`, `notifee/react-native`

---

## 10. 🛠 부가 기능 (P2)

### 10.1 이미지 에디터 (P2)
- **기존**: `lib/screens/image_editor_screen.dart` (734줄)
- **기능**: [QUESTION] 어떤 편집 기능? 토포 그리기?
- **마이그레이션 노트**: 복잡도 높음, 분해 필요

### 10.2 이미지 뷰어 (P2)
- **기존**: `lib/widgets/full_image_screen.dart`, `lib/widgets/fullscreen_photo_viewer.dart`
- **기능**: 전체화면 이미지 보기, 확대/축소

### 10.3 워터마크 이미지 (P2)
- **기존**: `lib/widgets/watermarked_image.dart`
- **기능**: 이미지에 워터마크 표시

### 10.4 광고 (P2)
- **기존**: `google_mobile_ads` 사용
- **기능**: AdMob 배너/전면 광고
- **패키지**: `react-native-google-mobile-ads`

---

## 11. 🏷️ NFC (인공벽) (P1)

### 11.1 NFC 태그 인식 (P1)
- **기존**: `bouldering_data_nfc.csv` 데이터 사용
- **기능**:
  - 인공벽 홀드에 부착된 NFC 태그 인식
  - 해당 루트 정보 표시
- **패키지**: `react-native-nfc-manager`
- **마이그레이션 노트**: iOS NFC는 사용자가 명시적으로 시작해야 함

---

## 12. 🔧 시스템 (P0)

### 12.1 인증 서비스 (P0)
- **기존**: `lib/auth_service.dart`, `lib/services/auth_service.dart` 🚨 중복
- **v2**: `app/src/services/auth.ts` 하나로 통합
- **기능**: 로그인/로그아웃/회원가입 헬퍼

### 12.2 프로필 서비스 (P0)
- **기존**: `lib/services/profile_service.dart`
- **v2**: `app/src/services/profile.ts`

### 12.3 업로드 서비스 (P0)
- **기존**: `lib/services/upload_service.dart`
- **v2**: `app/src/services/upload.ts`
- **기능**: 이미지/파일 Firebase Storage 업로드

### 12.4 업데이트 체커 (P2)
- **기존**: `lib/utils/update_checker.dart`
- **기능**: 앱 버전 체크 → 강제 업데이트 안내

### 12.5 이미지 헬퍼 (P2)
- **기존**: `lib/image_helper.dart`, `lib/utils/image_url_helper.dart`
- **기능**: 이미지 압축, URL 생성

### 12.6 컬러 폴리라인 (P2)
- **기존**: `lib/utils/colored_polylines.dart`
- **기능**: 지도 위 경로 색상별 표시

### 12.7 Firestore 필드 상수 (P0)
- **기존**: `lib/constants/firestore_fields.dart`
- **v2**: `app/src/constants/firestoreFields.ts`
- **기능**: 컬렉션/필드명 상수화

### 12.8 등급 상수 (P0)
- **기존**: `lib/constants/level.dart`
- **v2**: `app/src/constants/level.ts`
- **기능**: 클라이밍 등급 체계 (YDS/V등급 등)

---

## 📊 전체 통계

| 영역 | P0 | P1 | P2 | 합계 |
|---|---|---|---|---|
| 인증 | 3 | 0 | 0 | 3 |
| 메인 | 2 | 0 | 0 | 2 |
| 지도/루트 | 0 | 6 | 0 | 6 |
| 리포트 | 0 | 3 | 1 | 4 |
| 트래킹 | 0 | 3 | 0 | 3 |
| 크루 | 0 | 6 | 0 | 6 |
| 게시판 | 0 | 5 | 0 | 5 |
| 사용자 | 0 | 2 | 1 | 3 |
| 알림 | 1 | 0 | 1 | 2 |
| 부가 | 0 | 0 | 4 | 4 |
| NFC | 0 | 1 | 0 | 1 |
| 시스템 | 6 | 0 | 2 | 8 |
| **합계** | **12** | **26** | **9** | **47** |

---

## ❓ 해결해야 할 질문 ([QUESTION] 태그)

작업 진행하면서 사용자에게 확인이 필요한 항목들:

1. **하단 탭바 구성**: 현재 정확한 탭 개수와 구성?
2. **map_input_screen.dart의 실제 기능**: 1618줄 안에 뭐가 들어있나?
3. **generic_route_detail_screen.dart의 실제 기능**: 1402줄 안에 뭐가 들어있나?
4. **mypage_screen.dart의 실제 기능**: 1163줄 안에 뭐가 들어있나?
5. **crew_detail_screen.dart의 실제 기능**: 1049줄 안에 뭐가 들어있나?
6. **이미지 에디터의 정확한 용도**: 토포 그리기? 일반 편집?
7. **크루 채팅방의 백엔드**: Firestore? RTDB?
8. **루트 리포트 작성 화면**: 별도 존재? `map_input_screen.dart`에 포함?
9. **지도 SDK**: Google Maps 유지 vs Kakao Map (RideTalk과 통일)
10. **수익화 모델**: AdMob 외에 구독 도입 여부?

→ 이 질문들은 작업이 진행되면서 하나씩 해결한다.

---

## 🚫 v2.0 MVP에서 제외 (P3)

다음 항목은 **v2.1 이후**에 추가:

- AI 루트 추천
- 등반 통계/그래프 강화 (`fl_chart` 활용)
- 오프라인 모드 (산속 인터넷 약함)
- AR 루트 안내
- 실시간 친구 매칭
- 다국어 지원
- 다크모드 (v2.0 출시 후 디자인 결정)
- 인공벽 매장 시스템 정립 (자연암벽과 분리)

---

*이 문서는 마이그레이션 진행에 따라 갱신된다. 작업 시작 전 항상 최신 상태 확인.*
