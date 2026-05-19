/**
 * 회원가입 (v1 lib/sign_up_screen.dart 1:1).
 * - 닉네임 중복확인 버튼(v1 방식) → email/password → authStore.signUp
 * - signUp: 계정생성 + displayName + users/{uid} 문서 + 인증메일 + signOut
 * - 성공 시 안내 후 로그인 화면으로 (v1: 자동로그인 안 함)
 * 주: 프로필 이미지 업로드는 마이페이지(Phase 2-1), 이미지 피커 미도입.
 */
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../components/common/Screen';
import { Text } from '../../components/common/Text';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;

function mapSignUpError(code: string | undefined, message: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 사용 중인 이메일입니다.';
    case 'auth/invalid-email':
      return '유효하지 않은 이메일 형식입니다.';
    case 'auth/weak-password':
      return '비밀번호가 너무 짧거나 약합니다.';
    default:
      return `회원가입 실패: ${message}`;
  }
}

export const SignUpScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const signUp = useAuthStore((s) => s.signUp);
  const isNicknameAvailable = useUserStore((s) => s.isNicknameAvailable);

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [nickChecked, setNickChecked] = useState(false);
  const [nickError, setNickError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);

  const onCheckNickname = async () => {
    const nick = nickname.trim();
    if (!nick) {
      setNickChecked(false);
      setNickError('닉네임을 입력해주세요.');
      return;
    }
    setChecking(true);
    setNickError(null);
    try {
      const available = await isNicknameAvailable(nick);
      if (available) {
        setNickChecked(true);
        setNickError(null);
        Alert.alert('알림', '사용 가능한 닉네임입니다.');
      } else {
        setNickChecked(false);
        setNickError('이미 사용 중인 닉네임입니다.\n다른 닉네임을 입력해주세요.');
      }
    } catch {
      setNickChecked(false);
      setNickError('닉네임 확인 중 오류가 발생했습니다.');
    } finally {
      setChecking(false);
    }
  };

  const onSignUp = async () => {
    const nick = nickname.trim();
    const e = email.trim();
    const p = password.trim();

    if (!nickChecked) {
      setFormError('닉네임 중복 확인을 해주세요.');
      return;
    }
    if (!e || !p) {
      setFormError('이메일과 비밀번호를 입력하세요.');
      return;
    }
    setFormError(null);
    setLoading(true);
    try {
      await signUp(e, p, nick);
      Alert.alert(
        '회원가입 완료',
        '이메일 인증 메일을 전송했습니다. 메일을 확인해주세요.',
        [{ text: '확인', onPress: () => navigation.navigate('Login') }],
      );
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      setFormError(mapSignUpError(code, message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Input
            label="닉네임"
            value={nickname}
            onChangeText={(t) => {
              setNickname(t);
              setNickChecked(false);
            }}
            placeholder="닉네임"
            error={nickError}
          />
        </View>
        <Button
          title="중복 확인"
          size="sm"
          variant="secondary"
          loading={checking}
          onPress={onCheckNickname}
          style={styles.checkBtn}
        />
      </View>
      {nickChecked ? (
        <Text variant="caption" color="success" style={styles.ok}>
          사용 가능한 닉네임입니다.
        </Text>
      ) : null}

      <Input
        label="이메일"
        value={email}
        onChangeText={setEmail}
        placeholder="email@example.com"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Input
        label="비밀번호"
        value={password}
        onChangeText={setPassword}
        placeholder="비밀번호"
        password
      />

      {formError ? (
        <Text variant="caption" color="error" style={styles.error}>
          {formError}
        </Text>
      ) : null}

      <Button
        title="회원가입"
        onPress={onSignUp}
        loading={loading}
        style={styles.submit}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1 },
  checkBtn: { marginTop: 26, marginLeft: 8 },
  ok: { marginTop: -8, marginBottom: 8 },
  error: { marginBottom: 8 },
  submit: { marginTop: 8 },
});
