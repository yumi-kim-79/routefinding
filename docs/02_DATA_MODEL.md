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
  routeId: string;              // 문서 ID (= myRouteId)
  // ⚠️ v1 실측: 원본 루트 doc 참조 — 카드 표시 시 deref해서 현재 mountain/routeName/imageUrl 사용
  routeRef?: DocumentReference;
  // 저장 시 스냅샷(원본이 삭제됐을 때 fallback 표시용)
  routeName?: string;
  mountain?: string;
  difficulty?: string;           // 등급 (5.10a, V3 등) — [TBD] v1 실측 미확인

  // ⚠️ v1 실측: `savedAt` (completedAt 아님, Phase 2-1 정정 2026-05-20)
  savedAt: Timestamp;
  attemptCount?: number;         // [TBD]
  isOnsight?: boolean;           // [TBD]

  notes?: string;                // [TBD]
  imageUrls?: string[];          // [TBD]

  // GPX 트래킹 데이터 (옵션) — [TBD]
  gpxUrl?: string;
  duration?: number;             // 등반 시간 (초)
}
```

### 보안 규칙

```
// 본인만 읽기/쓰기 가능
allow read: if request.auth.uid == userId;
allow create, delete: if request.auth.uid == userId;
```

---

## 1-2. 📔 users/{userId}/climbing_logs/{logId}   ← **v2 신규**

등반일지 (서브컬렉션). v2 리뉴얼에서 추가 — 마이페이지 'MY ROUTE' 탭을 대체한다.

> **왜 my_routes를 안 쓰고 새로 만들었나**: `my_routes`는 루트당 문서 1개(즐겨찾기)다.
> 실제 등반기록은 같은 루트를 여러 번 가는 경우가 많아(예: 북한산 노적봉 2017.09.24 /
> 2018.04.28 / 2018.05.13) **날짜별 1건**이어야 한다. 즐겨찾기(★)는 그대로 유지.

필드는 사용자의 기존 스프레드시트(유성이_암벽등반기록)와 1:1로 맞췄다.

```typescript
interface ClimbingLog {
  climbedAt: Timestamp;         // 등반일 (정렬 기준, 필수)
  endedAt?: Timestamp | null;   // 종료일 — 1박 이상일 때만 (예: 2018.05.05~06)

  place: string;                // 장소 "북한산 노적봉" (필수)
  routeName?: string;           // 루트명 (여러 개면 자유 기입)
  gear?: string;                // 소요장비 "퀵드로 12개, 캠1셋트"
  duration?: string;            // 등반 소요시간 "9시~16시" (자유 문자열 — 기존 표기 보존)
  partners?: string;            // 참석자
  notes?: string;               // 등반내용 및 특이사항

