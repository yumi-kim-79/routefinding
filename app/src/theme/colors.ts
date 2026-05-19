/**
 * 색상 토큰 (하이브리드: v1 색상 값 보존 + 모던 M3 스타일 슬롯).
 *
 * 원칙(CLAUDE.md 1:1 보존): 값은 Flutter v1 실측 색상 그대로.
 * v1 = `ThemeData(primarySwatch: Colors.blue)` + Material 표준 + 등급 메달.
 *
 * 다크 테마는 **placeholder만** (실제 토글은 Phase 5, docs/05_ROADMAP.md).
 * 화면에서 색상 하드코딩 금지 — 항상 이 토큰 사용.
 */

/** 원시 팔레트 (v1 실측값) */
const palette = {
  blue: '#2196F3', // Colors.blue   (primary/brand)
  blueAccent: '#448AFF', // Colors.blueAccent (secondary)
  blueLight: '#BBDEFB', // Colors.blue[100]
  purple: '#9C27B0', // Colors.purple (특수 강조)
  red: '#F44336', // Colors.red    (error)
  orange: '#FF9800', // Colors.orange (warning)
  green: '#4CAF50', // Colors.green  (success)
  yellow: '#FFEB3B', // Colors.yellow (track mid)
  black: '#000000',
  white: '#FFFFFF',
  grey200: '#EEEEEE', // Colors.grey[200]
  grey300: '#E0E0E0', // Colors.grey[300]
  grey: '#9E9E9E', // Colors.grey
  grey600: '#757575', // Colors.grey[600]
  grey800: '#424242', // Colors.grey[800]
  brown: '#795548', // 5.11 (v1 Colors.brown)
  pink: '#E91E63', // 5.9 (v1 Colors.pink)
  lightBlueAccent: '#40C4FF', // 등급 default (v1 Colors.lightBlueAccent)
  navy: '#22232D', // v1 다크 surface
  // 등급 메달 (profile_with_crown — v1 UX 보존 필수)
  medalGold: '#FFD700',
  medalSilver: '#C0C0C0',
  medalBronze: '#CD7F32',
  transparent: 'transparent',
} as const;

/** 의미별 색상 스키마 (light/dark 동일 키 — 다크는 placeholder) */
export interface ColorTheme {
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;

  background: string;
  surface: string;
  surfaceVariant: string;
  onSurface: string;
  onSurfaceVariant: string;

  textPrimary: string;
  textSecondary: string;
  disabled: string;
  border: string;
  divider: string;

  error: string;
  warning: string;
  success: string;
  info: string;

  /** 특수 강조 (v1 purple) */
  accent: { purple: string };
  /** 등급 메달 */
  medal: { gold: string; silver: string; bronze: string };
  /**
   * 등반등급별 색상 (v1 profile_with_crown.dart `_levelBorderColor` 1:1).
   * 키 = 등급 문자열. 미정의 등급은 `gradeDefault`.
   */
  grade: Record<string, string>;
  gradeDefault: string;
  /** GPX 트래킹 속도 색상 (v1 colored_polylines) */
  track: { fast: string; mid: string; slow: string };

  transparent: string;
}

export const lightColors: ColorTheme = {
  primary: palette.blue,
  onPrimary: palette.white,
  secondary: palette.blueAccent,
  onSecondary: palette.white,

  background: palette.white,
  surface: palette.white,
  surfaceVariant: palette.grey200,
  onSurface: palette.black,
  onSurfaceVariant: palette.grey600,

  textPrimary: palette.black,
  textSecondary: palette.grey600,
  disabled: palette.grey,
  border: palette.grey300,
  divider: palette.grey300,

  error: palette.red,
  warning: palette.orange,
  success: palette.green,
  info: palette.blue,

  accent: { purple: palette.purple },
  medal: {
    gold: palette.medalGold,
    silver: palette.medalSilver,
    bronze: palette.medalBronze,
  },
  // v1 _levelBorderColor 1:1 (재사용 가능분은 의미 슬롯 재사용)
  grade: {
    '5.15': palette.medalGold, // #FFD700
    '5.14': palette.medalSilver, // #C0C0C0
    '5.13': palette.medalBronze, // #CD7F32
    '5.12': palette.purple, // #9C27B0
    '5.11': palette.brown, // #795548 (신규)
    '5.10': palette.red, // #F44336
    '5.9': palette.pink, // #E91E63 (신규)
    '5.8': palette.yellow, // #FFEB3B
    '5.7': palette.blue, // #2196F3
  },
  gradeDefault: palette.lightBlueAccent, // #40C4FF (신규)
  track: { fast: palette.green, mid: palette.yellow, slow: palette.red },

  transparent: palette.transparent,
};

/**
 * 다크 테마 — placeholder (Phase 5에서 실제 값 튜닝).
 * v1 네이비(#22232D)를 surface로 활용한 임시 대비값.
 */
export const darkColors: ColorTheme = {
  ...lightColors,
  background: palette.navy,
  surface: palette.navy,
  surfaceVariant: palette.grey800,
  onSurface: palette.white,
  onSurfaceVariant: palette.grey300,
  textPrimary: palette.white,
  textSecondary: palette.grey300,
  border: palette.grey800,
  divider: palette.grey800,
};

export { palette };
