// lib/generic_route_detail_screen.dart
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:routefinding/widgets/watermarked_image.dart';
import 'package:routefinding/widgets/full_image_screen.dart';
import 'package:geolocator/geolocator.dart';
import 'utils/colored_polylines.dart';
import 'map_input_screen.dart';
import 'constants/firestore_fields.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:gpx/gpx.dart';
import 'package:url_launcher/url_launcher_string.dart';
import 'package:share_plus/share_plus.dart';
import 'widgets/gpx_action_buttons.dart';
import 'package:path_provider/path_provider.dart';
import 'package:file_picker/file_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:fl_chart/fl_chart.dart';

String extractImageName(String rawUrl) {
  final last = rawUrl.split('/').last;
  return last.contains('?') ? last.split('?').first : last;
}

Future<String?> _resolveUrl(String rawUrl) async {
  try {
    if (rawUrl.startsWith('http')) return rawUrl;
    final ref = FirebaseStorage.instance.refFromURL(rawUrl);
    return await ref.getDownloadURL();
  } catch (_) {
    return null;
  }
}

Future<String?> _getRouteImageUrl(
    String rawUrl,
    String reportId, {
      required String mountain,
      required String zone,
    }) async {
  final ok = await _resolveUrl(rawUrl);
  if (ok != null) return ok;
  final name = extractImageName(rawUrl);
  final path = zone.isNotEmpty
      ? 'route_images/$mountain/$zone/$reportId/$name'
      : 'route_images/$mountain/$reportId/$name';
  try {
    return await FirebaseStorage.instance.ref(path).getDownloadURL();
  } catch (_) {
    return null;
  }
}

Future<String?> _getPitchImageUrl(
    String rawUrl,
    String mountain,
    String routeName,
    ) async {
  final ok = await _resolveUrl(rawUrl);
  if (ok != null) return ok;
  final name = extractImageName(rawUrl);
  final path = 'pitch_images/$mountain/$routeName/$name';
  try {
    return await FirebaseStorage.instance.ref(path).getDownloadURL();
  } catch (_) {
    return null;
  }
}

List<LatLng> mapToLatLngList(List<dynamic> rawPath) {
  return rawPath.map<LatLng>((pt) {
    if (pt is LatLng) return pt;
    if (pt is Map) {
      final lat = (pt['latitude'] as num?)?.toDouble();
      final lng = (pt['longitude'] as num?)?.toDouble();
      if (lat != null && lng != null) return LatLng(lat, lng);
    }
    throw Exception('Invalid path point: $pt');
  }).toList();
}

class _TrackingSummaryWidget extends StatelessWidget {
  final Map<String, dynamic> summary;
  const _TrackingSummaryWidget({Key? key, required this.summary}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final duration = summary['duration'] as int? ?? 0;
    final distance = summary['distance'] as double? ?? 0.0;
    final avgSpeed = summary['avgSpeed'] as double? ?? 0.0;
    final minAlt = summary['minAltitude'] as double? ?? 0.0;
    final maxAlt = summary['maxAltitude'] as double? ?? 0.0;

    String formatDuration(int sec) {
      final m = (sec ~/ 60).toString().padLeft(2, '0');
      final s = (sec % 60).toString().padLeft(2, '0');
      return '$m:$s';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.92),
        borderRadius: BorderRadius.circular(8),
        boxShadow: [BoxShadow(blurRadius: 8, color: Colors.black12)],
      ),
      child: DefaultTextStyle(
        style: const TextStyle(fontSize: 14, color: Colors.black87),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('기간: ${formatDuration(duration)}', style: const TextStyle(fontWeight: FontWeight.w500)),
            Text('거리: ${distance.toStringAsFixed(2)} km'),
            Text('평균속도: ${avgSpeed.toStringAsFixed(2)} m/s'),
            Text('고도: ${minAlt.toStringAsFixed(1)} ~ ${maxAlt.toStringAsFixed(1)} m'),
          ],
        ),
      ),
    );
  }
}

Widget _buildApproachSection(BuildContext context, String? approachDescription, String? approachGpx) {
  return Card(
    margin: const EdgeInsets.symmetric(vertical: 12),
    child: Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('어프로치', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          if (approachDescription != null) Text(approachDescription),
          GpxActionButtons(
            gpxString: approachGpx,
            onPasteGpx: null,
          ),
        ],
      ),
    ),
  );
}

class GenericRouteDetailScreen extends StatefulWidget {
  final DocumentReference<Map<String, dynamic>> routeRef;
  final String title;

  const GenericRouteDetailScreen({Key? key, required this.routeRef, required this.title}) : super(key: key);

  @override
  State<GenericRouteDetailScreen> createState() => _GenericRouteDetailScreenState();
}

