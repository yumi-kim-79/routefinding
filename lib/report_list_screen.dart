import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import 'constants/firestore_fields.dart';
import 'report_detail_screen.dart';
import 'utils/colored_polylines.dart';
import '../common/profile_with_crown.dart';  // ★ 추가

class ReportListScreen extends StatelessWidget {
  const ReportListScreen({Key? key}) : super(key: key);

  static const _adminEmail = 'yusung790926@gmail.com';

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('내 루트 제보')),
        body: const Center(child: Text('로그인이 필요합니다.')),
      );
    }
    final isAdmin = user.email == _adminEmail;

    return Scaffold(
      appBar: AppBar(title: const Text('내 루트 제보')),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance
            .collection('route_reports')
            .where(RouteFields.authorUid, isEqualTo: user.uid)
            .orderBy(RouteFields.timestamp, descending: true)
            .snapshots(),
        builder: (ctx, snap) {
          if (snap.hasError) {
            return Center(child: Text('로드 실패: ${snap.error}'));
          }
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final docs = snap.data!.docs;
          if (docs.isEmpty) {
            return const Center(child: Text('작성한 제보가 없습니다.'));
          }
          return ListView.separated(
            itemCount: docs.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (ctx, i) => _buildReportTile(
              context: ctx,
              doc: docs[i],
              isAdmin: isAdmin,
            ),
          );
        },
      ),
    );
  }

  Widget _buildReportTile({
    required BuildContext context,
    required QueryDocumentSnapshot<Map<String, dynamic>> doc,
    required bool isAdmin,
  }) {
    final data = doc.data();
    final reportId = doc.id;
    final routeName = (data[RouteFields.routeName] ?? reportId).toString().trim();
    final mountain = (data[RouteFields.mountain] ?? '').toString().trim();
    final ts = data[RouteFields.timestamp] as Timestamp?;
    final time = ts != null ? _formatTimestamp(ts) : '';

    final authorUid = data[RouteFields.authorUid] as String? ?? '';

    // === 어프로치 경로 미니맵 ===
    final trackingPathRaw = data[RouteFields.trackingPath] as List<dynamic>? ?? [];
    final poly = ColoredPolylines.makeColoredPath(
      path: trackingPathRaw, arrowIcon: null, arrowInterval: 9999,
    );

    LatLng? start, end;
    if (trackingPathRaw.isNotEmpty && trackingPathRaw.first is Map) {
      start = LatLng(
        (trackingPathRaw.first['latitude'] as num).toDouble(),
        (trackingPathRaw.first['longitude'] as num).toDouble(),
      );
      end = LatLng(
        (trackingPathRaw.last['latitude'] as num).toDouble(),
        (trackingPathRaw.last['longitude'] as num).toDouble(),
      );
    } else if (trackingPathRaw.isNotEmpty && trackingPathRaw.first is LatLng) {
      start = trackingPathRaw.first as LatLng;
      end = trackingPathRaw.last as LatLng;
    }

    return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      future: authorUid.isNotEmpty
          ? FirebaseFirestore.instance.collection('users').doc(authorUid).get()
          : Future.value(null),
      builder: (context, userSnap) {
        String nickname = '(알 수 없는 사용자)';
        String? photoUrl;
        String? level;
        if (userSnap.hasData && userSnap.data != null && userSnap.data!.exists) {
          final userData = userSnap.data!.data()!;
          nickname = userData['nickname'] as String? ?? '(알 수 없는 사용자)';
          photoUrl = userData['photoUrl'] as String?;
          level = userData['level'] as String?;
        }

        return ListTile(
          leading: ProfileWithCrown(
            photoUrl: photoUrl,
            level: level,
            nickname: nickname,
            showNickname: false, // Row 오른쪽에 텍스트로 따로 표시
            displayType: 'comment',
            radius: 20,
            crownSize: 20,
          ),
          title: Text(routeName),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      nickname,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        overflow: TextOverflow.ellipsis,
                      ),
                      maxLines: 1,
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (time.isNotEmpty)
                    Text(
                      time,
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                ],
              ),
              if (mountain.isNotEmpty) Text(mountain),
              if (poly.polylines.isNotEmpty && start != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6.0),
                  child: SizedBox(
                    height: 80,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: IgnorePointer(
                        child: GoogleMap(
                          initialCameraPosition: CameraPosition(
                            target: start,
                            zoom: 15,
                          ),
                          polylines: poly.polylines,
                          markers: {
                            if (start != null)
                              Marker(
                                markerId: const MarkerId('start'),
                                position: start,
                                infoWindow: const InfoWindow(title: '출발'),
                              ),
                            if (end != null && start != end)
                              Marker(
                                markerId: const MarkerId('end'),
                                position: end,
                                infoWindow: const InfoWindow(title: '도착'),
                              ),
                            ...poly.markers,
                          },
                          zoomControlsEnabled: false,
                          myLocationButtonEnabled: false,
                          scrollGesturesEnabled: false,
                          rotateGesturesEnabled: false,
                          tiltGesturesEnabled: false,
                          zoomGesturesEnabled: false,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          isThreeLine: true,
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => ReportDetailScreen(
                reportId: reportId,
                reportData: doc,
              ),
            ),
          ),
          trailing: isAdmin
              ? IconButton(
            icon: const Icon(Icons.delete, color: Colors.red),
            onPressed: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (_) => AlertDialog(
                  title: const Text('제보 삭제'),
                  content: const Text('정말 삭제하시겠습니까?'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('취소')),
                    TextButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('삭제')),
                  ],
                ),
              );
              if (ok == true) {
                await FirebaseFirestore.instance
                    .collection('route_reports')
                    .doc(reportId)
                    .delete();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('제보가 삭제되었습니다.')),
                );
              }
            },
          )
              : null,
        );
      },
    );
  }

  String _formatTimestamp(Timestamp ts) {
    final d = ts.toDate().toLocal();
    final yyyy = d.year.toString().padLeft(4, '0');
    final MM = d.month.toString().padLeft(2, '0');
    final dd = d.day.toString().padLeft(2, '0');
    final hh = d.hour.toString().padLeft(2, '0');
    final mm = d.minute.toString().padLeft(2, '0');
    return '$yyyy-$MM-$dd $hh:$mm';
  }
}
