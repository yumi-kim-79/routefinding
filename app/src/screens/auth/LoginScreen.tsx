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
import { KeyboardAwareScroll } from '../../components/common/KeyboardAwareScroll';
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
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

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

  /**
   * 비밀번호 재설정 메일 발송.
   * 입력창의 이메일을 그대로 쓴다(따로 묻지 않아 단계를 줄인다).
   *
   * ⚠️ 2026-08-13 — "메일이 안 온다" 신고로 수정.
   *   이전 버전은 `catch`에서 **모든 에러를 조용히 삼키고** 성공 알럿을 띄웠다.
   *   그래서 App Check 거부·발송 한도 초과 같은 진짜 실패가 화면에 전혀 드러나지 않았다.
   *   → 계정 열거 방지가 필요한 `user-not-found`만 성공처럼 처리하고,
   *     나머지는 **에러 코드를 그대로 보여준다.** (원인 파악이 불가능해지는 쪽이 더 나쁘다)
   *
   *   참고: Firebase의 **이메일 열거 방지**가 켜져 있으면 등록되지 않은 주소에도
   *   에러 없이 성공을 돌려주고 메일은 보내지 않는다. 이 경우 앱에서는 구분할 수 없다.
   */
  const onResetPassword = async () => {
    const e = email.trim();
    if (!e) {
      setErrorText('이메일을 입력한 뒤 눌러주세요.');
      return;
    }
    setErrorText(null);
    setResetting(true);
    try {
      await sendPasswordReset(e);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[LoginScreen] sendPasswordReset 실패', code, message);
      setResetting(false);

      if (code === 'auth/invalid-email') {
        setErrorText('유효하지 않은 이메일 형식입니다.');
        return;
      }
      if (code === 'auth/too-many-requests') {
        setErrorText('시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      // `user-not-found`는 계정 열거 방지를 위해 성공과 똑같이 안내하고 넘어간다.
      if (code !== 'auth/user-not-found') {
        // 네트워크·App Check·발송 한도 등 — 숨기면 영영 못 고친다
        Alert.alert(
          '메일 발송 실패',
          `재설정 메일을 보내지 못했습니다.\n\n${code || '(코드 없음)'}\n${message}`,
        );
        return;
      }
    }
    setResetting(false);
    Alert.alert(
      '비밀번호 재설정 메일 발송',
      `${e} 로 재설정 링크를 보냈습니다.\n\n` +
        '메일이 보이지 않으면 스팸함 · 프로모션함도 꼭 확인해 주세요.\n' +
        '보내는 사람은 noreply@routefinding09-4b597.firebaseapp.com 입니다.\n\n' +
        '몇 분이 지나도 오지 않으면 가입할 때 쓴 주소가 맞는지 확인해 주세요.',
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
    <Screen padded={false}>
      {/* ⚠️ 키보드가 입력칸을 덮지 않게 — components/common/KeyboardAwareScroll.tsx 머리말 */}
      <KeyboardAwareScroll contentContainerStyle={styles.form}>
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

        {/*
          비밀번호 찾기 — 입력된 이메일로 재설정 메일을 보낸다.
          ⚠️ 계정이 없어도 "보냈다"고 안내한다. 응답이 다르면
             어떤 이메일이 가입돼 있는지 알아낼 수 있다(계정 열거).
        */}
        {/*
          '아이디 찾기'는 두지 않는다 (사용자 결정 2026-08-12).
          이 앱은 이메일로 로그인하므로 아이디 = 이메일이라 따로 찾을 대상이 없고,
          닉네임으로 이메일을 알려주는 기능은 개인정보 유출 통로가 된다.
          (보안 규칙상 users 조회는 로그인해야 가능해 기술적으로도 막혀 있다)
          대신 아래 안내 문구로 혼동을 줄인다.
        */}
        <Text variant="caption" color="textSecondary" style={styles.idHint}>
          아이디는 가입 시 사용한 이메일 주소입니다.
        </Text>

        <Button
          title="비밀번호를 잊으셨나요?"
          variant="ghost"
          onPress={onResetPassword}
          loading={resetting}
          style={styles.resetBtn}
        />
      </KeyboardAwareScroll>
    </Screen>
  );
};

const styles = StyleSheet.create({
  form: { padding: 16 },
  header: { alignItems: 'center', marginTop: 24, marginBottom: 32 },
  sub: { marginTop: 8 },
  error: { marginBottom: 8 },
  resetBtn: { marginTop: 4 },
  idHint: { textAlign: 'center', marginTop: 18 },
  loginBtn: { marginTop: 8 },
  signupBtn: { marginTop: 12 },
});
