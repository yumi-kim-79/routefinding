/**
 * 로그인 (v1 lib/login_screen.dart 1:1).
 * - 이메일/비밀번호 → authStore.signIn (이메일 인증 게이트 포함)
 * - 미인증 차단 시 "이메일 인증 필요" + 재발송 (v1 AlertDialog → RN Alert)
 * - 에러 코드 매핑(v1 메시지) / SignUp 링크
 * 주: last_email 자동입력은 1-5 범위 제외(결정 A, 추후 userStore와 재검토).
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
import { EmailNotVerifiedError } from '../../types/auth';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

function mapAuthError(code: string | undefined, message: string): string {
  switch (code) {
    case 'auth/user-not-found':
      return '존재하지 않는 이메일입니다.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '비밀번호가 틀렸습니다.';
    case 'auth/invalid-email':
      return '유효하지 않은 이메일 형식입니다.';
    default:
      return `로그인 실패: ${message}`;
  }
}

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showVerifyDialog = (err: EmailNotVerifiedError) => {
    Alert.alert(
      '이메일 인증 필요',
      '이메일 인증이 완료되지 않았습니다.\n가입 시 입력한 이메일을 확인해주세요.\n스팸/프로모션함도 꼭 확인!',
      [
        {
          text: '인증메일 재발송',
          onPress: async () => {
            try {
              await err.resend();
              Alert.alert('알림', '인증메일을 재발송했습니다!');
            } catch (e) {
              const msg = e instanceof Error ? e.message : `${e}`;
              Alert.alert('알림', `메일 재발송에 실패했습니다.\n${msg}`);
            }
          },
        },
        { text: '확인', style: 'cancel' },
      ],
    );
  };

  const onLogin = async () => {
    const e = email.trim();
    const p = password.trim();
    if (!e || !p) {
      setErrorText('이메일과 비밀번호를 입력하세요.');
      return;
    }
    setErrorText(null);
    setLoading(true);
    try {
      await signIn(e, p);
      // 성공: onAuthStateChanged + gatePassed → RootNavigator가 Main 전환
    } catch (err) {
      if (err instanceof EmailNotVerifiedError) {
        showVerifyDialog(err);
      } else {
        const code = (err as { code?: string })?.code;
        const message = err instanceof Error ? err.message : '알 수 없는 오류';
        setErrorText(mapAuthError(code, message));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="display" color="primary">
          RouteFinding
        </Text>
        <Text variant="label" color="textSecondary" style={styles.sub}>
          로그인
        </Text>
      </View>

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

      {errorText ? (
        <Text variant="caption" color="error" style={styles.error}>
          {errorText}
        </Text>
      ) : null}

      <Button
        title="로그인"
        onPress={onLogin}
        loading={loading}
        style={styles.loginBtn}
      />
      <Button
        title="회원가입"
        variant="ghost"
        onPress={() => navigation.navigate('SignUp')}
        style={styles.signupBtn}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginTop: 24, marginBottom: 32 },
  sub: { marginTop: 8 },
  error: { marginBottom: 8 },
  loginBtn: { marginTop: 8 },
  signupBtn: { marginTop: 12 },
});
