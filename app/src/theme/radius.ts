/** 모서리 반경 토큰. */
export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 16,
  full: 9999,
} as const;

export type RadiusKey = keyof typeof radius;
