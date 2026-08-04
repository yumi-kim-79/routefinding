/**
 * 개념도 수정 (관리자 전용) — 웹 `views/ConceptEditView.vue` 대응.
 *
 * 입력 필드가 루트제보 작성과 완전히 같으므로 **`ReportWriteScreen`을 수정 모드로 재사용**한다.
 * (웹은 화면이 둘로 나뉘어 있어 필드가 갈라질 위험이 있는데, 여기서는 한 곳만 고치면 된다)
 *
 * 저장 시 `status`/`timestamp`/`authorUid`는 건드리지 않는다 — `reportService.updateReport` 참조.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, getDoc } from '@react-native-firebase/firestore';
import { db } from '../../services/firebase';
import { Text } from '../../components/common/Text';
import { useTheme } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import type { Concept, ConceptSource } from '../../types/concept';
import { conceptToForm } from '../../services/reportService';
import { ReportWriteScreen } from '../report/ReportWriteScreen';
import type { ReportFormEditTarget } from '../report/hooks/useReportForm';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Rt = RouteProp<MainStackParamList, 'ConceptEdit'>;

export const ConceptEditScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const [target, setTarget] = useState<ReportFormEditTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const source = params.source as ConceptSource;
        const snap = await getDoc(doc(db, source, params.conceptId));
        if (cancelled) {
          return;
        }
        if (!snap.exists()) {
          setError('개념도를 찾을 수 없습니다.');
          return;
        }
        const raw = snap.data() ?? {};
        const typeRoot = raw.typeRoot === '볼더링' ? '볼더링' : '리드';
        const concept = {
          ...raw,
          id: snap.id,
          source,
          type: typeRoot,
          climbType:
            typeof raw.type === 'string' && raw.type !== '리드' && raw.type !== '볼더링'
              ? raw.type
              : undefined,
        } as Concept;
        setTarget({ conceptId: snap.id, source, initial: conceptToForm(concept) });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '불러오기 실패');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.conceptId, params.source]);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text color="error">{error}</Text>
      </View>
    );
  }
  if (!target) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <ReportWriteScreen edit={target} onSaved={() => navigation.goBack()} />;
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
