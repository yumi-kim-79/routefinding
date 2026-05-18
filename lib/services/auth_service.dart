// lib/services/auth_service.dart

import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  /// FCM 토큰을 Firestore users/{uid} 문서에 저장
  Future<void> _saveFcmTokenToFirestore(User user) async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await _firestore.collection('users').doc(user.uid).set(
          {'fcmToken': token},
          SetOptions(merge: true),
        );
      }
    } catch (e) {
      // 토큰 저장 실패해도 회원 기능에는 영향 없음. 로깅 등 필요시 여기 추가
    }
  }

  /// 이메일/비밀번호 회원가입 및 Firestore users/{uid} 생성
  Future<UserCredential> signUp({
    required String email,
    required String password,
    required String displayName,
  }) async {
    // 1) Firebase Auth 회원 생성
    final userCredential = await _auth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
    final user = userCredential.user;
    if (user == null) {
      throw Exception('회원가입 중 알 수 없는 오류가 발생했습니다.');
    }
    // 2) Auth displayName 설정
    await user.updateDisplayName(displayName);

    // 3) Firestore users/{uid} 생성
    await _firestore.collection('users').doc(user.uid).set({
      'nickname': displayName,
      'email': email,
      'createdAt': FieldValue.serverTimestamp(),
    });

    // 4) FCM 토큰 저장
    await _saveFcmTokenToFirestore(user);

    return userCredential;
  }

  /// 로그인 + FCM 토큰 저장(항상 최신값)
  Future<UserCredential> signIn({
    required String email,
    required String password,
  }) async {
    final credential = await _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
    final user = credential.user;
    if (user != null) {
      await _saveFcmTokenToFirestore(user);
    }
    return credential;
  }

  /// 로그아웃
  Future<void> signOut() async {
    await _auth.signOut();
  }
}
