# 🗄️ 02_DATA_MODEL.md — Firestore 데이터 모델

> **원칙**: 기존 Firestore 구조를 그대로 유지한다 (현재 50명 유저 데이터 보호).
> **개선**: 보안 규칙은 v2에서 강화 (Custom Claims 도입).

---

## 🔥 Firebase 프로젝트 정보

- **프로젝트 ID**: `routefinding09-4b597` (기존)
- **재사용 여부**: ✅ 기존 프로젝트 그대로
- **Auth**: Firebase Auth (이메일/비밀번호)
- **DB**: Cloud Firestore
- **Storage**: Firebase Storage
- **FCM**: Firebase Cloud Messaging
- **Functions**: Cloud Functions (Node.js)
- **App Check**: Play Integrity (Android), DeviceCheck (iOS)

---

## 📂 컬렉션 구조 (전체 트리)

```
firestore/
├── users/{userId}                          ← 사용자
│   └── my_routes/{routeId}                 ← 개인 등반 기록
│
├── posts/{postId}                          ← 공용 게시판 글
│   └── comments/{commentId}                ← 댓글
│       └── replies/{replyId}               ← 대댓글
│
├── route_reports/{reportId}                ← 자연암벽 루트 리포트 (승인제)
│   └── pitches/{pitchId}                   ← 멀티피치 구간
│
├── bouldering_reports/{reportId}           ← 인공벽/볼더링 제보 (Phase 2-1 발견, 문서화)
│
├── concepts/{mountain}/                    ← 산별 개념도
│   └── routes/{routeId}                    ← 토포상의 루트
│
└── notifications/{notificationId}          ← FCM 알림 히스토리
```

---

## 1. 👤 users/{userId}

사용자 프로필 + FCM 토큰 + 등급 정보

### 필드 스키마

```typescript
interface User {
  // 기본 정보
  uid: string;                  // FirebaseAuth UID (= 문서 ID)
  email: string;
  nickname: string;
  photoUrl?: string;            // 프로필 사진 (v1 실제 필드명, ⚠️ profileImageUrl 아님)
  intro?: string;               // 한 줄 소개 (v1 my_profile_tab.dart)

  // FCM
  fcmToken?: string;            // FCM 푸시 토큰

  // 등급 시스템 — ✅ [QUESTION] 해소 (Phase 2-1, 2026-05-19)
  level?: string;               // 등반등급 문자열 "5.15"~"5.6" (숫자 아님!)
  //   ProfileWithCrown가 등급→왕관/테두리색 매핑 (5.15 gold/5.14 silver/5.13 bronze…)
  //   관리자(adminEmails)는 constants/level.dart에서 "5.15" 취급

  // 통계
  postCount?: number;
  commentCount?: number;
  reportCount?: number;

  // 메타
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // [TBD] 추가 필드 (실제 데이터 확인 필요)
}
```

### 보안 규칙 (v1 → v2)

**v1 (현재 — 🚨 보안 구멍)**:
```
allow read: if true;                                           // 누구나 모든 유저 읽기 가능
allow write: if request.auth.uid == userId;
```

**v2 (개선안)**:
```
// 공개 필드만 조회 가능 (nickname, photoUrl, level)
// FCM 토큰, 이메일 등 민감 정보는 본인만 조회
allow read: if request.auth != null;
allow write: if request.auth.uid == userId;
```

→ 클라이언트에서 민감 필드 접근 시 별도 처리 필요. 또는 컬렉션 분리 (`users_public/`, `users_private/`).

---

## 1-1. 🥾 users/{userId}/my_routes/{routeId}

개인 등반 기록 (서브컬렉션)

### 필드 스키마

```typescript
interface MyRoute {
  routeId: string;              // 문서 ID
  routeName: string;
  mountain?: string;             // 산 이름
  difficulty?: string;           // 등급 (5.10a, V3 등)

  completedAt: Timestamp;        // 등반 완료 일시
  attemptCount?: number;         // 시도 횟수
  isOnsight?: boolean;          // 온사이트 여부

  notes?: string;                // 메모
  imageUrls?: string[];          // 등반 사진

  // GPX 트래킹 데이터 (옵션)
  gpxUrl?: string;
  duration?: number;             // 등반 시간 (초)
  // [TBD] 추가 필드 확인 필요
}
```

