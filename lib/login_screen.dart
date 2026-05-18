// login_screen.dart

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _pwCtrl = TextEditingController();

  bool _loading = false;
  String? _errorText;

  static const adminEmails = ['yusung790926@gmail.com'];

  @override
  void initState() {
    super.initState();
    _loadLastEmail();
  }

  Future<void> _loadLastEmail() async {
    final prefs = await SharedPreferences.getInstance();
    final lastEmail = prefs.getString('last_email');
    if (lastEmail != null && lastEmail.isNotEmpty) {
      _emailCtrl.text = lastEmail;
    }
  }

  Future<void> _saveLastEmail(String email) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('last_email', email);
  }

  /// 로그인 후 FCM 토큰 Firestore에 저장
  Future<void> _saveFcmToken() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    final token = await FirebaseMessaging.instance.getToken();
    if (token == null) return;
    try {
      await FirebaseFirestore.instance.collection('users').doc(user.uid).update({
        'fcmToken': token,
      });
    } catch (_) {
      // 무시: 신규 회원가입 시 user doc 자동 생성됨
    }
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _pwCtrl.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    final email = _emailCtrl.text.trim();
    final pw = _pwCtrl.text.trim();

    if (email.isEmpty || pw.isEmpty) {
      setState(() => _errorText = '이메일과 비밀번호를 입력하세요.');
      return;
    }

    setState(() {
      _loading = true;
      _errorText = null;
    });

    try {
      final credential = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: email,
        password: pw,
      );
      final user = credential.user;
      if (user == null) throw Exception('사용자 정보를 불러오지 못했습니다.');

      await user.reload();
      final refreshedUser = FirebaseAuth.instance.currentUser;

      // Firestore 유저 정보 및 가입일
      final userDoc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
      final createdAt = userDoc.data()?['createdAt'];

      final isAdmin = adminEmails.contains(user.email);
      final standardDate = DateTime.utc(2025, 5, 1, 5, 0, 0);
      bool isOldUser = false;
      if (createdAt != null && createdAt is Timestamp) {
        isOldUser = createdAt.toDate().isBefore(standardDate);
      } else {
        isOldUser = true; // createdAt이 없으면 예전 유저로 간주
      }

      if (!refreshedUser!.emailVerified && !isOldUser && !isAdmin) {
        await FirebaseAuth.instance.signOut();
        await showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) {
            bool resendLoading = false;
            return StatefulBuilder(
              builder: (context, setState) => AlertDialog(
                title: const Text('이메일 인증 필요'),
                content: const Text(
                  '이메일 인증이 완료되지 않았습니다.\n'
                      '가입 시 입력한 이메일을 확인해주세요.\n'
                      '스팸/프로모션함도 꼭 확인!\n\n'
                      '메일을 다시 받고 싶으시면 아래 버튼을 눌러주세요.',
                ),
                actions: [
                  TextButton(
                    onPressed: resendLoading
                        ? null
                        : () async {
                      setState(() => resendLoading = true);
                      try {
                        await user.sendEmailVerification();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('인증메일을 재발송했습니다!')),
                        );
                      } catch (e) {
                        String msg = '메일 재발송에 실패했습니다.';
                        if (e is FirebaseAuthException) {
                          msg += '\n(${e.code})';
                        } else {
                          msg += '\n$e';
                        }
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(msg)),
                        );
                      } finally {
                        setState(() => resendLoading = false);
                      }
                    },
                    child: resendLoading
                        ? const SizedBox(
                      width: 18, height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                        : const Text('인증메일 재발송'),
                  ),
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('확인'),
                  ),
                ],
              ),
            );
          },
        );
        return;
      }

      // 로그인 성공: 이메일 인증자 or 예전 회원 or 관리자
      await _saveLastEmail(email);
      await _saveFcmToken();
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/home');
    } on FirebaseAuthException catch (e) {
      String msg = '로그인 실패: ${e.message}';
      if (e.code == 'user-not-found') msg = '존재하지 않는 이메일입니다.';
      else if (e.code == 'wrong-password') msg = '비밀번호가 틀렸습니다.';
      setState(() => _errorText = msg);
    } catch (e) {
      setState(() => _errorText = '로그인 중 오류가 발생했습니다: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('로그인')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 48),
            TextField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                hintText: '이메일',
                border: OutlineInputBorder(),
                isDense: true,
                contentPadding: EdgeInsets.symmetric(vertical: 12, horizontal: 12),
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _pwCtrl,
              obscureText: true,
              decoration: const InputDecoration(
                hintText: '비밀번호',
                border: OutlineInputBorder(),
                isDense: true,
                contentPadding: EdgeInsets.symmetric(vertical: 12, horizontal: 12),
              ),
            ),
            const SizedBox(height: 28),
            if (_errorText != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(
                  _errorText!,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            _loading
                ? const Center(child: CircularProgressIndicator())
                : SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: _signIn,
                child: const Text('로그인', style: TextStyle(fontSize: 16)),
              ),
            ),
            const SizedBox(height: 18),
            Center(
              child: TextButton(
                onPressed: () => Navigator.pushReplacementNamed(context, '/signup'),
                child: const Text('계정이 없으신가요? 회원가입'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
