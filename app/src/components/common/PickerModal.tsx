/**
 * 목록 선택 모달 (지도 필터의 등반지·구역, 루트제보 작성의 등반지·구역 공용).
 *
 * 웹은 `<select>`를 쓰지만 RN에는 대응 요소가 없다.
 * `@react-native-picker/picker`는 iOS(휠)와 Android(드롭다운) UI가 완전히 달라
 * "양쪽이 같아 보여야 한다"는 요구와 충돌 → **RN 빌트인 Modal로 자체 구현**한다.
 * (PromptModal이 `Alert.prompt`를 대신한 것과 같은 이유)
 */
import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../../theme';
import { AppIcon } from './AppIcon';

interface PickerModalProps {
  visible: boolean;
  title: string;
  options: string[];
  value: string;
  /** 선택 해제 항목 라벨 (예: '전체 산'). 빈 문자열 값으로 선택된다 */
  allLabel: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export const PickerModal: React.FC<PickerModalProps> = ({
  visible,
  title,
  options,
  value,
  allLabel,
  onSelect,
  onClose,
}) => {
  const { colors, radius, spacing } = useTheme();
  const rows = [{ key: '', label: allLabel }, ...options.map((o) => ({ key: o, label: o }))];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.header, { borderBottomColor: colors.divider, padding: spacing.md }]}>
            <Text variant="title">{title}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
              <Text color="textSecondary">
                닫기
              </Text>
            </Pressable>
          </View>
          <FlatList
            data={rows}
            keyExtractor={(item) => item.key || '__all__'}
            initialNumToRender={20}
            renderItem={({ item }) => {
              const active = item.key === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onSelect(item.key);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.md,
                      backgroundColor: pressed ? colors.surfaceVariant : 'transparent',
                    },
                  ]}
                >
                  <Text color={active ? 'primary' : 'textPrimary'}>{item.label}</Text>
                  {active ? <AppIcon name="check" size={18} color={colors.primary} /> : null}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '70%', overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
