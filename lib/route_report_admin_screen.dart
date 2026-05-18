// lib/route_report_admin_screen.dart
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'constants/firestore_fields.dart';
import 'map_input_screen.dart';
import 'constants/level.dart'; // updateUserPointAndLevel 함수가 들어있는 파일


class RouteReportAdminScreen extends StatefulWidget {
  const RouteReportAdminScreen({Key? key}) : super(key: key);

  @override
  State<RouteReportAdminScreen> createState() => _RouteReportAdminScreenState();
}

class _RouteReportAdminScreenState extends State<RouteReportAdminScreen> {
  final CollectionReference<Map<String, dynamic>> _col =
  FirebaseFirestore.instance.collection('route_reports');

  final Set<String> _selectedIds = {};
  List<String> _allIds = [];
  Map<String, int> _pitchCounts = {};
  int _refreshKey = 0;
  bool _processing = false;

  bool get _allSelected => _allIds.isNotEmpty && _selectedIds.length == _allIds.length;

  Future<void> _goToNewReport() async {
    setState(() => _processing = true);
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const MapInputScreen()),
    );
    if (saved == true) {
      setState(() {
        _refreshKey++;
        _pitchCounts.clear();
      });
    }
    if (mounted) setState(() => _processing = false);
  }

  Future<void> _loadPitchCount(String docId) async {
    try {
      final snap = await _col.doc(docId).collection('pitches').get();
      setState(() {
        _pitchCounts[docId] = snap.docs.length;
      });
    } catch (e) {
      debugPrint('피치 불러오기 실패 ($docId): $e');
      setState(() {
        _pitchCounts[docId] = -1;
      });
    }
  }

  /// 승인/거부 처리 및 concepts 컬렉션 복사
  Future<void> _batchUpdate(String newStatus) async {
    setState(() => _processing = true);
    try {
      for (var id in _selectedIds) {
        final docRef = _col.doc(id);
        final snapshot = await docRef.get();
        final data = snapshot.data();

        if (data == null) continue;

        // 상태 업데이트
        await docRef.update({RouteFields.status: newStatus});

        // 승인 시 concepts에 루트+피치 복사
        if (newStatus == 'approved') {
          final conceptDoc = FirebaseFirestore.instance.collection('concepts').doc();
          final conceptData = Map<String, dynamic>.from(data)..remove('authorUid');

// 대표 이미지 누락 방지: 항상 imageUrl 필드 존재(없으면 '')
          if (!conceptData.containsKey('imageUrl') || conceptData['imageUrl'] == null) {
            conceptData['imageUrl'] = '';
          }


          // trackingPath type safety
          if (conceptData[RouteFields.trackingPath] is List) {
            conceptData[RouteFields.trackingPath] =
                (conceptData[RouteFields.trackingPath] as List)
                    .map((pt) => pt is Map
                    ? {
                  'latitude': (pt['latitude'] as num).toDouble(),
                  'longitude': (pt['longitude'] as num).toDouble(),
                  'timestamp': pt['timestamp'] ?? 0,
                }
                    : null)
                    .where((pt) => pt != null)
                    .toList();
          }
          await conceptDoc.set(conceptData);


          final pitchSnap = await docRef.collection('pitches').get();
          for (final pitchDoc in pitchSnap.docs) {
            final pitchData = Map<String, dynamic>.from(pitchDoc.data());
// 피치 이미지 누락 방지: 항상 imageUrl 필드 존재(없으면 '')
            if (!pitchData.containsKey('imageUrl') || pitchData['imageUrl'] == null) {
              pitchData['imageUrl'] = '';
            }
            await conceptDoc.collection('pitches').add(pitchData);

          }
          // [추가] 승인 시 포인트 적립!
          final authorUid = data['authorUid'] as String?;
          if (authorUid != null && authorUid.isNotEmpty) {
            // 원하는 포인트(예: 10)
            await updateUserPointAndLevel(addPoint: 10, userId: authorUid);
          }
        }
      }


      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(
          newStatus == 'approved'
              ? '✅ 선택된 제보가 승인되었습니다.'
              : '✅ 선택된 제보가 거부되었습니다.',
        )),
      );
    } catch (e) {
      debugPrint('Batch update error: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('일괄 처리 중 오류: $e')),
      );
    } finally {
      setState(() {
        _processing = false;
        _selectedIds.clear();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('루트 제보 관리'),
        actions: [
          TextButton(
            onPressed: _allIds.isEmpty
                ? null
                : () => setState(() {
              if (_allSelected) {
                _selectedIds.clear();
              } else {
                _selectedIds.addAll(_allIds);
              }
            }),
            child: Text(
              _allSelected ? '전체 해제' : '전체 선택',
              style: const TextStyle(color: Colors.white),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: '새 제보 작성',
            onPressed: _goToNewReport,
          ),
        ],
      ),
      body: Stack(
        children: [
          StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            key: ValueKey(_refreshKey),
            stream: _col.orderBy(RouteFields.timestamp, descending: true).snapshots(),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Center(child: Text('에러 발생: ${snapshot.error}'));
              }

              final docs = snapshot.data?.docs ?? [];
              _allIds = docs.map((d) => d.id).toList();

              if (docs.isEmpty) {
                return const Center(child: Text('등록된 제보가 없습니다.'));
              }

              return ListView.separated(
                itemCount: docs.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (ctx, i) {
                  final doc = docs[i];
                  final data = doc.data();
                  final docId = doc.id;
                  final name = data[RouteFields.routeName] as String? ?? docId;
                  final status = data[RouteFields.status] as String? ?? '';
                  final checked = _selectedIds.contains(docId);
                  final pitchCount = _pitchCounts[docId];

                  if (pitchCount == null) {
                    _loadPitchCount(docId);
                  }

                  // 트래킹 경로 미리보기
                  final trackingPathRaw = data[RouteFields.trackingPath] as List<dynamic>? ?? [];
                  final List<LatLng> trackingPath = trackingPathRaw
                      .where((pt) => pt is Map && pt['latitude'] != null && pt['longitude'] != null)
                      .map<LatLng>((pt) => LatLng(
                    (pt['latitude'] as num).toDouble(),
                    (pt['longitude'] as num).toDouble(),
                  ))
                      .toList();

                  return CheckboxListTile(
                    value: checked,
                    onChanged: (v) => setState(() {
                      if (v == true) {
                        _selectedIds.add(docId);
                      } else {
                        _selectedIds.remove(docId);
                      }
                    }),
                    title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('상태: $status'),
                        if (pitchCount == null)
                          const Text('📌 피치 수 불러오는 중...')
                        else if (pitchCount == -1)
                          const Text('⚠️ 피치 불러오기 실패')
                        else
                          Text('📌 피치 수: $pitchCount'),
                        // 미니맵
                        if (trackingPath.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 6.0),
                            child: SizedBox(
                              height: 80,
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: IgnorePointer(
                                  child: GoogleMap(
                                    initialCameraPosition: CameraPosition(
                                      target: trackingPath.first,
                                      zoom: 15,
                                    ),
                                    polylines: {
                                      Polyline(
                                        polylineId: const PolylineId('approach'),
                                        points: trackingPath,
                                        width: 4,
                                      ),
                                    },
                                    markers: {
                                      Marker(
                                        markerId: const MarkerId('start'),
                                        position: trackingPath.first,
                                        infoWindow: const InfoWindow(title: '출발'),
                                      ),
                                      if (trackingPath.length > 1)
                                        Marker(
                                          markerId: const MarkerId('end'),
                                          position: trackingPath.last,
                                          infoWindow: const InfoWindow(title: '도착'),
                                        ),
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
                    controlAffinity: ListTileControlAffinity.leading,
                  );
                },
              );
            },
          ),
          if (_processing)
            Container(
              color: Colors.black26,
              child: const Center(child: CircularProgressIndicator()),
            ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _selectedIds.isEmpty
                          ? null
                          : () => _batchUpdate('approved'),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green),
                      child: const Text('선택 승인'),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _selectedIds.isEmpty
                          ? null
                          : () => _batchUpdate('rejected'),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red),
                      child: const Text('선택 거부'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
