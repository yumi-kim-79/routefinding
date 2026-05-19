/**
 * 디자인 시스템 통합 export + `useTheme` 훅.
 *
 * 현재: 시스템 다크모드에 따라 light/dark 토큰 선택 (dark는 placeholder 값).
 * 실제 다크모드 토글/튜닝은 Phase 5 (docs/05_ROADMAP.md). 구조는 지금 완비.
 */
import { useColorScheme } from 'react-native';
import { type ColorTheme, darkColors, lightColors } from './colors';
import { typography, fontWeight, fontFamily } from './typography';
import { spacing } from './spacing';
import { radius } from './radius';

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './radius';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: ColorTheme;
  typography: typeof typography;
  fontWeight: typeof fontWeight;
  fontFamily: typeof fontFamily;
  spacing: typeof spacing;
  radius: typeof radius;
}

export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    typography,
    fontWeight,
    fontFamily,
    spacing,
    radius,
  };
}
