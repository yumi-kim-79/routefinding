/**
 * 회원 탈퇴 섹션 — 마이프로필 탭 하단.
 *
 * ⚠️ App Store 심사 대응 (2026-08-12 반려, Guideline 5.1.1(v)).
 *   앱 안에서 **처음부터 끝까지** 탈퇴가 완료돼야 한다.
 *   외부 웹으로 보내거나 고객센터 연락을 요구하면 다시 반려된다.
 *
 * 흐름 (실수 방지용 2단계 확인 — 애플이 허용하는 범위):
 *   1) [회원 탈퇴] → 무엇이 지워지는지 명시한 확인 다이얼로그
 *   2) 비밀번호 재입력 (Firebase가 최근 로그인을 요구한다)
 *   3) 삭제 진행 → 완료 안내 → 자동 로그아웃
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { useTheme } from '../../../theme';
import {
  deleteAccount,
  reauthenticate,
} from '../../../services/accountDeletion';

export const DeleteAccountSection: React.FC = () => {
  const { colors, radius, spacing } = useTheme();

  const [step, setStep] = useState<'idle' | 'password'>('idle');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  /** 1단계 — 무엇이 지워지는지 명확히 알린다 */
  const onPressDelete = () => {
    Alert.alert(
      '회원 탈퇴',
      '탈퇴하면 아래 정보가 모두 삭제되며 되돌릴 수 없습니다.\n\n' +
        '· 프로필 (닉네임 · 사진 · 소개)\n' +
        '· 즐겨찾기한 루트\n' +
        '· 등반일지 전체\n' +
        '· 내가 올린 개념도 사진\n' +
        '· 승인 전 루트 제보\n\n' +
        '이미 승인되어 공개된 루트 정보는 다른 이용자를 위해 남습니다. ' +
        '단, 회원 정보가 삭제되므로 회원님과 연결되지 않습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '계속',
          style: 'destructive',
          onPress: () => {
            setError(null);
            setPassword('');
            setStep('password');
          },
        },
      ],
    );
  };

  /** 2단계 — 비밀번호 확인 후 실제 삭제 */
  const onConfirmDelete = async () => {
    if (!password) {
      setError('비밀번호를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setProgress('본인 확인 중…');
      await reauthenticate(password);

      await deleteAccount(setProgress);

      // 계정이 사라지면 onAuthStateChanged가 로그인 화면으로 되돌린다
      Alert.alert('탈퇴 완료', '그동안 이용해 주셔서 감사합니다.');
    } catch (e) {
      const code = (e as { code?: string })?.code ?? '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('비밀번호가 올바르지 않습니다.');
      } else if (code === 'auth/too-many-requests') {
        setError('시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setError(
          `탈퇴 처리 중 문제가 발생했습니다: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <View style={[styles.wrap, { borderTopColor: colors.divider }]}>
      <Text variant="label" color="textSecondary" style={styles.heading}>
        계정 관리
      </Text>

      {step === 'idle' ? (
        <>
          <Button
            title="회원 탈퇴"
            variant="ghost"
            onPress={onPressDelete}
            style={styles.dangerBtn}
          />
          <Text variant="caption" color="textSecondary" style={styles.note}>
            탈퇴하면 프로필·즐겨찾기·등반일지가 모두 삭제되며 복구할 수 없습니다.
          </Text>
        </>
      ) : (
        <View
          style={[
            styles.confirmBox,
            { borderColor: colors.error, borderRadius: radius.md },
          ]}
        >
          <Text variant="body" style={styles.confirmTitle}>
            본인 확인
          </Text>
          <Text variant="caption" color="textSecondary" style={styles.note}>
            보안을 위해 비밀번호를 다시 입력해 주세요.
          </Text>

          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호"
            password
            editable={!busy}
          />

          {error ? (
            <Text variant="caption" color="error" style={styles.note}>
              {error}
            </Text>
          ) : null}

          {busy ? (
            <View style={[styles.busyRow, { paddingVertical: spacing.sm }]}>
              <ActivityIndicator color={colors.primary} />
              <Text variant="caption" color="textSecondary" style={styles.busyText}>
                {progress || '처리 중…'}
              </Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Button
                title="취소"
                variant="ghost"
                onPress={() => {
                  setStep('idle');
                  setPassword('');
                  setError(null);
                }}
                style={styles.action}
              />
              <Button
                title="탈퇴하기"
                onPress={onConfirmDelete}
                style={styles.action}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 28, paddingTop: 20, borderTopWidth: 1 },
  heading: { marginBottom: 10 },
  dangerBtn: { borderColor: '#F44336' },
  note: { marginTop: 8, lineHeight: 18 },
  confirmBox: { borderWidth: 1, padding: 16 },
  confirmTitle: { fontWeight: '700', marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  action: { flex: 1 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  busyText: { flex: 1 },
});
