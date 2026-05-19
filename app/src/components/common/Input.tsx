/**
 * 테마 기반 Input. label/error/비번 토글.
 * 비번 토글은 텍스트("표시"/"숨김") — 아이콘 라이브러리는 [TBD](스코프 보호).
 */
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  /** true면 비밀번호 입력 + 표시/숨김 토글 */
  password?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  password = false,
  ...rest
}) => {
  const theme = useTheme();
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="label" color="textSecondary" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            borderColor: error ? theme.colors.error : theme.colors.border,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: theme.colors.textPrimary }]}
          placeholderTextColor={theme.colors.disabled}
          secureTextEntry={password && hidden}
          autoCapitalize="none"
          {...rest}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
          >
            <Text variant="label" color="primary">
              {hidden ? '표시' : '숨김'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color="error" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15 },
  error: { marginTop: 4 },
});