### 보안 규칙

```
// 본인만 읽기/쓰기 가능
allow read: if request.auth.uid == userId;
allow create, delete: if request.auth.uid == userId;
```

---

## 2. 📋 posts/{postId}

공용 게시판 글

### 필드 스키마

```typescript
interface Post {
  postId: string;               // 문서 ID
  userId: string;               // 작성자 UID
  nickname: string;             // 작성 당시 닉네임 (스냅샷)
  authorProfileUrl?: string;    // 작성 당시 프사

  title: string;
  content: string;
  imageUrls?: string[];

  category?: string;            // 카테고리 (공지/잡담/질문 등)

  // 카운터
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;

  // 좋아요 사용자 목록 (배열) — 또는 별도 서브컬렉션?
  likedBy?: string[];           // [TBD] 데이터 구조 확인

  // 메타 — ⚠️ v1 실측 필드명은 `timestamp` (createdAt 아님, Phase 2-1 정정 2026-05-20)
  timestamp: Timestamp;
  updatedAt?: Timestamp;
  isDeleted?: boolean;          // soft delete
}
```

### 보안 규칙

```
allow read: if request.auth != null;
allow create: if request.auth != null
              && request.resource.data.userId == request.auth.uid;
allow update, delete: if request.auth != null
                     && (resource.data.userId == request.auth.uid
                         || isAdmin());                       // v2: Custom Claims
```

---

## 3. 💬 posts/{postId}/comments/{commentId}

게시글 댓글

### 필드 스키마

```typescript
interface Comment {
  commentId: string;
  postId: string;              // 경로: posts/{postId}/comments/{commentId} (ref.parent.parent.id)
  userId: string;
  nickname?: string;
  photoUrl?: string;           // ⚠️ v1 실측: photoUrl (authorProfileUrl 아님)

  // 본문 — ⚠️ v1 실측: `text` (content 아님, Phase 2-1 정정 2026-05-20)
  text: string;

  replyCount?: number;
  likeCount?: number;

  // 메타 — ⚠️ v1 실측: `timestamp` (createdAt 아님)
  timestamp?: Timestamp;
  updatedAt?: Timestamp;
  isDeleted?: boolean;
}
```

### 3-1. posts/{postId}/comments/{commentId}/replies/{replyId}

대댓글

```typescript
interface Reply {
  replyId: string;
  commentId: string;
  userId: string;
  nickname: string;

  content: string;
  mentionUid?: string;          // @멘션 대상

  createdAt: Timestamp;
  isDeleted?: boolean;
}
```

### CollectionGroup 쿼리

"내 댓글" 모아보기 기능을 위해 `collectionGroup('comments')` 쿼리 사용.
→ 별도 색인 + 보안 규칙 필요 (기존 v1 규칙에 있음)

---

## 4. 🧗 route_reports/{reportId}

자연암벽 루트 리포트 (승인제)

### 필드 스키마

```typescript
interface RouteReport {
  reportId: string;
  authorUid: string;            // 작성자 UID
  authorNickname: string;

  // 루트 정보
  routeName: string;
  mountain: string;             // 산 이름
  region?: string;              // 지역
  difficulty: string;           // 등급
  length?: number;              // 총 길이 (m)
  pitchCount?: number;          // 피치 수

  // 위치
  latitude: number;
  longitude: number;
  geohash?: string;             // 지리적 인덱싱

  // 설명
  description?: string;
  approachDescription?: string; // 접근로 설명
  approachGpxUrl?: string;      // 접근로 GPX

  // 사진
  topoImageUrl?: string;        // 토포 (등반 라인 표시)
  photoUrls?: string[];

  // 승인 상태
  status: 'pending' | 'approved' | 'rejected';
  rejectReason?: string;
  reviewedBy?: string;          // 검토자 UID
  reviewedAt?: Timestamp;

  // 메타
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  viewCount?: number;
}
```

### 보안 규칙

