/**
 * 폐쇄 안내 — 큰 안내창(모달)과 상단 배너.
 *
 * ⚠️ 이 화면은 **무엇도 막지 않는다.** 닫기를 누르면 개념도를 그대로 본다.
 *    사진·피치·난이도도 그대로고 제보·완등 기록도 된다 (types/closure.ts 머리말).
 *    "닫혔으니 못 보게 하자"로 가면 자료가 지워지는 길로 이어진다.
 *
 * ⚠️ 모달을 닫아도 **배너는 남는다.** 큰 창은 한 번이면 충분하지만,
 *    스크롤하다 잊어버리는 게 더 위험하다.
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { useTheme } from '../../../theme';
import {
  closurePeriod,
  DEFAULT_CLOSURE_REASON,
  type ActiveClosure,
} from '../../../types/closure';

function headline(c: ActiveClosure): string {
  return c.level === 'crag'
    ? `${c.scopeName} 전체가 닫혀 있습니다`
    : `${c.scopeName} 등반이 제한되고 있습니다`;
}

/** 화면 맨 위 빨간 띠 — 모달을 닫아도 계속 남는다 */
export const ClosureBanner: React.FC<{ closure: ActiveClosure; onPress?: () => void }> = ({
  closure,
  onPress,
}) => {
  const { colors, radius, spacing } = useTheme();
  const period = closurePeriod(closure);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={[
        styles.banner,
        {
          backgroundColor: colors.error,
          borderRadius: radius.md,
          padding: spacing.sm,
          /*
           * ⚠️ 좌우 마진을 주지 않는다. 이 배너는 이미 padding 이 있는 컨테이너
           *    (개념도 상세의 ScrollView) 안에 들어가서 여백이 두 번 먹는다.
           */
          marginBottom: spacing.sm,
        },
      ]}
    >
      <Text variant="label" style={{ color: '#ffffff' }}>
        ⛔ {closure.level === 'crag' ? '구역 폐쇄' : '루트 폐쇄'}
        {period ? ` · ${period}` : ''}
      </Text>
      <Text
        variant="caption"
        numberOfLines={2}
        style={{ color: '#ffffff', marginTop: 2 }}
      >
        {closure.reason?.trim() || DEFAULT_CLOSURE_REASON}
      </Text>
    </Pressable>
  );
};

export const ClosureModal: React.FC<{
  closure: ActiveClosure;
  visible: boolean;
  onClose: () => void;
}> = ({ closure, visible, onClose }) => {
  const { colors, radius, spacing } = useTheme();
  const period = closurePeriod(closure);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      /* 안드로이드 뒤로가기로도 닫힌다 — 닫을 수 없는 창이 아니다 */
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderRadius: radius.lg },
          ]}
        >
          <View
            style={[
              styles.head,
              { backgroundColor: colors.error, padding: spacing.md },
            ]}
          >
            <Text variant="title" style={{ color: '#ffffff' }}>
              ⛔ {headline(closure)}
            </Text>
            {period ? (
              <Text variant="caption" style={{ color: '#ffffff', marginTop: 4 }}>
                {period}
              </Text>
            ) : null}
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ padding: spacing.md }}>
            <Text variant="body">
              {closure.reason?.trim() || DEFAULT_CLOSURE_REASON}
            </Text>

            {/*
              ⚠️ 이 문단을 지우지 말 것.
                 폐쇄 안내를 보면 사용자는 "이 자료는 이제 못 쓰는 건가"로 받아들인다.
                 개념도가 남아 있다는 것과, 다시 열릴 수 있다는 것을 같이 말해야
                 자료를 지워 달라는 요청이나 이탈로 이어지지 않는다.
            */}
            <Text variant="caption" color="textSecondary" style={styles.note}>
              개념도와 사진은 그대로 볼 수 있고, 정보 제보와 수정도 계속 하실 수 있습니다.
              폐쇄가 풀리면 이 안내는 사라집니다.
            </Text>

            <Text variant="caption" color="textSecondary" style={styles.note}>
              현장 상황은 바뀔 수 있습니다. 가시기 전에 관리 기관이나 지역 클라이머에게
              한 번 더 확인해 주세요. 잘못된 내용이면 마이페이지 ▸ 문의로 알려주시면
              바로 고치겠습니다.
            </Text>
          </ScrollView>

          <View style={{ padding: spacing.md, paddingTop: 0 }}>
            <Button title="닫기" onPress={onClose} size="lg" />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  banner: { width: 'auto' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: { width: '100%', maxWidth: 420, overflow: 'hidden', maxHeight: '80%' },
  head: {},
  body: { flexGrow: 0 },
  note: { marginTop: 12, lineHeight: 19 },
});
