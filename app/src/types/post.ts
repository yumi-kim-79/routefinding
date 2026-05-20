/**
 * 게시글 타입 — v1 실측 필드명 기준(02_DATA_MODEL는 추정값이 일부 어긋남 → docs 정정 진행).
 * 시간 필드명 = `timestamp` (v1 mypage_screen.dart `data['timestamp']`).
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface Post {
  postId: string;
  userId: string;

  title: string;
  content: string;
  imageUrls?: string[];
  category?: string;

  // 비정규화 작성자 정보(목록 표시용)
  nickname?: string;
  photoUrl?: string;
  level?: string;

  // 카운터
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
  likedBy?: string[];

  // 메타 — ⚠️ v1 실측 필드명은 `timestamp` (createdAt 아님)
  timestamp?: FirebaseFirestoreTypes.Timestamp;
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
  isDeleted?: boolean;
}
