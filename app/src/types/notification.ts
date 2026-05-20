/**
 * 알림 타입 — v1 실측 필드명 기준 (02_DATA_MODEL의 isRead/target*Id는 추정 오류).
 *
 * v1 실측(mypage_screen.dart): `receiverId`, `checked`(bool), 딥링크 = `postId`/`commentId`.
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export type NotificationType =
  | 'comment'
  | 'reply'
  | 'like'
  | 'mention'
  | 'crew'
  | 'system';

export interface AppNotification {
  notificationId: string;

  receiverId: string;
  senderId?: string;
  senderNickname?: string;

  type?: NotificationType;
  title?: string;
  body?: string;

  // 딥링크 (v1 실측: target* 접두 없음)
  postId?: string;
  commentId?: string;
  reportId?: string;
  crewId?: string;

  // ⚠️ v1 실측: `checked` (isRead 아님)
  checked?: boolean;
  createdAt?: FirebaseFirestoreTypes.Timestamp;
}
