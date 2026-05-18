// lib/services/upload_service.dart

import 'dart:io';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:image_picker/image_picker.dart';

class UploadService {
  final _db      = FirebaseFirestore.instance;
  final _storage = FirebaseStorage.instance;

  /// 대표 이미지 포함 새 루트 제보 생성
  Future<void> createRouteReport({
    required String mountain,
    required String routeName,
    required String overview,
    // …필요시 추가 필드(여기에 전달)
    Map<String, dynamic>? extraFields,
  }) async {
    // 필수 인자 확인
    if (mountain.trim().isEmpty || routeName.trim().isEmpty) {
      throw ArgumentError('산 이름, 루트 이름은 필수입니다.');
    }

    // 1. Firestore 문서 생성
    final data = <String, dynamic>{
      'mountain'  : mountain,
      'routeName' : routeName,
      'overview'  : overview,
      'status'    : 'pending',
      'timestamp' : FieldValue.serverTimestamp(),
      if (extraFields != null) ...extraFields,
    };
    final docRef = await _db.collection('route_reports').add(data);

    // 2. 갤러리에서 이미지 선택
    final xfile = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 1024,
    );
    if (xfile == null) return; // 사용자가 선택 안함

    final file     = File(xfile.path);
    final filename = xfile.name;

    // 3. Storage 업로드: 폴더 경로 통일
    final ref = _storage.ref('route_images/$mountain/$routeName/$filename');
    final snap = await ref.putFile(file);

    // 4. Firestore에 이미지 정보 저장
    final url = await snap.ref.getDownloadURL();
    await docRef.update({
      'imageUrl' : url,
      'imageName': filename,
    });
  }

  /// 피치 이미지 업로드 및 피치 추가
  Future<void> uploadPitchImage({
    required String reportId,
    required String mountain,
    required String routeName,
    required String pitchName,
    Map<String, dynamic>? extraFields, // (길이/난이도 등 전달 가능)
  }) async {
    if ([reportId, mountain, routeName, pitchName].any((v) => v.trim().isEmpty)) {
      throw ArgumentError('모든 인자는 필수입니다.');
    }

    // 1. 갤러리에서 이미지 선택
    final xfile = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 1024,
    );
    if (xfile == null) return;

    final file     = File(xfile.path);
    final filename = xfile.name;

    // 2. Storage 업로드 (루트와 동일 구조)
    final ref  = _storage.ref('route_images/$mountain/$routeName/$filename');
    final snap = await ref.putFile(file);

    // 3. Firestore 하위컬렉션에 추가
    final url = await snap.ref.getDownloadURL();
    await _db
        .collection('route_reports')
        .doc(reportId)
        .collection('pitches')
        .add({
      'name'     : pitchName,
      'imageUrl' : url,
      'imageName': filename,
      'timestamp': FieldValue.serverTimestamp(),
      if (extraFields != null) ...extraFields,
    });
  }
}
