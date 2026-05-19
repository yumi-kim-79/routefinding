/**
 * 간격 토큰 — 4의 배수 기반.
 * 산속/등반장 사용 환경 고려: 충분히 큰 터치/여백(CLAUDE.md 에러처리 원칙).
 */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export type SpacingKey = keyof typeof spacing;