class _GenericRouteDetailScreenState extends State<GenericRouteDetailScreen> {
  bool _loading = true;
  Map<String, dynamic>? _data;
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _pitches = [];
  List<dynamic> _rawTrackingPath = [];
  List<LatLng> _trackingPath = [];
  Map<String, dynamic>? _trackingSummary;
  List<String> _imageUrls = [];
  String? _currentUid;
  bool _isAuthor = false;
  static const _adminEmail = 'yusung790926@gmail.com';
  String? _authorNickname;
  Polyline? _gpxPolyline;

  @override
  void initState() {
    super.initState();
    _currentUid = FirebaseAuth.instance.currentUser?.uid;
    _loadDetail();
  }

  Future<bool> _ensureStoragePermission() async {
    if (Platform.isAndroid) {
      if (await Permission.mediaLibrary.request().isGranted ||
          await Permission.storage.request().isGranted) {
        return true;
      }
      return false;
    }
    return true;
  }

  Future<void> _loadGpxAndDraw(String url) async {
    try {
      final xml = await http.read(Uri.parse(url));
      final gpx = GpxReader().fromString(xml);
      if (gpx.trks.isEmpty || gpx.trks.first.trksegs.isEmpty) return;
      final seg = gpx.trks.first.trksegs.first;
      final points = seg.trkpts.map((w) => LatLng(w.lat ?? 0.0, w.lon ?? 0.0)).toList();
      setState(() {
        _gpxPolyline = Polyline(
          polylineId: const PolylineId('approach_gpx'),
          points: points,
          width: 4,
          color: Colors.purple,
        );
      });
    } catch (e) {
      debugPrint('GPX 로드 오류: $e');
    }
  }

