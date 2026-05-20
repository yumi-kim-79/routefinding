/** 날짜 포맷터 (v1 _formatDate 대응 최소판). */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export function formatDate(
  ts?: FirebaseFirestoreTypes.Timestamp | null,
): string {
  if (!ts) {
    return '';
  }
  const d = ts.toDate();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}.${m}.${day}`;
}
