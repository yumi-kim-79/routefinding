/**
 * 난이도 제안 — 비어 있는 루트의 난이도를 사용자가 알려준다.
 *
 * ⚠️ 왜 필요한가 (2026-09-07 실측):
 *    리드 루트 2,995개 중 **난이도가 적힌 건 99개(3%)뿐**이다.
 *    클라이머가 루트를 고르는 첫 번째 기준이 난이도인데 97%가 비어 있다.
 *    관리자 혼자 채우는 것은 불가능하고, 그렇다고 아무나 바로 덮어쓰게 하면
 *    한 사람의 착각이 그대로 정답이 된다.
 *    → **제안을 모아 같은 값이 3명 이상이면 자동 반영**한다 (Cloud Function).
 *
 * ⚠️ 문서 ID 는 `${conceptId}__${uid}` 로 고정한다.
 *    자동 ID 를 쓰면 한 사람이 같은 루트에 몇 번이고 제안해 **혼자 3표를 만들 수 있다.**
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { ConceptSource } from './concept';

export interface DifficultySuggestion {
  id: string;
  conceptId: string;
  conceptSource: ConceptSource;
  /** '5.10a' / 'V4' */
  value: string;
  uid: string;
  nickname: string;
  createdAt?: FirebaseFirestoreTypes.Timestamp;
}

/** 자동 반영에 필요한 같은 값 제안 수 */
export const DIFFICULTY_AGREE_THRESHOLD = 3;

/** 리드 난이도 보기 (선택지) */
export const LEAD_GRADES = [
  '5.6', '5.7', '5.8', '5.9',
  '5.10a', '5.10b', '5.10c', '5.10d',
  '5.11a', '5.11b', '5.11c', '5.11d',
  '5.12a', '5.12b', '5.12c', '5.12d',
  '5.13a', '5.13b', '5.13c', '5.13d',
  '5.14a', '5.14b', '5.14c', '5.14d',
  '5.15a',
] as const;

/** 볼더 난이도 보기 */
export const BOULDER_GRADES = [
  'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8',
  'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15',
] as const;

export function gradesFor(type: '리드' | '볼더링'): readonly string[] {
  return type === '볼더링' ? BOULDER_GRADES : LEAD_GRADES;
}

/**
 * 입력값 정리 — 사람이 적는 표기 흔들림을 줄인다.
 * ⚠️ 완전한 검증은 하지 않는다. 실제 데이터에 '5.10a/b', '5.11-' 같은 표기가 섞여 있어
 *    엄격하게 막으면 맞는 값을 거부하게 된다.
 */
export function normalizeGrade(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/^v/, 'V')          // v4 → V4
    .replace(/^5\.(\d+)([A-D])/, (_m, n, l) => `5.${n}${l.toLowerCase()}`); // 5.10A → 5.10a
}