  Future<void> _loadDetail() async {
    try {
      final snap = await widget.routeRef.get();
      if (!snap.exists) {
        if (mounted) Navigator.of(context).pop();
        return;
      }
      final d = snap.data()!;
      final authorUid = d[RouteFields.authorUid] as String? ?? '';
      _isAuthor = (authorUid.isNotEmpty && authorUid == _currentUid);
      String nick = '루트마스터';
      if (authorUid.isNotEmpty) {
        final userDoc = await FirebaseFirestore.instance.collection('users').doc(authorUid).get();
        if (userDoc.exists) nick = userDoc.data()?['nickname'] as String? ?? nick;
      }
      _authorNickname = nick;

      final pitchSnap = await widget.routeRef.collection('pitches').get();
      _pitches = pitchSnap.docs;

      final rawPath = d['trackingPath'] as List<dynamic>? ?? [];
      _rawTrackingPath = rawPath;
      _trackingPath = mapToLatLngList(rawPath);
      _trackingSummary = d['trackingSummary'] as Map<String, dynamic>?;

      final mainRaw = d[RouteFields.imageUrl] as String? ?? '';
      final extraRaw = d['imageUrls'] as List<dynamic>? ?? [];
      final raws = <String>[];
      if (mainRaw.isNotEmpty) raws.add(mainRaw);
      raws.addAll(extraRaw.cast<String>());
      final resolved = await Future.wait(raws.take(8).map(_resolveUrl));
      _imageUrls = resolved.whereType<String>().toList();

      setState(() { _data = d; _loading = false; });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('상세정보 로딩에 실패했습니다.')));
        Navigator.of(context).pop();
      }
    }
  }

  Future<void> _requestApproval() async {
    if (!_isAuthor || _data == null) return;
    final status = _data![RouteFields.status] as String? ?? '';
    if (status == 'draft' || status == 'rejected') {
      await widget.routeRef.update({
        RouteFields.status: 'pending',
        'timestamp': FieldValue.serverTimestamp(),
        RouteFields.rejectionReason: '',
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('관리자에게 승인 요청을 보냈습니다.')));
        Navigator.of(context).pop();
      }
    }
  }

  LatLngBounds _computeBounds(List<LatLng> pts) {
    var minLat = pts.first.latitude, maxLat = pts.first.latitude;
    var minLng = pts.first.longitude, maxLng = pts.first.longitude;
    for (var p in pts) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }
    return LatLngBounds(southwest: LatLng(minLat, minLng), northeast: LatLng(maxLat, maxLng));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final data = _data!;
    final gpxUrl = data['gpxUrl'] as String?;
    if (gpxUrl != null && _gpxPolyline == null) _loadGpxAndDraw(gpxUrl);

    final reportId = widget.routeRef.id;
    final status = data[RouteFields.status] as String? ?? '';
    final typeRoot = data['typeRoot'] as String? ?? '';
    final mountain = data[RouteFields.mountain] as String? ?? '';
    final zone = data['zone'] as String? ?? '';
    final lat = data['latitude'] as num?;
    final lng = data['longitude'] as num?;
    final coords = (lat != null && lng != null) ? '$lat, $lng' : '';
    final directions = data['directions'] as String? ?? '';
    final description = data['description'] as String? ?? '';
    final routeName = data[RouteFields.routeName] as String? ?? '';
    final difficulty = data['difficulty'] as String? ?? '';
    final overview = data[RouteFields.overview] as String? ?? '';
    final shape = data[RouteFields.type] as String? ?? '';
    final equipment = data[RouteFields.equipment] as String? ?? '';
    final avgDiff = data[RouteFields.avgDifficulty] as String? ?? '';
    final pioneer = data[RouteFields.pioneer] as String? ?? '';
    final isAdmin = FirebaseAuth.instance.currentUser?.email == _adminEmail;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          if (isAdmin)
            IconButton(
              icon: const Icon(Icons.edit),
              tooltip: '수정',
              onPressed: () async {
                final result = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) => MapInputScreen(reportId: reportId),
                  ),
                );
                if (result == true) {
                  // 화면 이동 없이 해당 상세화면을 갱신만 합니다!
                  await _loadDetail();
                  // 만약 setState 호출 필요 없도록 _loadDetail 내에서 처리되어 있으니 따로 호출 불필요
                }
              },
            ),
          if (isAdmin)
            IconButton(
              icon: const Icon(Icons.delete),
              tooltip: '삭제',
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('루트 삭제'),
                    content: const Text('정말 삭제하시겠습니까?'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('취소')),
                      TextButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('삭제')),
                    ],
                  ),
                );
                if (ok == true) {
                  final batch = FirebaseFirestore.instance.batch();
                  final ps = await widget.routeRef.collection('pitches').get();
                  for (var p in ps.docs) batch.delete(p.reference);
                  batch.delete(widget.routeRef);
                  await batch.commit();
                  Navigator.of(context).pop();
                }
              },
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_imageUrls.isNotEmpty)
              ImageCarousel(imageUrls: _imageUrls)
            else
              Container(
                height: 300,
                color: Colors.grey[200],
                alignment: Alignment.center,
                child: const Icon(Icons.image_not_supported, size: 60),
              ),
            const SizedBox(height: 24),

            Text(mountain, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            if (zone.isNotEmpty || routeName.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                    [zone, routeName].where((s) => s.isNotEmpty).join(' · '),
                    style: const TextStyle(fontSize: 17, color: Colors.black54)),
              ),
            const SizedBox(height: 16),

            ..._buildInfoSection(
              typeRoot: typeRoot,
              mountain: mountain,
              zone: zone,
              coords: coords,
              directions: directions,
              overview: overview,
              shapeType: shape,
              equipment: equipment,
              avgDiff: avgDiff,
              pioneer: pioneer,
              description: description,
              no: '',
              routeName: routeName,
              difficulty: difficulty,
            ),
            const SizedBox(height: 24),

            if (_authorNickname != null)
              Padding(
                padding: const EdgeInsets.only(top: 24),
                child: Text(
                  '작성자: $_authorNickname',
                  style: const TextStyle(color: Colors.grey),
                ),
              ),
            const SizedBox(height: 24),

            if (typeRoot != '볼더링') ...[
              const Text('피치 목록',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              _PitchListSection(
                  pitchesCol: widget.routeRef.collection('pitches'),
                  mountain: mountain,
                  routeName: routeName),
              const SizedBox(height: 24),
            ],

            Card(
              margin: const EdgeInsets.only(bottom: 24),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('어프로치', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    if (_trackingPath.isNotEmpty)
                      ElevationChart(path: _rawTrackingPath),
                    if (_trackingPath.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        child: SizedBox(
                          height: 140,
                          child: _MiniMapWithPolyline(path: _rawTrackingPath),
                        ),
                      )
                    else
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                          child: Text(
                            '어프로치 기록이 없습니다.',
                            style: TextStyle(color: Colors.grey, fontSize: 16),
                          ),
                        ),
                      ),
                    Wrap(
                      alignment: WrapAlignment.center,
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.paste),
                              tooltip: '붙여넣기',
                              onPressed: () async {
                                final data = await Clipboard.getData('text/plain');
                                final raw = data?.text?.trim() ?? '';

                                final urlMatch = RegExp(r'https?://[^\s]+').firstMatch(raw);
                                final pastedUrl = urlMatch?.group(0);

                                if (pastedUrl != null && pastedUrl.isNotEmpty) {
                                  await widget.routeRef.update({'gpxUrl': pastedUrl});
                                  try {
                                    final res = await http.get(Uri.parse(pastedUrl));
                                    if (!mounted) return;
                                    if (res.statusCode != 200) throw Exception('다운로드 실패');
                                    final xmlString = res.body;
                                    final xmlGpx = GpxReader().fromString(xmlString);
                                    final points = <Map<String, dynamic>>[];
                                    for (final trk in xmlGpx.trks) {
                                      for (final seg in trk.trksegs) {
                                        for (final p in seg.trkpts) {
                                          points.add({
                                            'latitude': p.lat,
                                            'longitude': p.lon,
                                            'altitude': p.ele ?? 0.0,
                                            'timestamp': p.time?.millisecondsSinceEpoch ?? 0,
                                          });
                                        }
                                      }
                                    }
                                    if (points.isNotEmpty) {
                                      await widget.routeRef.update({'trackingPath': points});
                                      if (!mounted) return;
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('GPX 경로를 저장했습니다! 새로고침 해주세요.')),
                                      );
                                    } else {
                                      if (!mounted) return;
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('GPX에서 경로를 추출하지 못했습니다.')),
                                      );
                                    }
                                    _loadDetail();
                                  } catch (e) {
                                    if (!mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('GPX 처리 오류: $e')),
                                    );
                                  }
                                  return;
                                }

                                if (raw.contains('<gpx')) {
                                  try {
                                    final xmlGpx = GpxReader().fromString(raw);
                                    final points = <Map<String, dynamic>>[];
                                    for (final trk in xmlGpx.trks) {
                                      for (final seg in trk.trksegs) {
                                        for (final p in seg.trkpts) {
                                          points.add({
                                            'latitude': p.lat,
                                            'longitude': p.lon,
                                            'altitude': p.ele ?? 0.0,
                                            'timestamp': p.time?.millisecondsSinceEpoch ?? 0,
                                          });
                                        }
                                      }
                                    }
                                    if (points.isNotEmpty) {
                                      await widget.routeRef.update({
                                        'trackingPath': points,
                                        'gpxUrl': '',
                                      });
                                      if (!mounted) return;
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('GPX 본문을 저장했습니다! 새로고침 해주세요.')),
                                      );
                                    } else {
                                      if (!mounted) return;
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('GPX에서 경로를 추출하지 못했습니다.')),
                                      );
                                    }
                                    _loadDetail();
                                  } catch (e) {
                                    if (!mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('GPX 파싱 오류: $e')),
                                    );
                                  }
                                  return;
                                }

                                if (!mounted) return;
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('올바른 GPX URL 또는 GPX 파일 내용을 붙여넣어주세요.')),
                                );
                              },
                            ),
                            const SizedBox(height: 2),
                            const Text('GPX URL/본문', style: TextStyle(fontSize: 10, color: Colors.grey)),
                          ],
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.upload_file),
                              tooltip: 'GPX 파일 업로드',
                              onPressed: () async {
                                try {
                                  FilePickerResult? result = await FilePicker.platform.pickFiles(
                                    type: FileType.any,
                                  );
                                  if (!mounted) return;
                                  if (result != null && result.files.single.path != null) {
                                    final path = result.files.single.path!;
                                    if (!path.toLowerCase().endsWith('.gpx')) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('GPX 파일만 선택하세요!')),
                                      );
                                      return;
                                    }
                                    final file = File(path);
                                    final xmlString = await file.readAsString();
                                    final xmlGpx = GpxReader().fromString(xmlString);
                                    final points = <Map<String, dynamic>>[];
                                    for (final trk in xmlGpx.trks) {
                                      for (final seg in trk.trksegs) {
                                        for (final p in seg.trkpts) {
                                          points.add({
                                            'latitude': p.lat,
                                            'longitude': p.lon,
                                            'altitude': p.ele ?? 0.0,
                                            'timestamp': p.time?.millisecondsSinceEpoch ?? 0,
                                          });
                                        }
                                      }
                                    }
                                    await widget.routeRef.update({
                                      'trackingPath': points,
                                      'gpxUrl': '',
                                    });
                                    if (!mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('GPX 파일을 저장했습니다! 새로고침 해주세요.')),
                                    );
                                    _loadDetail();
                                  }
                                } catch (e) {
                                  if (!mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('GPX 업로드 오류: $e')),
                                  );
                                }
                              },
                            ),

                            const SizedBox(height: 2),
                            const Text('파일 업로드', style: TextStyle(fontSize: 10, color: Colors.grey)),
                          ],
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.copy),
                              tooltip: '복사',
                              onPressed: (gpxUrl != null && gpxUrl.isNotEmpty)
                                  ? () {
                                Clipboard.setData(ClipboardData(text: gpxUrl));
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('GPX URL을 클립보드에 복사했습니다.')),
                                );
                              }
                                  : null,
                            ),
                            const SizedBox(height: 2),
                            const Text('복사', style: TextStyle(fontSize: 10, color: Colors.grey)),
                          ],
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.file_download),
                              tooltip: '다운로드',
                              onPressed: (gpxUrl != null && gpxUrl.isNotEmpty)
                                  ? () => launchUrlString(gpxUrl)
                                  : null,
                            ),
                            const SizedBox(height: 2),
                            const Text('다운로드', style: TextStyle(fontSize: 10, color: Colors.grey)),
                          ],
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.share),
                              tooltip: '공유',
                              onPressed: (gpxUrl != null && gpxUrl.isNotEmpty)
                                  ? () async {
                                try {
                                  final response = await http.get(Uri.parse(gpxUrl));
                                  if (!mounted) return;
                                  if (response.statusCode == 200) {
                                    final tempDir = await getTemporaryDirectory();
                                    final tempPath = '${tempDir.path}/approach.gpx';
                                    final file = File(tempPath);
                                    await file.writeAsBytes(response.bodyBytes);
                                    await Share.shareXFiles(
                                      [XFile(tempPath)],
                                      text: '어프로치 GPX 파일을 공유합니다.',
                                    );
                                  } else {
                                    if (!mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('GPX 파일 다운로드 실패')),
                                    );
                                  }
                                } catch (e) {
                                  if (!mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('GPX 공유 오류: $e')),
                                  );
                                }
                              }
                                  : null,
                            ),
                            const SizedBox(height: 2),
                            const Text('공유', style: TextStyle(fontSize: 10, color: Colors.grey)),
                          ],
                        ),
                      ],
                    ),
                    if (gpxUrl == null || gpxUrl.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Text(
                          '아직 GPX 파일이 등록되지 않았습니다.\n'
                              '[붙여넣기]: 앱 내 GPX URL/본문만 지원\n'
                              '[업로드]: 외부 GPX 파일을 업로드하려면 [파일 업로드]를 이용하세요.',
                          style: TextStyle(color: Colors.grey[500], fontSize: 13),
                        ),
                      ),
                  ],
                ),
              ),
            ),

            if (_isAuthor && (status == 'draft' || status == 'rejected'))
              Center(
                child: ElevatedButton(
                  onPressed: _requestApproval,
                  style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange),
                  child: const Text('승인 요청'),
                ),
              ),
            const SizedBox(height: 24),

            Row(children: [
              Expanded(child: ElevatedButton.icon(icon: const Icon(Icons.map),
                  label: const Text('경로 보기'),
                  onPressed: () =>
                      Navigator.push(context, MaterialPageRoute(builder: (_) =>
                          _FullMapScreen(path: _rawTrackingPath,
                              trackingSummary: _trackingSummary))))),
              const SizedBox(width: 12),
              Expanded(child: ElevatedButton.icon(
                  icon: const Icon(Icons.directions_walk),
                  label: const Text('경로 따라가기'),
                  onPressed: () =>
                      Navigator.push(context, MaterialPageRoute(builder: (_) =>
                          ApproachTrackingScreen(path: _rawTrackingPath,
                              trackingSummary: _trackingSummary))))),
            ]),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildInfoSection({
    required String typeRoot,
    required String mountain,
    required String zone,
    required String coords,
    required String directions,
    required String overview,
    required String shapeType,
    required String equipment,
    required String avgDiff,
    required String pioneer,
    required String description,
    required String no,
    required String routeName,
    required String difficulty,
  }) {
    final infos = <MapEntry<String, String>>[
      MapEntry('산 이름', mountain),
      MapEntry('구분', typeRoot),
    ];
    if (typeRoot == '볼더링') {
      infos.addAll([
        MapEntry('구역', zone), MapEntry('좌표', coords),
        MapEntry('찾아가는 길', directions), MapEntry('소개', description),
        MapEntry('번호', no), MapEntry('루트 이름', routeName),
        MapEntry('볼더링 난이도', difficulty),
      ]);
    } else {
      infos.addAll([
        if (overview.isNotEmpty) MapEntry('개요', overview),
        if (shapeType.isNotEmpty)MapEntry('형태', shapeType),
        if (equipment.isNotEmpty)MapEntry('소요장비', equipment),
        if (avgDiff.isNotEmpty) MapEntry('평균 난이도', avgDiff),
        if (pioneer.isNotEmpty) MapEntry('기타내용', pioneer),
      ]);
    }
    return infos.map((e) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Text('${e.key}: ${e.value}', style: const TextStyle(fontSize: 16)),
    )).toList();
  }
}

