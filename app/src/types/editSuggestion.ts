/**
 * 정보 수정 제안 — `edit_suggestions/{id}`
 *
 * ⚠️ 왜 '바로 수정'이 아니라 '제안'인가:
 *    루트 문서는 **5,451개의 핵심 데이터**다. 개념도 사진·좌표·난이도가 여기 들어 있고,
 *    한 사람이 잘못 고치면 지도와 목록이 통째로 어긋난다.
 *    암장 정보(`crags`)는 열어 뒀지만(사후에 지우면 그만), 루트 자체는 **검토를 거친다.**
 *
 * ⚠️ 이걸로 "제보자 본인 수정" 문제도 같이 풀린다 — 본인이면 제안이 아니라 바로 반영한다.
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { ConceptSource } from './concept';

/** 제안할 수 있는 항목 — 화면 순서와 같다 */
export const EDITABLE_FIELDS = [
  { key: 'routeName', label: '루트명' },
  { key: 'difficulty', label: '난이도' },
  { key: 'climbType', label: '등반 형태' },
  { key: 'equipment', label: '장비' },
  { key: 'pioneer', label: '개척자' },
  { key: 'overview', label: '개요' },
  { key: 'zone', label: '구역' },
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number]['key'];

export interface EditSuggestion {
  id: string;
  conceptId: string;
  conceptSource: ConceptSource;
  /** 화면에 보여줄 이름 (등반지·구역·루트명) */
  title: string;
  /** 바뀐 필드만 */
  patch: Partial<Record<EditableField, string>>;
  /** 바뀌기 전 값 — 관리자가 나란히 보고 판단한다 */
  before: Partial<Record<EditableField, string>>;
  reason?: string;
  uid: string;
  nickname: string;
  status: 'open' | 'applied' | 'rejected';
  createdAt?: FirebaseFirestoreTypes.Timestamp;
}

export function fieldLabel(key: string): string {
  return EDITABLE_FIELDS.find((f) => f.key === key)?.label ?? key;
}