```
// 읽기: approved 상태 OR 작성자 OR 관리자
allow read: if resource.data.status == 'approved'
            || resource.data.authorUid == request.auth.uid
            || isAdmin();

// 생성: 인증 + 작성자 본인
allow create: if request.resource.data.authorUid == request.auth.uid;

// 수정/삭제: 작성자 (단, approved 상태는 수정 불가) OR 관리자
allow update, delete: if (resource.data.authorUid == request.auth.uid
                          && resource.data.status != 'approved')
                       || isAdmin();
```

---

## 5. 🪢 route_reports/{reportId}/pitches/{pitchId}

멀티피치 구간 (서브컬렉션)

### 필드 스키마

```typescript
interface Pitch {
  pitchId: string;
  reportId: string;
  authorUid: string;

  pitchNumber: number;          // 1, 2, 3 (피치 순서)
  difficulty: string;           // 이 피치 등급
  length?: number;              // 이 피치 길이 (m)

  description?: string;
  protectionInfo?: string;      // 확보물 정보 (캠, 너트 등)
  beltPointDescription?: string; // 빌레이 포인트 설명

  topoImageUrl?: string;        // 이 피치 토포
  photoUrls?: string[];

  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

---

## 5-1. 🧗‍♂️ bouldering_reports/{reportId}

> Phase 2-1에서 발견·문서화 (v1 `mypage_screen.dart`/`concept_list_screen.dart`/
> `map_input_screen.dart`/`map_screen.dart`에서 사용 중이나 기존 문서 누락).
> **인공벽/볼더링 제보** 컬렉션 (자연암벽 `route_reports`와 분리 운영).

```typescript
interface BoulderingReport {
  // [TBD] 실제 필드 스키마 — v1 코드/실데이터 1건 확인 후 확정.
  // 현재까지 확인: 마이페이지 "내 제보 관리"에서 route_reports와 함께
  //   authorUid == 본인 조건으로 조회, 삭제/반려(사유) 액션 대상.
  reportId: string;
  authorUid: string;
  // mountain/지역/등급/위치/사진/status 등은 route_reports와 유사 추정 (확인 필요)
}
```

> ⚠️ 스키마 변경 금지. 실제 필드는 작업 시 `git show main:lib/map_input_screen.dart` 등으로
> 확정 후 이 섹션 갱신. 인공벽 시스템 정립은 v2.1+ (`01_MVP_SPEC.md` P3).

---

## 6. ⛰️ concepts/{mountain}/routes/{routeId}

산별 개념도 (이 산에 있는 모든 루트)

### 필드 스키마

```typescript
interface Concept {
  // documentId: mountain (예: "북한산")
  // routeId 하위에 각 루트가 들어감
}

interface ConceptRoute {
  routeId: string;
  routeName: string;
  difficulty: string;
  pitchCount?: number;

  // 토포상 위치
  positionX?: number;           // 토포 이미지 내 X 좌표
  positionY?: number;

  // 연결된 리포트
  reportId?: string;            // route_reports의 ID와 연결

  createdAt: Timestamp;
}
```

### 보안 규칙

```
allow read: if true;            // 공개
allow create: if request.auth != null;
allow update, delete: if false; // 수정/삭제 불가 (관리자만 콘솔에서)
```

> ⚠️ v2 개선점: create도 관리자만 허용하도록 변경 검토

---

## 7. 🔔 notifications/{notificationId}

FCM 알림 히스토리

### 필드 스키마

```typescript
interface Notification {
  notificationId: string;
  receiverId: string;           // 받을 사람 UID
  senderId?: string;            // 보낸 사람 UID (시스템이면 null)
  senderNickname?: string;

  type: 'comment' | 'reply' | 'like' | 'mention' | 'crew' | 'system';
  title: string;
  body: string;

  // 딥링크 정보 — ⚠️ v1 실측: `target` 접두사 없음 (Phase 2-1 정정 2026-05-20)
  postId?: string;
  commentId?: string;
  reportId?: string;
  crewId?: string;