class ImageCarousel extends StatefulWidget {
  final List<String> imageUrls;
  const ImageCarousel({Key? key, required this.imageUrls}) : super(key: key);

  @override
  State<ImageCarousel> createState() => _ImageCarouselState();
}

class _ImageCarouselState extends State<ImageCarousel> {
  final PageController _controller = PageController();
  int _current = 0;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: 300,
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.imageUrls.length,
            onPageChanged: (i) => setState(() => _current = i),
            itemBuilder: (ctx, i) {
              final url = widget.imageUrls[i];
              return GestureDetector(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => FullImageScreen(imageUrl: url),
                  ),
                ),
                child: CachedNetworkImage(
                  imageUrl: url,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  placeholder: (_, __) =>
                  const Center(child: CircularProgressIndicator()),
                  errorWidget: (_, __, ___) =>
                  const Center(child: Icon(Icons.broken_image, size: 60)),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(widget.imageUrls.length, (i) {
            return AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: _current == i ? 12 : 8,
              height: _current == i ? 12 : 8,
              decoration: BoxDecoration(
                color: _current == i ? Colors.blueAccent : Colors.grey,
                shape: BoxShape.circle,
              ),
            );
          }),
        ),
      ],
    );
  }
}

class _PitchListSection extends StatelessWidget {
  final CollectionReference<Map<String, dynamic>> pitchesCol;
  final String mountain;
  final String routeName;
  const _PitchListSection({
    required this.pitchesCol,
    required this.mountain,
    required this.routeName,
  });

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: pitchesCol.snapshots(),
      builder: (ctx, snap) {
        if (snap.hasError) return Text('피치 로드 에러: ${snap.error}');
        if (!snap.hasData) return const Center(child: CircularProgressIndicator());
        final docs = List.of(snap.data!.docs)
          ..sort((a, b) {
            final na = RegExp(r'\d+').firstMatch(a.data()[PitchFields.name] as String? ?? '')?.group(0) ?? '0';
            final nb = RegExp(r'\d+').firstMatch(b.data()[PitchFields.name] as String? ?? '')?.group(0) ?? '0';
            return int.parse(na).compareTo(int.parse(nb));
          });
        if (docs.isEmpty) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: Text('등록된 피치가 없습니다.')),
          );
        }
        return ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: docs.length,
          separatorBuilder: (_,__) => const Divider(),
          itemBuilder: (c, i) {
            final p = docs[i].data();
            final name   = p[PitchFields.name]       as String? ?? '';
            final length = p[PitchFields.length]     as String? ?? '';
            final diff   = p[PitchFields.difficulty] as String? ?? '';
            final style  = p[PitchFields.style]      as String? ?? '';
            final gear   = p[PitchFields.gear]       as String? ?? '';
            final raw    = p[PitchFields.imageUrl]   as String? ?? '';

            return ListTile(
              contentPadding: const EdgeInsets.symmetric(vertical: 8),
              leading: raw.isEmpty
                  ? const Icon(Icons.landscape, size: 80)
                  : FutureBuilder<String?>(
                future: _getPitchImageUrl(raw, mountain, routeName),
                builder: (c2, s2) {
                  if (s2.connectionState != ConnectionState.done) {
                    return Container(
                      width: 80, height: 80,
                      alignment: Alignment.center,
                      child: const CircularProgressIndicator(strokeWidth: 2),
                    );
                  }
                  final url = s2.data;
                  if (url == null) return const Icon(Icons.broken_image, size: 80);
                  return GestureDetector(
                    onTap: () => Navigator.push(context, MaterialPageRoute(
                      builder: (_) => FullImageScreen(imageUrl: url),
                    )),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: Image.network(url, width:80, height:80, fit: BoxFit.cover),
                    ),
                  );
                },
              ),
              title: Text(name),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (length.isNotEmpty) Text('길이: $length'),
                  if (style.isNotEmpty ) Text('형태: $style'),
                  if (diff.isNotEmpty  ) Text('난이도: $diff'),
                  if (gear.isNotEmpty  ) Text('장비: $gear'),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _MiniMapWithPolyline extends StatelessWidget {
  final List<dynamic> path;
  const _MiniMapWithPolyline({super.key, required this.path});

  @override
  Widget build(BuildContext context) {
    final pts = path.map<LatLng>((pt) {
      if (pt is LatLng) return pt;
      if (pt is Map) {
        final lat = (pt['latitude'] as num?)?.toDouble();
        final lng = (pt['longitude'] as num?)?.toDouble();
        if (lat != null && lng != null) return LatLng(lat, lng);
      }
      throw Exception('Invalid path point: $pt');
    }).toList();

    final initialCamera = CameraPosition(target: pts.first, zoom: 15);
    final poly = ColoredPolylines.makeColoredPath(
      path: path,
      arrowIcon: null,
      arrowInterval: 9999,
    );

    return GoogleMap(
      initialCameraPosition: initialCamera,
      polylines: poly.polylines,
      markers: {
        if (pts.isNotEmpty)
          Marker(
            markerId: const MarkerId('start'),
            position: pts.first,
            infoWindow: const InfoWindow(title: '출발'),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          ),
        if (pts.length > 1)
          Marker(
            markerId: const MarkerId('end'),
            position: pts.last,
            infoWindow: const InfoWindow(title: '도착'),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
          ),
        ...poly.markers,
      },
      myLocationEnabled: false,
      zoomControlsEnabled: false,
      scrollGesturesEnabled: false,
      rotateGesturesEnabled: false,
      tiltGesturesEnabled: false,
      mapToolbarEnabled: false,
      zoomGesturesEnabled: false,
      onMapCreated: (ctrl) {
        Future.delayed(const Duration(milliseconds: 300), () {
          final bounds = _computeBounds(pts);
          ctrl.animateCamera(CameraUpdate.newLatLngBounds(bounds, 30));
        });
      },
    );
  }

  LatLngBounds _computeBounds(List<LatLng> pts) {
    var minLat = pts.first.latitude, maxLat = pts.first.latitude;
    var minLng = pts.first.longitude, maxLng = pts.first.longitude;
    for (var p in pts) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }
    return LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );
  }
}

