/**
 * 테마 기반 Button. variant(primary/secondary/ghost) × size(sm/md/lg) +
 * loading/disabled. 산속 사용 환경 고려해 터치 영역 넉넉히(CLAUDE.md).
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

const SIZE_PADDING: Record<ButtonSize, { v: number; h: number }> = {
  sm: { v: 8, h: 12 },
  md: { v: 12, h: 16 },
  lg: { v: 16, h: 24 },
};

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
}) => {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'secondary'
        ? theme.colors.secondary
        : theme.colors.transparent;
  const fg =
    variant === 'ghost' ? theme.colors.primary : theme.colors.onPrimary;
  const pad = SIZE_PADDING[size];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: theme.radius.md,
          paddingVertical: pad.v,
          paddingHorizontal: pad.h,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: theme.colors.primary,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <Text variant="label" style={{ color: fg }}>
            {title}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  content: { flexDirection: 'row', alignItems: 'center' },
});
