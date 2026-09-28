/**
 * 커뮤니티 이용규칙 동의 — 글쓰기 전에 한 번.
 *
 * ⚠️ 이 화면은 **심사 통과의 필수 조건**이다. Apple 심사지침 1.2 는 UGC 앱에
 *    "불쾌한 콘텐츠와 abusive 이용자에 대해 무관용" 이라는 약관과
 *    **게시 전 사용자의 동의**를 요구한다. 문구를 무르게 고치지 말 것 —
 *    '무관용', '24시간 내 처리', '차단' 세 가지가 반드시 들어가야 한다.
 *
 * ⚠️ 동의는 **계정**(users/{uid}.communityAgreedAt)에 남긴다. 기기에 저장하면
 *    앱을 지웠다 깔 때마다 다시 묻게 되고, 분쟁 시 기록이 남지 않는다.
 */
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { doc, serverTimestamp, updateDoc } from '@react-native-firebase/firestore';
import { db } from '../../services/firebase';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { useTheme } from '../../theme';

export const COMMUNITY_RULES = [
  '욕설·비방·차별·음란물·불법 게시물은 **무관용**으로 삭제되며, 반복하면 이용이 제한됩니다.',
  '신고된 글은 24시간 안에 확인해 조치합니다. 신고가 쌓이면 확인 전에도 자동으로 숨겨집니다.',
  '불쾌한 이용자는 직접 차단할 수 있습니다. 차단하면 그 사람의 글과 댓글이 보이지 않습니다.',
  '중고거래는 회원 간 거래입니다. 앱은 중개하지 않으며 분쟁·손해에 책임지지 않습니다.',
  '⚠️ 로프·하네스·헬멧 등 추락 하중을 받는 장비는 이력을 알 수 없는 중고 거래를 권하지 않습니다.',
  '타인의 사진·개념도를 동의 없이 올리지 않습니다.',
];

interface Props {
  visible: boolean;
  uid: string;
  onAgree: () => void;
  onCancel: () => void;
}

export const CommunityRulesGate: React.FC<Props> = ({ visible, uid, onAgree, onCancel }) => {
  const { colors, radius } = useTheme();
  const [busy, setBusy] = useState(false);

  const agree = async () => {
    setBusy(true);
    try {
      await updateDoc(doc(db, 'users', uid), { communityAgreedAt: serverTimestamp() });
      onAgree();
    } catch (e) {
      Alert.alert('저장 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderRadius: radius.lg },
          ]}
        >
          <Text variant="title">커뮤니티 이용규칙</Text>
          <Text variant="caption" color="textSecondary">
            글을 쓰기 전에 한 번만 확인합니다.
          </Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listPad}>
            {COMMUNITY_RULES.map((r) => (
              <Text key={r} variant="body" style={styles.rule}>
                · {r.replace(/\*\*/g, '')}
              </Text>
            ))}
          </ScrollView>

          <Button title="동의하고 글쓰기" onPress={() => void agree()} disabled={busy} />
          <Button title="취소" variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: { width: '100%', maxHeight: '80%', padding: 20, rowGap: 10 },
  list: { maxHeight: 300 },
  listPad: { rowGap: 10, paddingVertical: 8 },
  rule: { lineHeight: 21 },
});
