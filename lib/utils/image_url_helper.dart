// lib/utils/image_url_helper.dart

import 'package:firebase_storage/firebase_storage.dart';

/// Storage/HTTP URL에서 파일명 추출
String extractImageName(String rawUrl) {
  if (rawUrl.isEmpty) return '';
  final last = rawUrl.split('/').last;
  return last.contains('?') ? last.split('?').first : last;
}

/// HTTP/Firebase Storage 경로 문자열을 → 다운로드 URL 반환
/// 1) 이미 HTTP로 시작하면 그대로
/// 2) Storage refFromURL() 성공시 반환
/// 3) 실패(null) 시 fallback 경로에서 재시도(상위 함수에서 처리)
Future<String?> _resolveUrl(String rawUrl) async {
  if (rawUrl.startsWith('http')) return rawUrl;
  try {
    return await FirebaseStorage.instance.refFromURL(rawUrl).getDownloadURL();
  } catch (_) {
    return null;
  }
}

/// 게시글 이미지(post_images) 경로 → URL 보정
Future<String?> getPostImageUrl(String rawUrl, String postId) async {
  final first = await _resolveUrl(rawUrl);
  if (first != null) return first;

  // fallback: post_images/<postId>/<fileName>
  final name = extractImageName(rawUrl);
  if (name.isEmpty) return null;
  try {
    return await FirebaseStorage.instance
        .ref('post_images/$postId/$name')
        .getDownloadURL();
  } catch (_) {
    return null;
  }
}

/// 개념도(루트) 대표이미지(route_images) 경로 → URL 보정
Future<String?> getRouteImageUrl(
    String rawUrl,
    String reportId, {
      required String mountain,
      required String zone,
    }) async {
  final first = await _resolveUrl(rawUrl);
  if (first != null) return first;

  // fallback: route_images/<mountain>/<zone>/<reportId>/<fileName>
  final name = extractImageName(rawUrl);
  if (name.isEmpty) return null;
  final path = zone.isNotEmpty
      ? 'route_images/$mountain/$zone/$reportId/$name'
      : 'route_images/$mountain/$reportId/$name';
  try {
    return await FirebaseStorage.instance.ref(path).getDownloadURL();
  } catch (_) {
    return null;
  }
}

/// 피치 이미지(pitch_images) 경로 → URL 보정
Future<String?> getPitchImageUrl(
    String rawUrl,
    String mountain,
    String routeName,
    ) async {
  final first = await _resolveUrl(rawUrl);
  if (first != null) return first;

  // fallback: pitch_images/<mountain>/<routeName>/<fileName>
  final name = extractImageName(rawUrl);
  if (name.isEmpty) return null;
  final path = 'pitch_images/$mountain/$routeName/$name';
  try {
    return await FirebaseStorage.instance.ref(path).getDownloadURL();
  } catch (_) {
    return null;
  }
}
