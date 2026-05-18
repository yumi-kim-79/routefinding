// lib/image_helper.dart

import 'package:firebase_storage/firebase_storage.dart';

/// rawUrl에서 파일명(마지막 segment)만 꺼내줍니다.
/// ex) ".../검악A%2F0.%EA%B2%80%EC%95%85A.png?alt=media" → "0.검악A.png"
String extractImageName(String rawUrl) {
  final last = rawUrl.split('/').last;
  return last.contains('?') ? last.split('?').first : last;
}

/// Firebase Storage URL 또는 절대 URL을 안전하게 resolve
Future<String?> resolveImageUrl(String rawUrl) async {
  try {
    final ref = FirebaseStorage.instance.refFromURL(rawUrl);
    return await ref.getDownloadURL();
  } catch (_) {
    // 이미 http(s)로 시작하는 절대 URL이면 그대로 반환
    if (Uri.tryParse(rawUrl)?.hasAbsolutePath == true && rawUrl.startsWith('http')) {
      return rawUrl;
    }
    return null;
  }
}

/// route_reports/{reportId} 대표 이미지
Future<String?> getRouteImageUrl(String rawUrl, String reportId) async {
  final resolved = await resolveImageUrl(rawUrl);
  if (resolved != null) return resolved;

  final name = extractImageName(rawUrl);
  final ref = FirebaseStorage.instance.ref('route_images/$reportId/$name');
  try {
    return await ref.getDownloadURL();
  } catch (_) {
    return null;
  }
}

/// route_reports/{reportId}/pitches/{*} 피치 이미지
Future<String?> getPitchImageUrl(String rawUrl, String reportId) async {
  final resolved = await resolveImageUrl(rawUrl);
  if (resolved != null) return resolved;

  final name = extractImageName(rawUrl);
  final ref = FirebaseStorage.instance.ref('pitch_images/$reportId/$name');
  try {
    return await ref.getDownloadURL();
  } catch (_) {
    return null;
  }
}