class _FullMapScreen extends StatefulWidget {
  final List<dynamic> path;
  final Map<String, dynamic>? trackingSummary;
  const _FullMapScreen({Key? key, required this.path, this.trackingSummary}) : super(key: key);

  @override
  State<_FullMapScreen> createState() => _FullMapScreenState();
}

class _FullMapScreenState extends State<_FullMapScreen> {
  MapType _mapType = MapType.normal;
  BitmapDescriptor? _arrowMarkerIcon;

  @override
  void initState() {
    super.initState();
    _loadArrowIcon();
  }

  Future<void> _loadArrowIcon() async {
    _arrowMarkerIcon = await BitmapDescriptor.fromAssetImage(
      const ImageConfiguration(size: Size(48, 48)),
      'assets/icons/arrow_marker.png',
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final pts = widget.path.map<LatLng>((pt) {
      if (pt is LatLng) return pt;
      if (pt is Map) {
        final lat = (pt['latitude'] as num?)?.toDouble();
        final lng = (pt['longitude'] as num?)?.toDouble();
        if (lat != null && lng != null) return LatLng(lat, lng);
      }
      throw Exception('Invalid path point: $pt');
    }).toList();

    final initialCamera = CameraPosition(target: pts.first, zoom: 15);
    final poly = ColoredPolylines.makeColoredPath(
      path: widget.path,
      arrowIcon: _arrowMarkerIcon,
      arrowInterval: 5,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('어프로치 전체 경로'),
        actions: [
          IconButton(
            icon: Icon(_mapType == MapType.normal ? Icons.satellite_alt : Icons.map),
            tooltip: _mapType == MapType.normal ? '위성지도' : '일반지도',
            onPressed: () {
              setState(() {
                _mapType = _mapType == MapType.normal ? MapType.satellite : MapType.normal;
              });
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: initialCamera,
            polylines: poly.polylines,
            markers: {
              if (pts.isNotEmpty)
                Marker(
                  markerId: const MarkerId('start'),
                  position: pts.first,
                  infoWindow: const InfoWindow(title: '출발'),
                  icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
                ),
              if (pts.length > 1)
                Marker(
                  markerId: const MarkerId('end'),
                  position: pts.last,
                  infoWindow: const InfoWindow(title: '도착'),
                  icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
                ),
              ...poly.markers,
            },
            myLocationEnabled: false,
            mapType: _mapType,
            onMapCreated: (ctrl) {
              Future.delayed(const Duration(milliseconds: 300), () {
                final bounds = _computeBounds(pts);
                ctrl.animateCamera(CameraUpdate.newLatLngBounds(bounds, 30));
              });
            },
          ),
          if (widget.trackingSummary != null)
            Positioned(
              top: 20, left: 10, right: 10,
              child: _TrackingSummaryWidget(summary: widget.trackingSummary!),
            ),
        ],
      ),
    );
  }

  LatLngBounds _computeBounds(List<LatLng> pts) {
    var minLat = pts.first.latitude, maxLat = pts.first.latitude;
    var minLng = pts.first.longitude,maxLng = pts.first.longitude;
    for (var p in pts) {
      if (p.latitude<minLat) minLat=p.latitude;
      if (p.latitude>maxLat) maxLat=p.latitude;
      if (p.longitude<minLng) minLng=p.longitude;
      if (p.longitude>maxLng) maxLng=p.longitude;
    }
    return LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );
  }
}

