/**
 * 테마 기반 Text. variant=타이포 스케일, color=테마 색상 키.
 * 색상 하드코딩 금지 → 항상 theme 키 사용(CLAUDE.md).
 */
import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme, type TypographyVariant } from '../../theme';

type ThemeColorKey =
  | 'textPrimary'
  | 'textSecondary'
  | 'primary'
  | 'secondary'
  | 'onPrimary'
  | 'error'
  | 'warning'
  | 'success'
  | 'disabled';

interface AppTextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ThemeColorKey;
}

export const Text: React.FC<AppTextProps> = ({
  variant = 'body',
  color = 'textPrimary',
  style,
  ...rest
}) => {
  const theme = useTheme();
  return (
    <RNText
      style={[theme.typography[variant], { color: theme.colors[color] }, style]}
      {...rest}
    />
  );
};
