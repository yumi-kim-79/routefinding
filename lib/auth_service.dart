// lib/auth_service.dart

import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  /// 현재 로그인된 사용자 반환
  User? get currentUser => _auth.currentUser;

  /// 인증 상태 스트림 (앱 전체에서 사용)
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  /// 회원가입 + Firestore 프로필 생성 + FCM 토큰 저장
  Future<User?> signUp({
    required String email,
    required String password,
    required String displayName,
  }) async {
    final cred = await _auth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
    final user = cred.user;
    if (user != null) {
      // 1) Firestore 프로필 생성
      await _firestore.collection('users').doc(user.uid).set({
        'email': email,
        'nickname': displayName,
        'createdAt': FieldValue.serverTimestamp(),
      });
      // 2) Auth displayName 설정
      await user.updateDisplayName(displayName);
      // 3) FCM 토큰 받아서 Firestore에 저장
      final token = await _messaging.getToken();
      if (token != null) {
        await _firestore
            .collection('users')
            .doc(user.uid)
            .update({'fcmToken': token});
      }
    }
    return user;
  }

  /// 이메일/비밀번호 로그인 + FCM 토큰 갱신
  Future<User?> signIn({
    required String email,
    required String password,
  }) async {
    final cred = await _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
    final user = cred.user;
    if (user != null) {
      // 로그인 시 FCM 토큰 업데이트
      final token = await _messaging.getToken();
      if (token != null) {
        await _firestore
            .collection('users')
            .doc(user.uid)
            .update({'fcmToken': token});
      }
    }
    return user;
  }

  /// 로그아웃
  Future<void> signOut() async => await _auth.signOut();

  /// 관리자 권한(이메일 하드코딩)
  bool isAdmin() {
    final email = _auth.currentUser?.email;
    return email == 'yusung790926@gmail.com';
  }
}
