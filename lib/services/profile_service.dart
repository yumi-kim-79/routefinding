// lib/services/profile_service.dart

import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';

class ProfileService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseStorage _storage = FirebaseStorage.instance;

  User? get currentUser => _auth.currentUser;

  /// [users/{uid}] 프로필 문서 조회
  Future<DocumentSnapshot<Map<String, dynamic>>> fetchProfileDoc() async {
    final user = currentUser;
    if (user == null) {
      throw FirebaseAuthException(
        code: 'no-current-user',
        message: '로그인된 사용자가 없습니다.',
      );
    }
    return _firestore.collection('users').doc(user.uid).get();
  }

  /// 프로필 사진 업로드 & Firestore photoUrl 필드 반영 (다운로드 URL 리턴)
  Future<String> uploadProfilePhoto(File file) async {
    final user = currentUser;
    if (user == null) {
      throw FirebaseAuthException(
        code: 'no-current-user',
        message: '로그인된 사용자가 없습니다.',
      );
    }

    // ⚠️ 프로필 사진은 반드시 profile_photos/{uid}.jpg 경로로 저장
    final ref = _storage.ref('profile_photos/${user.uid}.jpg');

    final uploadTask = ref.putFile(file);
    final snapshot = await uploadTask.whenComplete(() {});
    final downloadUrl = await snapshot.ref.getDownloadURL();

    await _firestore.collection('users').doc(user.uid).update({
      'photoUrl': downloadUrl,
    });

    return downloadUrl;
  }

  /// 닉네임(=displayName) 업데이트 (Firestore + Auth displayName 동시 반영)
  Future<void> updateDisplayName(String newName) async {
    final user = currentUser;
    if (user == null) {
      throw FirebaseAuthException(
        code: 'no-current-user',
        message: '로그인된 사용자가 없습니다.',
      );
    }
    await _firestore.collection('users').doc(user.uid).update({
      'displayName': newName,
    });
    await user.updateDisplayName(newName);
  }

  /// 비밀번호 변경: 현재 비밀번호 재입력(re-auth) 필요
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final user = currentUser;
    if (user == null) {
      throw FirebaseAuthException(
        code: 'no-current-user',
        message: '로그인된 사용자가 없습니다.',
      );
    }
    final email = user.email;
    if (email == null) {
      throw FirebaseAuthException(
        code: 'invalid-user',
        message: '이메일 기반 계정이 아닙니다.',
      );
    }
    final credential = EmailAuthProvider.credential(
      email: email,
      password: currentPassword,
    );

    try {
      await user.reauthenticateWithCredential(credential);
    } on FirebaseAuthException catch (e) {
      throw FirebaseAuthException(
        code: e.code,
        message: '재인증 실패: ${e.message}',
      );
    }

    try {
      await user.updatePassword(newPassword);
    } on FirebaseAuthException catch (e) {
      throw FirebaseAuthException(
        code: e.code,
        message: '비밀번호 변경 실패: ${e.message}',
      );
    }
  }

  /// 비밀번호 재설정 이메일 전송(로그인 이메일로)
  Future<void> sendPasswordResetEmail() async {
    final user = currentUser;
    if (user == null || user.email == null) {
      throw FirebaseAuthException(
        code: 'invalid-user',
        message: '로그인된 사용자가 없거나 이메일 정보가 없습니다.',
      );
    }
    await _auth.sendPasswordResetEmail(email: user.email!);
  }
}