  // ⚠️ v1 실측: `checked` (isRead 아님)
  checked?: boolean;
  createdAt: Timestamp;
}
```

### 보안 규칙

```
allow read, update, delete: if request.auth.uid == resource.data.receiverId;
allow create: if request.auth != null;
```

---

## 🚧 v2에서 추가 검토할 항목

### 1. 크루(동호회) 데이터 모델 [TBD]

현재 `firestore.rules`에 크루 관련 규칙이 보이지 않음. 코드 분석 시 다음 확인 필요:
- `crews/{crewId}` 컬렉션 존재 여부
- 멤버 관리 방식 (subcollection? 배열?)
- 채팅방 데이터 (Firestore? RTDB?)

→ 작업 시작 시 `git show main:lib/crew_main_screen.dart` 등으로 확인 후 이 문서 업데이트.

### 2. 인공벽 데이터 [TBD]

현재 인공벽 데이터는 CSV(`bouldering_data_nfc.csv`) + NFC 태그로 관리.
v2에서는 Firestore 컬렉션화 필요:

```typescript
// 제안 구조
gyms/{gymId}                    // 클라이밍장 (매장)
└── routes/{routeId}            // 인공벽 루트 (셋팅된 문제)
    └── nfcTag                  // 연결된 NFC UID
```

→ 별도 마이그레이션 스크립트 필요.

### 3. 관리자 권한 — Custom Claims 도입

**현재 v1**: 이메일 하드코딩 (`request.auth.token.email == 'yusung790926@gmail.com'`)

**v2 개선**:
```
function isAdmin() {
  return request.auth.token.admin == true;
}
```

→ Firebase Admin SDK 로 사용자에게 admin 클레임 부여하는 스크립트 작성 (`functions/`).

### 4. Geohash 활용

`dart_geohash` 패키지 사용 중. RN에서도 동일하게 적용:
- 패키지: `ngeohash` (npm)
- 용도: 지도 영역 쿼리 (Firestore의 위치 기반 쿼리 한계 보완)

---

## 📐 명명 규칙

### Firestore 컬렉션/필드명

- **컬렉션**: snake_case (예: `route_reports`)
- **필드**: camelCase (예: `authorUid`, `createdAt`)
- **문서 ID**: 의미 있는 ID (UID, 자동생성 ID) 또는 식별자

### TypeScript 타입명

- **인터페이스**: PascalCase (예: `RouteReport`)
- **타입 파일**: `app/src/types/<도메인>.ts` (예: `route.ts`, `user.ts`)
- **상수**: `app/src/constants/firestoreFields.ts` 에 컬렉션/필드명 상수화

```typescript
// 예시
export const COLLECTIONS = {
  USERS: 'users',
  POSTS: 'posts',
  ROUTE_REPORTS: 'route_reports',
  CONCEPTS: 'concepts',
  NOTIFICATIONS: 'notifications',
} as const;

export const FIELDS = {
  USER: {
    UID: 'uid',
    NICKNAME: 'nickname',
    FCM_TOKEN: 'fcmToken',
  },
  // ...
} as const;
```

---

## 📦 데이터 마이그레이션 (필요 시)

기존 50명 유저 데이터는 **그대로 두고 v2에서 읽는다**.
다만 다음 항목은 마이그레이션 스크립트가 필요할 수 있음:

| 작업 | 필요 시점 | 방식 |
|---|---|---|
| Custom Claims 부여 (관리자) | v2 초기 | Firebase Admin SDK 스크립트 (`functions/scripts/setAdmin.js`) |
| `users` 컬렉션 분리 (필요 시) | 보안 강화 시 | Cloud Function 일괄 마이그레이션 |
| 인공벽 데이터 Firestore화 | 인공벽 기능 강화 시 | CSV → Firestore 업로드 스크립트 |
| FCM 토큰 재발급 | v2 출시 후 | 클라이언트에서 첫 실행 시 자동 |

---

## ❓ 해결해야 할 질문

작업하면서 채워가야 할 항목:

1. [QUESTION] `users` 문서의 정확한 필드 구조 (실제 데이터 1개 확인)
2. [QUESTION] `users/{uid}/my_routes`의 사용 빈도
3. [QUESTION] `posts.likedBy` 데이터 구조 (배열? subcollection?)
4. [QUESTION] 크루 관련 컬렉션 구조 전체
5. [QUESTION] 크루 채팅: Firestore vs RTDB?
6. [QUESTION] `notifications` 자동 삭제 정책 (현재 무한 누적?)
7. [QUESTION] Storage 폴더 구조 (예: `users/{uid}/profile.jpg`?)

---

*이 문서는 실제 Firestore 데이터 확인 후 갱신된다.*
