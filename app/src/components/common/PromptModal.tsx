/**
 * 공용 입력 다이얼로그 (텍스트 1줄/여러 줄). RN 빌트인 `Modal` + 우리 `Input`/`Button`.
 *
 * RN `Alert.prompt`는 iOS 전용이라 안드 호환을 위해 자체 구현. 외부 라이브러리 미도입.
 * 사용 예: MyReportsTab 반려 사유 입력, 향후 닉네임 수정 등.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Input } from './Input';
import { Button } from './Button';
import { useTheme } from '../../theme';

interface PromptModalProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
  /** 빈 입력 허용 여부 (기본 false: 빈 입력이면 submit 버튼 비활성) */
  allowEmpty?: boolean;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  visible,
  title,
  message,
  placeholder,
  defaultValue,
  submitLabel,
  cancelLabel,
  multiline = false,
  allowEmpty = false,
  onSubmit,
  onCancel,
}) => {
  const { colors, spacing, radius } = useTheme();
  const [text, setText] = useState(defaultValue ?? '');

  // 모달이 새로 열릴 때 입력값 초기화
  useEffect(() => {
    if (visible) {
      setText(defaultValue ?? '');
    }
  }, [visible, defaultValue]);

  const trimmed = text.trim();
  const canSubmit = allowEmpty || trimmed.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable
          // 카드 내부 탭은 닫지 않도록 onPress 빈 핸들러
          onPress={() => {}}
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.lg,
            },
          ]}
        >
          <Text variant="title">{title}</Text>
          {message ? (
            <Text
              variant="caption"
              color="textSecondary"
              style={{ marginTop: spacing.xs }}
            >
              {message}
            </Text>
          ) : null}
          <View style={{ marginTop: spacing.md }}>
            <Input
              value={text}
              onChangeText={setText}
              placeholder={placeholder}
              multiline={multiline}
              autoFocus
            />
          </View>
          <View style={styles.actions}>
            <Button
              title={cancelLabel ?? '취소'}
              variant="ghost"
              onPress={onCancel}
              style={{ marginRight: spacing.sm }}
            />
            <Button
              title={submitLabel ?? '확인'}
              onPress={() => onSubmit(allowEmpty ? text : trimmed)}
              disabled={!canSubmit}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
});