class ApproachTrackingScreen extends StatefulWidget {
  final List<dynamic> path;
  final Map<String, dynamic>? trackingSummary;
  const ApproachTrackingScreen({Key? key, required this.path, this.trackingSummary}) : super(key: key);

  @override
  State<ApproachTrackingScreen> createState() => _ApproachTrackingScreenState();
}

class _ApproachTrackingScreenState extends State<ApproachTrackingScreen> {
  late final List<LatLng> _latLngPath;
  GoogleMapController? _mapController;
  Stream<Position>? _positionStream;
  MapType _mapType = MapType.normal;
  BitmapDescriptor? _arrowMarkerIcon;

  @override
  void initState() {
    super.initState();
    _latLngPath = widget.path.map<LatLng>((pt) {
      if (pt is LatLng) return pt;
      if (pt is Map) {
        final lat = (pt['latitude'] as num?)?.toDouble();
        final lng = (pt['longitude'] as num?)?.toDouble();
        if (lat != null && lng != null) return LatLng(lat, lng);
      }
      throw Exception('Invalid path point: $pt');
    }).toList();
    _initLocationStream();
    _loadArrowIcon();
  }

  Future<void> _loadArrowIcon() async {
    _arrowMarkerIcon = await BitmapDescriptor.fromAssetImage(
      const ImageConfiguration(size: Size(48, 48)),
      'assets/icons/arrow_marker.png',
    );
    if (mounted) setState(() {});
  }

