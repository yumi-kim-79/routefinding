// lib/route_report_list_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'constants/firestore_fields.dart';
import 'widgets/watermarked_image.dart';
import 'widgets/full_image_screen.dart';

Future<String?> _resolveImageUrl(String rawUrl) async {
  if (rawUrl.startsWith('http')) return rawUrl;
  try {
    return await FirebaseStorage.instance.refFromURL(rawUrl).getDownloadURL();
  } catch (_) {
    return null;
  }
}

class RouteReportListScreen extends StatefulWidget {
  const RouteReportListScreen({Key? key}) : super(key: key);

  @override
  State<RouteReportListScreen> createState() => _RouteReportListScreenState();
}

class _RouteReportListScreenState extends State<RouteReportListScreen> {
  static const _adminEmail = 'yusung790926@gmail.com';
  User? _user;
  bool _isAdmin = false;
  String _uid = '';

  @override
  void initState() {
    super.initState();
    _user = FirebaseAuth.instance.currentUser;
    _isAdmin = (_user?.email == _adminEmail);
    _uid = _user?.uid ?? '';
  }

  @override
  Widget build(BuildContext context) {
    final col = FirebaseFirestore.instance.collection('route_reports');
    final stream = _isAdmin
        ? col.orderBy(RouteFields.timestamp, descending: true).snapshots()
        : col.where(RouteFields.authorUid, isEqualTo: _uid)
        .orderBy(RouteFields.timestamp, descending: true)
        .snapshots();

    return Scaffold(
      appBar: AppBar(title: const Text('루트 제보 목록')),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: stream,
        builder: (ctx, snap) {
          if (snap.hasError) {
            return Center(child: Text('에러: ${snap.error}'));
          }
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final docs = snap.data!.docs;
          if (docs.isEmpty) {
            return const Center(child: Text('등록된 제보가 없습니다.'));
          }
          return ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: docs.length,
            itemBuilder: (ctx2, idx) {
              final data = docs[idx].data();
              final reportId = docs[idx].id;
              final mountain = data[RouteFields.mountain] as String? ?? '등반지 없음';
              final routeName = data[RouteFields.routeName] as String? ?? '이름 없음';
              final rawImageUrl = data[RouteFields.imageUrl] as String? ?? '';
              final authorUid = data[RouteFields.authorUid] as String? ?? '';
              final timestamp = data[RouteFields.timestamp] as Timestamp?;
              final dateStr = timestamp != null
                  ? _formatDate(timestamp.toDate())
                  : '';

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Card(
                  elevation: 2,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () {
                      // TODO: 상세 화면 네비게이션 필요시 연결
                      // Navigator.push(...);
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // 썸네일 이미지
                          SizedBox(
                            width: 60,
                            height: 60,
                            child: rawImageUrl.isEmpty
                                ? const Icon(Icons.photo, size: 40, color: Colors.grey)
                                : FutureBuilder<String?>(
                              future: _resolveImageUrl(rawImageUrl),
                              builder: (c, imgSnap) {
                                if (imgSnap.connectionState != ConnectionState.done) {
                                  return const Center(
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  );
                                }
                                final url = imgSnap.data;
                                if (url == null) {
                                  return const Icon(Icons.broken_image, size: 40, color: Colors.grey);
                                }
                                return GestureDetector(
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => FullImageScreen(
                                          imageUrl: url,
                                          watermarkText: 'RouteFinding',
                                        ),
                                      ),
                                    );
                                  },
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(6),
                                    child: WatermarkedImage(
                                      imageProvider: NetworkImage(url),
                                      width: 60,
                                      height: 60,
                                      watermarkText: 'RouteFinding',
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),

                          const SizedBox(width: 12),

                          // 텍스트 정보
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // 제목 (등반지 · 루트이름)
                                Text(
                                  '$mountain · $routeName',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                // 작성자 닉네임
                                _buildNickname(authorUid),
                                const SizedBox(height: 2),
                                // 작성일
                                Text(
                                  '작성일: $dateStr',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Colors.black54,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          // 오른쪽 화살표
                          const Icon(Icons.chevron_right, color: Colors.grey),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildNickname(String authorUid) {
    if (authorUid.isEmpty) {
      return const Text(
        '작성자: (알 수 없는 사용자)',
        style: TextStyle(fontSize: 12, color: Colors.black54),
        maxLines: 1, overflow: TextOverflow.ellipsis,
      );
    }
    return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      future: FirebaseFirestore.instance
          .collection('users')
          .doc(authorUid)
          .get(),
      builder: (uSnapCtx, uSnap) {
        String nickname = '(알 수 없는 사용자)';
        if (uSnap.connectionState == ConnectionState.done &&
            uSnap.data != null &&
            uSnap.data!.exists) {
          nickname = uSnap.data!.data()?['nickname'] as String? ??
              '(닉네임 없음)';
        }
        return Text(
          '작성자: $nickname',
          style: const TextStyle(fontSize: 12, color: Colors.black54),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        );
      },
    );
  }

  String _formatDate(DateTime dt) {
    final y = dt.year.toString().padLeft(4, '0');
    final mo = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final h = dt.hour.toString().padLeft(2, '0');
    final mi = dt.minute.toString().padLeft(2, '0');
    return '$y-$mo-$d $h:$mi';
  }
}
