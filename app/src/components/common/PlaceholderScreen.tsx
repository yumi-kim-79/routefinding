/**
 * 플레이스홀더 화면
 *
 * Phase 1-3에서는 네비게이션 골격만 검증한다. 각 화면의 실제 마이그레이션은
 * 이후 스프린트(docs/05_ROADMAP.md Phase 2)에서 진행하며, 그때 이 컴포넌트를
 * 실제 구현으로 교체한다.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface PlaceholderScreenProps {
  /** 화면 제목 (디버그/식별용) */
  title: string;
  /** v1 대응 화면 메모 (선택) */
  note?: string;
}

export const PlaceholderScreen: React.FC<PlaceholderScreenProps> = ({
  title,
  note,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <Text style={styles.todo}>Phase 2에서 실제 화면으로 교체 예정</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  note: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },
  todo: {
    marginTop: 16,
    fontSize: 12,
    opacity: 0.5,
  },
});