  void _initLocationStream() async {
    bool enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled && mounted) {
      _showError('위치 서비스가 꺼져 있습니다.');
      return;
    }
    LocationPermission perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied && mounted) {
        _showError('위치 권한이 거부되었습니다.');
        return;
      }
    }
    if (perm == LocationPermission.deniedForever && mounted) {
      _showError('위치 권한이 영구적으로 거부되었습니다.');
      return;
    }

    setState(() {
      _positionStream = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.best),
      );
    });
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  void _moveToCurrentPosition(Position pos) {
    if (_mapController != null) {
      _mapController!.animateCamera(
        CameraUpdate.newLatLng(LatLng(pos.latitude, pos.longitude)),
      );
    }
  }

  @override
  void dispose() {
    _mapController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pts = _latLngPath;
    final initialCamera = CameraPosition(target: pts.first, zoom: 15);
    final poly = ColoredPolylines.makeColoredPath(
      path: widget.path,
      arrowIcon: _arrowMarkerIcon,
      arrowInterval: 5,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('경로 따라가기'),
        actions: [
          IconButton(
            icon: Icon(_mapType == MapType.normal ? Icons.satellite_alt : Icons.map),
            tooltip: _mapType == MapType.normal ? '위성지도' : '일반지도',
            onPressed: () {
              setState(() {
                _mapType = _mapType == MapType.normal ? MapType.satellite : MapType.normal;
              });
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          _positionStream == null
              ? const Center(child: CircularProgressIndicator())
              : StreamBuilder<Position>(
            stream: _positionStream,
            builder: (context, snapshot) {
              LatLng? currentLatLng;
              if (snapshot.hasData) {
                currentLatLng = LatLng(snapshot.data!.latitude, snapshot.data!.longitude);
              }

              return GoogleMap(
                initialCameraPosition: initialCamera,
                polylines: poly.polylines,
                markers: {
                  if (pts.isNotEmpty)
                    Marker(
                      markerId: const MarkerId('start'),
                      position: pts.first,
                      infoWindow: const InfoWindow(title: '출발'),
                      icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
                    ),
                  if (pts.length > 1)
                    Marker(
                      markerId: const MarkerId('end'),
                      position: pts.last,
                      infoWindow: const InfoWindow(title: '도착'),
                      icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
                    ),
                  ...poly.markers,
                  if (currentLatLng != null)
                    Marker(
                      markerId: const MarkerId('me'),
                      position: currentLatLng,
                      infoWindow: const InfoWindow(title: '내 위치'),
                      icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
                    ),
                },
                myLocationEnabled: true,
                myLocationButtonEnabled: false,
                zoomControlsEnabled: false,
                mapType: _mapType,
                onMapCreated: (ctrl) {
                  _mapController = ctrl;
                  Future.delayed(const Duration(milliseconds: 300), () {
                    final bounds = _computeBounds(pts);
                    ctrl.animateCamera(CameraUpdate.newLatLngBounds(bounds, 40));
                  });
                },
              );
            },
          ),
          if (widget.trackingSummary != null)
            Positioned(
              top: 20, left: 10, right: 10,
              child: _TrackingSummaryWidget(summary: widget.trackingSummary!),
            ),
        ],
      ),
      floatingActionButton: _positionStream != null
          ? StreamBuilder<Position>(
        stream: _positionStream,
        builder: (context, snapshot) {
          if (!snapshot.hasData) return const SizedBox.shrink();
          return FloatingActionButton(
            heroTag: 'goto_my_loc',
            child: const Icon(Icons.my_location),
            onPressed: () => _moveToCurrentPosition(snapshot.data!),
          );
        },
      )
          : null,
    );
  }

  LatLngBounds _computeBounds(List<LatLng> pts) {
    var minLat = pts.first.latitude, maxLat = pts.first.latitude;
    var minLng = pts.first.longitude, maxLng = pts.first.longitude;
    for (var p in pts) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }
    return LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );
  }
}

class ElevationChart extends StatelessWidget {
  final List<dynamic> path;

  const ElevationChart({Key? key, required this.path}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final altitudes = path
        .map((pt) => pt is Map && pt['altitude'] != null
        ? (pt['altitude'] as num).toDouble()
        : null)
        .whereType<double>()
        .toList();

    if (altitudes.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 8.0),
        child: Text('고도 데이터 없음', style: TextStyle(color: Colors.grey)),
      );
    }

    return SizedBox(
      height: 160,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8.0),
        child: LineChart(
          LineChartData(
            gridData: FlGridData(show: false),
            titlesData: FlTitlesData(
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 30,
                  interval: 20,
                  getTitlesWidget: (v, m) => Text('${v.toInt()}'),
                ),
              ),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: false,
                ),
              ),
              topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
            ),
            borderData: FlBorderData(show: true),
            lineBarsData: [
              LineChartBarData(
                spots: List.generate(
                  altitudes.length,
                      (i) => FlSpot(i.toDouble(), altitudes[i]),
                ),
                isCurved: true,
                color: Colors.blueAccent,
                barWidth: 2.5,
                dotData: FlDotData(show: false),
              )
            ],
          ),
        ),
      ),
    );
  }
}