  conceptId?: string;           // 개념도에서 작성한 경우 원본 루트 연결
  conceptSource?: 'route_reports' | 'bouldering_reports';

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 보안 규칙 (v2에서 신규 추가 — 배포 필요)

```
match /users/{userId}/climbing_logs/{logId} {
  allow read, create, update, delete:
    if request.auth != null && request.auth.uid == userId;
}
```

> `my_routes`와 달리 **update를 허용**한다 — 일지는 나중에 내용을 고칠 수 있어야 한다.
> ⚠️ 이 규칙이 배포되기 전에는 저장이 permission-denied로 거부된다.

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
  status: 'draft' | 'pending' | 'approved' | 'rejected';   // ⚠️ v1: 기본 'draft' 포함
  // ⚠️ v1 실측: `rejectionReason` (rejectReason 아님, Phase 2-1 정정 2026-05-20)
  rejectionReason?: string;
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

### 📌 실측 정정 (2026-08-03) — 화면상의 "개념도"가 읽는 곳

v1 `concept_list_screen.dart`와 웹 `ConceptListView.vue`가 실제로 읽는 컬렉션은
`concepts/{mountain}/routes`가 **아니라** 아래 두 곳이다. v2 개념도 화면도 동일하게 읽는다.

| 화면상 구분 | 실제 컬렉션 | 조건 |
|---|---|---|
| 리드   | `route_reports`      | `status == 'approved'` (+ `typeRoot == '리드'`) |
| 볼더링 | `bouldering_reports` | `status == 'approved'` |

- 사진: `imageUrls[]` 우선, 없으면 `imageUrl`
- 피치: 문서의 **배열 필드** `pitches[]` (`{length, style, difficulty, imageUrls[]}`)
  — `route_reports/{id}/pitches` 서브컬렉션(§5)과 **별개**이며 목록/상세는 배열 필드를 쓴다
- 그 외 v1 실측 필드: `zone`, `overview`, `avgDifficulty`, `pioneer`, `equipment`, `directions`, `no`, `typeRoot`
- `concepts/{mountain}/routes`는 현재 사실상 미사용 → 리뉴얼 범위 밖 (제거 여부는 [TBD])

> 🚨 **[QUESTION] 보안 규칙 공백**: `firestore.rules`에 `bouldering_reports` 매치 블록이 없어
> §9 전면 차단 규칙에 걸린다(= 볼더링 조회 permission-denied 가능).
> v2 클라이언트는 한쪽 실패를 삼키고 나머지를 보여주도록 방어했으나(`conceptService.ts`),
> 규칙 추가는 **별도 PR + 사용자 승인** 필요 (CLAUDE.md).

---

## 6-1. 🖼 concept_photos/{photoId}   ← **v2 신규**

사용자가 개념도에 올린 사진 + 그 위에 그린 라인/텍스트.

> **승인 흐름**(사용자 결정 2026-08-04): 올리면 `pending`.
> 승인 전에는 **올린 본인과 관리자만** 조회된다(보안 규칙이 보장 — 클라이언트 필터 아님).
> 관리자가 승인할 때 `add`(기존에 추가) / `replace`(기존 교체) 중 고른다.

```typescript
interface ConceptPhoto {
  conceptId: string;                 // 대상 루트 문서 ID
  conceptSource: 'route_reports' | 'bouldering_reports';
  conceptTitle: string;              // "북한산 · 인수봉 · 서면슬랩" (표시용 스냅샷)

  authorUid: string;
  authorEmail?: string;

  imageUrl: string;                  // Storage 다운로드 URL
  storagePath: string;               // route_images/{산}/{구역}/{루트}/user_{uid}_{ts}.jpg

  // 사진 위에 그린 것 — **좌표로 저장**(원본 이미지는 손대지 않는다)
  //   좌표는 전부 0~1 정규화 → 썸네일/전체화면 어디서든 동일하게 겹쳐 그려진다
  lines: { points: { x: number; y: number }[]; color: string }[];
  texts: { x: number; y: number; text: string; color: string }[];

  status: 'pending' | 'approved' | 'rejected';
  applyMode?: 'add' | 'replace';     // 승인 시 관리자가 선택
  rejectionReason?: string;
  reviewedAt?: Timestamp;
  reviewedBy?: string;

  createdAt: Timestamp;
}
```

승인 시 원본 개념도 문서(`route_reports`/`bouldering_reports`)의 `imageUrls`를
`arrayUnion`(추가) 또는 통째 교체한다.

### 보안 규칙 (v2 신규 추가 — 배포 필요)

```
match /concept_photos/{photoId} {
  allow read:   if 인증됨 && (status=='approved' || 본인 || 관리자);
  allow create: if 인증됨 && 본인 && status=='pending';   // 스스로 승인 못 함
  allow update, delete: if 관리자 || (본인 && status != 'approved');
}
```

> ⚠️ 승인 시 `bouldering_reports` 문서를 수정하는데, `firestore.rules`에는
> 아직 `bouldering_reports` 매치 블록이 없다. 볼더링 개념도 사진 승인이
> 실패하면 이 규칙부터 확인할 것.

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
