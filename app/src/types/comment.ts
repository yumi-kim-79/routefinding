/**
 * 댓글 타입 — v1 실측 필드명 (02_DATA_MODEL은 추정 오류 → docs 정정).
 *
 * v1 mypage_screen.dart::_buildMyCommentsTab:
 *   `data['text']`, `data['timestamp']`. 경로: posts/{postId}/comments/{commentId}
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface Comment {
  commentId: string;
  postId: string; // 부모 posts/{postId} doc id (ref.parent.parent.id)
  userId: string;

  // 본문 — ⚠️ v1 실측: `text` (content 아님)
  text: string;

  // 비정규화 작성자 정보(목록 표시)
  nickname?: string;
  photoUrl?: string;
  level?: string;

  replyCount?: number;
  likeCount?: number;

  // 메타 — ⚠️ v1 실측: `timestamp` (createdAt 아님)
  timestamp?: FirebaseFirestoreTypes.Timestamp;
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
  isDeleted?: boolean;
}
