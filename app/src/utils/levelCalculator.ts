/**
 * 등급 계산 유틸 — v1 `lib/constants/level.dart` 1:1 포팅.
 *
 * v1 LevelPointMap(최소점수):
 *   5.6=0 / 5.7=100 / 5.8=200 / 5.9=400 / 5.10=800 / 5.11=1600 / 5.12=3200 / 5.13=6400
 *   (5.14=부관리자, 5.15=관리자 — 포인트 기준 외 별도 부여)
 */

export const LEVEL_POINT_MAP: Record<string, number> = {
  '5.6': 0,
  '5.7': 100,
  '5.8': 200,
  '5.9': 400,
  '5.10': 800,
  '5.11': 1600,
  '5.12': 3200,
  '5.13': 6400,
};

/** keys 순서를 LEVEL_POINT_MAP 정의 순서로 고정 (인덱스 기반 다음 등급 계산용) */
const LEVEL_KEYS: ReadonlyArray<string> = Object.keys(LEVEL_POINT_MAP);

/** 다음 등급의 레벨 ("5.8"→"5.9"). 최고 등급 또는 미등록 등급이면 null. */
export function getNextLevel(level: string): string | null {
  const idx = LEVEL_KEYS.indexOf(level);
  if (idx < 0 || idx === LEVEL_KEYS.length - 1) {
    return null;
  }
  return LEVEL_KEYS[idx + 1];
}

/** 다음 등급까지 남은 점수. null이면 최고 등급(또는 미등록). */
export function getRemainToNextLevel(
  level: string,
  point: number,
): number | null {
  const next = getNextLevel(level);
  if (next === null) {
    return null;
  }
  const nextMin = LEVEL_POINT_MAP[next];
  const remain = nextMin - point;
  return remain > 0 ? remain : 0;
}
