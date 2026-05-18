// lib/sign_up_screen.dart

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:routefinding/services/auth_service.dart';

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({Key? key}) : super(key: key);

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _nicknameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _pwCtrl = TextEditingController();
  final _pwConfirmCtrl = TextEditingController();

  bool _loading = false;
  bool _isCheckingNickname = false;
  bool _nicknameAvailable = false;
  String? _nicknameErrorText;
  String? _pwErrorText;

  @override
  void initState() {
    super.initState();
    _pwConfirmCtrl.addListener(_validatePasswordMatch);
    _pwCtrl.addListener(_validatePasswordMatch);
  }

  @override
  void dispose() {
    _nicknameCtrl.dispose();
    _emailCtrl.dispose();
    _pwCtrl.dispose();
    _pwConfirmCtrl.dispose();
    super.dispose();
  }

  void _validatePasswordMatch() {
    if (_pwCtrl.text.isNotEmpty &&
        _pwConfirmCtrl.text.isNotEmpty &&
        _pwCtrl.text != _pwConfirmCtrl.text) {
      setState(() => _pwErrorText = '비밀번호가 일치하지 않습니다.');
    } else {
      setState(() => _pwErrorText = null);
    }
  }

  Future<void> _checkNicknameDuplicate() async {
    final nick = _nicknameCtrl.text.trim();
    if (nick.isEmpty) {
      setState(() {
        _nicknameErrorText = '닉네임을 입력해주세요.';
        _nicknameAvailable = false;
      });
      return;
    }

    setState(() {
      _isCheckingNickname = true;
      _nicknameErrorText = null;
      _nicknameAvailable = false;
    });

    try {
      final querySnapshot = await FirebaseFirestore.instance
          .collection('users')
          .where('nickname', isEqualTo: nick)
          .limit(1)
          .get();

      if (querySnapshot.docs.isNotEmpty) {
        setState(() {
          _nicknameErrorText = '이미 사용 중인 닉네임입니다.\n다른 닉네임을 입력해주세요.';
          _nicknameAvailable = false;
        });
      } else {
        setState(() {
          _nicknameErrorText = null;
          _nicknameAvailable = true;
        });
      }
    } catch (_) {
      setState(() {
        _nicknameErrorText = '닉네임 확인 중 오류가 발생했습니다.';
        _nicknameAvailable = false;
      });
    } finally {
      setState(() => _isCheckingNickname = false);
    }
  }

  Future<void> _signUp() async {
    final nick = _nicknameCtrl.text.trim();
    final email = _emailCtrl.text.trim();
    final pw = _pwCtrl.text;
    final pwConfirm = _pwConfirmCtrl.text;

    if (!_nicknameAvailable) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('먼저 닉네임 중복 확인을 해주세요.')),
      );
      return;
    }

    if (pw.isEmpty || pwConfirm.isEmpty || pw != pwConfirm) {
      setState(() => _pwErrorText = '비밀번호가 일치하지 않습니다.');
      return;
    }

    if (email.isEmpty || pw.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('이메일과 비밀번호를 모두 입력해주세요.')),
      );
      return;
    }

    setState(() => _loading = true);
    FirebaseAuth.instance.setLanguageCode('ko');

    try {
      final userCredential = await AuthService().signUp(
        email: email,
        password: pw,
        displayName: nick,
      );

      final uid = userCredential.user?.uid;
      if (uid == null) throw Exception('UID 가져오기 실패');

      // Firestore에 사용자 문서 추가
      await FirebaseFirestore.instance.collection('users').doc(uid).set({
        'nickname': nick,
        'email': email,
        'createdAt': FieldValue.serverTimestamp(),
      });

      // 이메일 인증 전송
      await userCredential.user?.sendEmailVerification();

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('이메일 인증 메일을 전송했습니다. 메일을 확인해주세요.')),
      );

      Navigator.pushReplacementNamed(context, '/login');
    } on FirebaseAuthException catch (e) {
      String message = '회원가입 실패: ${e.message}';
      if (e.code == 'email-already-in-use') {
        message = '이미 사용 중인 이메일입니다.';
      } else if (e.code == 'invalid-email') {
        message = '유효하지 않은 이메일 형식입니다.';
      } else if (e.code == 'weak-password') {
        message = '비밀번호가 너무 짧거나 약합니다.';
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('회원가입 중 오류가 발생했습니다: $e')),
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('회원가입')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('사용할 닉네임', style: TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _nicknameCtrl,
                    decoration: InputDecoration(
                      hintText: '닉네임을 입력하세요',
                      errorText: _nicknameErrorText,
                      border: const OutlineInputBorder(),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
                    ),
                    onChanged: (_) {
                      setState(() {
                        _nicknameAvailable = false;
                        _nicknameErrorText = null;
                      });
                    },
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _isCheckingNickname ? null : _checkNicknameDuplicate,
                    child: _isCheckingNickname
                        ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                        : const Text('중복 확인'),
                  ),
                ),
              ],
            ),
            if (_nicknameAvailable && _nicknameErrorText == null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  '중복이 없는 닉네임은 사용할 수 있는 닉네임입니다.',
                  style: TextStyle(color: Colors.green.shade700, fontSize: 14),
                ),
              ),
            const SizedBox(height: 24),
            const Text('이메일', style: TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            TextField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                hintText: 'example@domain.com',
                border: OutlineInputBorder(),
                isDense: true,
                contentPadding: EdgeInsets.symmetric(vertical: 12, horizontal: 12),
              ),
            ),
            const SizedBox(height: 24),
            const Text('비밀번호', style: TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            TextField(
              controller: _pwCtrl,
              obscureText: true,
              decoration: const InputDecoration(
                hintText: '비밀번호를 입력하세요',
                border: OutlineInputBorder(),
                isDense: true,
                contentPadding: EdgeInsets.symmetric(vertical: 12, horizontal: 12),
              ),
            ),
            const SizedBox(height: 24),
            const Text('비밀번호 확인', style: TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            TextField(
              controller: _pwConfirmCtrl,
              obscureText: true,
              decoration: InputDecoration(
                hintText: '비밀번호를 다시 입력하세요',
                border: const OutlineInputBorder(),
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
                errorText: _pwErrorText,
              ),
            ),
            const SizedBox(height: 32),
            _loading
                ? const Center(child: CircularProgressIndicator())
                : SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: (_nicknameAvailable &&
                    _pwErrorText == null &&
                    _emailCtrl.text.isNotEmpty &&
                    _pwCtrl.text.isNotEmpty &&
                    _pwConfirmCtrl.text.isNotEmpty)
                    ? _signUp
                    : null,
                child: const Text(
                  '회원가입',
                  style: TextStyle(fontSize: 16),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Center(
              child: TextButton(
                onPressed: () => Navigator.pushReplacementNamed(context, '/login'),
                child: Text(
                  '이미 계정이 있으신가요? 로그인',
                  style: TextStyle(color: theme.primaryColor),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
