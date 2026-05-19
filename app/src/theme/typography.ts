/**
 * 타이포그래피 토큰.
 * v1은 폰트 미지정(시스템 기본) → v2도 **시스템 기본** 사용(별도 폰트 미도입).
 * 스케일은 M3 스타일(display/headline/title/body/label) 명명.
 */
import { Platform, type TextStyle } from 'react-native';

/** 시스템 기본 폰트 (iOS=SF, Android=Roboto) */
export const fontFamily = Platform.select({
  ios: undefined, // 시스템 기본
  android: undefined,
  default: undefined,
});

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export type TypographyVariant =
  | 'display'
  | 'headline'
  | 'title'
  | 'body'
  | 'label'
  | 'caption';

/** variant → 기본 TextStyle */
export const typography: Record<TypographyVariant, TextStyle> = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: fontWeight.bold },
  headline: { fontSize: 24, lineHeight: 32, fontWeight: fontWeight.bold },
  title: { fontSize: 18, lineHeight: 24, fontWeight: fontWeight.semibold },
  body: { fontSize: 15, lineHeight: 22, fontWeight: fontWeight.regular },
  label: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.medium },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.regular },
};
