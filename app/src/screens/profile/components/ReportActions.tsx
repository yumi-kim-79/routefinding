/**
 * 제보 액션 버튼 — v1 _buildReportActionButtons 1:1.
 *
 * 권한:
 *   - 삭제: 본인 || 관리자 → Alert confirm → deleteDoc({collection}/{id})
 *           (v1의 휴리스틱 대신 `report.collection` 태그로 안전 분기)
 *   - 승인: 관리자 && status==pending → {collection}.update({status:'approved'})
 *   - 반려: 관리자 && status==pending → 부모가 PromptModal 띄움(onRequestReject)
 *
 * 아이콘 라이브러리는 [TBD]라 텍스트 버튼으로 — 향후 IconButton로 교체 TODO.
 */
import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { deleteDoc, doc, updateDoc } from '@react-native-firebase/firestore';
import { Button } from '../../../components/common/Button';
import { db } from '../../../services/firebase';
import type { Report } from '../../../types/report';

interface ReportActionsProps {
  report: Report;
  isMine: boolean;
  isAdmin: boolean;
  onRequestReject: (report: Report) => void;
}

export const ReportActions: React.FC<ReportActionsProps> = ({
  report,
  isMine,
  isAdmin,
  onRequestReject,
}) => {
  const canDelete = isMine || isAdmin;
  const canAdmin = isAdmin && report.status === 'pending';

  if (!canDelete && !canAdmin) {
    return null;
  }

  const onDelete = () => {
    Alert.alert('제보 삭제', '정말 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, report.collection, report.reportId));
            // snapshot 구독이 자동으로 목록에서 제거. 별도 토스트 생략.
          } catch (e) {
            Alert.alert(
              '오류',
              `삭제 실패: ${e instanceof Error ? e.message : e}`,
            );
          }
        },
      },
    ]);
  };

  const onApprove = async () => {
    try {
      // ⚠️ 예전엔 route_reports로 하드코딩돼 있었다(v1 동작 보존).
      //    관리자가 볼더링 제보까지 보게 되면서(2026-08-05) 그대로 두면
      //    **엉뚱한 컬렉션의 같은 id 문서를 승인**하게 된다 → 카드가 알려준 컬렉션을 쓴다.
      await updateDoc(doc(db, report.collection, report.reportId), {
        status: 'approved',
      });
      // 승인 → approved 필터에 의해 자동 제거
    } catch (e) {
      Alert.alert('오류', `승인 실패: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <View style={styles.row}>
      {canDelete ? (
        <Button
          title="삭제"
          size="sm"
          variant="ghost"
          onPress={onDelete}
          style={styles.btn}
        />
      ) : null}
      {canAdmin ? (
        <>
          <Button
            title="승인"
            size="sm"
            variant="secondary"
            onPress={onApprove}
            style={styles.btn}
          />
          <Button
            title="반려"
            size="sm"
            variant="ghost"
            onPress={() => onRequestReject(report)}
            style={styles.btn}
          />
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  btn: { marginLeft: 8 },
});
