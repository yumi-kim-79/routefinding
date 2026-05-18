import 'dart:async';
import 'dart:io' show Platform, File;
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:gpx/gpx.dart';
import 'package:path_provider/path_provider.dart';
import 'package:routefinding/utils/colored_polylines.dart';

class TrackingScreen extends StatefulWidget {
  final List<Map<String, dynamic>>? initialPath;
  final bool readOnly;

  const TrackingScreen({
    Key? key,
    this.initialPath,
    this.readOnly = false,
  }) : super(key: key);

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  final Completer<GoogleMapController> _mapController = Completer();
  StreamSubscription<Position>? _positionStream;
  List<Map<String, dynamic>> _trackingPath = [];
  bool _isRecording = false;
  LatLng? _currentLatLng;
  MapType _mapType = MapType.normal;
  BitmapDescriptor? _arrowMarkerIcon;

  static const CameraPosition _defaultCamera = CameraPosition(
    target: LatLng(37.5665, 126.9780),
    zoom: 15,
  );

  @override
  void initState() {
    super.initState();
    _initArrowMarker();
    if (widget.readOnly && widget.initialPath != null && widget.initialPath!.isNotEmpty) {
      _trackingPath = List<Map<String, dynamic>>.from(widget.initialPath!);
      _currentLatLng = LatLng(
        (_trackingPath.first['latitude'] as num).toDouble(),
        (_trackingPath.first['longitude'] as num).toDouble(),
      );
    }
  }

  @override
  void dispose() {
    _positionStream?.cancel();
    super.dispose();
  }

  Future<void> _initArrowMarker() async {
    _arrowMarkerIcon = await BitmapDescriptor.fromAssetImage(
      const ImageConfiguration(size: Size(48, 48)),
      'assets/icons/arrow_marker.png',
    );
    if (mounted) setState(() {});
  }

  Future<bool> _ensureLocationPermission() async {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      perm = await Geolocator.requestPermission();
    }
    return perm == LocationPermission.whileInUse || perm == LocationPermission.always;
  }

  Future<void> _startRecording() async {
    if (_isRecording) return;
    if (!await _ensureLocationPermission()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('위치 권한이 필요합니다.')),
      );
      return;
    }
    // ★ 이 부분이 '이어서 기록'시에는 clear 안 되게, 분리 필요
    if (_trackingPath.isEmpty) {
      _trackingPath.clear();
    }
    setState(() => _isRecording = true);

    final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.bestForNavigation);
    _currentLatLng = LatLng(pos.latitude, pos.longitude);
    _trackingPath.add({
      'latitude': pos.latitude,
      'longitude': pos.longitude,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'altitude': pos.altitude,
    });

    final ctrl = await _mapController.future;
    ctrl.moveCamera(CameraUpdate.newLatLng(_currentLatLng!));

    final settings = Platform.isAndroid
        ? AndroidSettings(
      accuracy: LocationAccuracy.bestForNavigation,
      distanceFilter: 5,
      foregroundNotificationConfig: const ForegroundNotificationConfig(
        notificationTitle: 'RouteFinding',
        notificationText: '어프로치길을 기록 중입니다.',
        notificationIcon: AndroidResource(
            name: 'ic_launcher', defType: 'mipmap'),
      ),
    )
        : AppleSettings(
      accuracy: LocationAccuracy.bestForNavigation,
      distanceFilter: 5,
      pauseLocationUpdatesAutomatically: false,
      showBackgroundLocationIndicator: true,
    );
    _positionStream =
        Geolocator.getPositionStream(locationSettings: settings)
            .listen(_onNewPosition);
  }

  Future<void> _onNewPosition(Position pos) async {
    final newLatLng = LatLng(pos.latitude, pos.longitude);
    setState(() {
      _currentLatLng = newLatLng;
      _trackingPath.add({
        'latitude': newLatLng.latitude,
        'longitude': newLatLng.longitude,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
        'altitude': pos.altitude,
      });
    });
    final ctrl = await _mapController.future;
    ctrl.animateCamera(CameraUpdate.newLatLng(newLatLng));
  }

  void _stopRecording() {
    if (!_isRecording) return;
    _positionStream?.cancel();
    setState(() => _isRecording = false);
    _showSaveDialog();
  }

  Future<String> _exportGpx() async {
    final gpx = Gpx()
      ..creator = 'RouteFinding App'
      ..metadata = Metadata(
        name: 'Approach Track',
        time: DateTime.now().toUtc(),
      );
    final trk = Trk(name: 'Approach');
    final seg = Trkseg();
    for (var pt in _trackingPath) {
      final lat = (pt['latitude'] as num).toDouble();
      final lon = (pt['longitude'] as num).toDouble();
      final ts = pt['timestamp'] as int?;
      final time = ts != null
          ? DateTime.fromMillisecondsSinceEpoch(ts)
          : DateTime.now();
      seg.trkpts.add(
          Wpt(lat: lat, lon: lon, time: time.toUtc()));
    }
    trk.trksegs.add(seg);
    gpx.trks.add(trk);

    final gpxString = GpxWriter().asString(gpx, pretty: true);
    final dir = await getApplicationDocumentsDirectory();
    final fileName = 'approach_${DateTime.now().millisecondsSinceEpoch}.gpx';
    final file = File('${dir.path}/$fileName');
    await file.writeAsString(gpxString);
    return file.path;
  }

  void _showSaveDialog() async {
    await Future.delayed(const Duration(milliseconds: 300));
    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        title: const Text('기록 저장'),
        content: const Text(
            '경로 기록을 저장하시겠습니까?\n"이어서 기록"을 누르면 계속 이어서 기록할 수 있습니다.'),
        actions: [
          // 이어서 기록 (다이얼로그 닫고, 다시 기록 모드로)
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              setState(() {
                _isRecording = true;
              });
              // 기존 기록 위에 계속 이어서 기록
              final settings = Platform.isAndroid
                  ? AndroidSettings(
                accuracy: LocationAccuracy.bestForNavigation,
                distanceFilter: 5,
                foregroundNotificationConfig: const ForegroundNotificationConfig(
                  notificationTitle: 'RouteFinding',
                  notificationText: '어프로치길을 기록 중입니다.',
                  notificationIcon: AndroidResource(
                      name: 'ic_launcher', defType: 'mipmap'),
                ),
              )
                  : AppleSettings(
                accuracy: LocationAccuracy.bestForNavigation,
                distanceFilter: 5,
                pauseLocationUpdatesAutomatically: false,
                showBackgroundLocationIndicator: true,
              );
              _positionStream =
                  Geolocator.getPositionStream(locationSettings: settings)
                      .listen(_onNewPosition);
            },
            child: const Text('이어서 기록'),
          ),
          // 확인(저장)
          TextButton(
            onPressed: () async {
              Navigator.of(context).pop();
              final gpxPath = await _exportGpx();
              if (!mounted) return;
              Navigator.of(context).pop({
                'points': _trackingPath,
                'gpxPath': gpxPath,
              });
            },
            child: const Text('확인(저장)'),
          ),
        ],
      ),
    );
  }

  Map<String, dynamic> get _pathStats {
    if (_trackingPath.length < 2) return {};
    final first = _trackingPath.first;
    final last = _trackingPath.last;
    final duration = Duration(
      milliseconds: (last['timestamp'] as int) - (first['timestamp'] as int),
    );
    double dist = 0, totalSpeed = 0;
    double minAlt = double.infinity, maxAlt = -double.infinity;
    int cnt = 0;
    for (int i = 1; i < _trackingPath.length; i++) {
      final p1 = _trackingPath[i - 1];
      final p2 = _trackingPath[i];
      final d = Geolocator.distanceBetween(
        (p1['latitude'] as num).toDouble(),
        (p1['longitude'] as num).toDouble(),
        (p2['latitude'] as num).toDouble(),
        (p2['longitude'] as num).toDouble(),
      );
      dist += d;
      final dt = ((p2['timestamp'] as int) - (p1['timestamp'] as int)) / 1000;
      final speed = dt > 0 ? d / dt : 0;
      if (speed > 0) {
        totalSpeed += speed;
        cnt++;
      }
      final alt = (p2['altitude'] as num).toDouble();
      if (alt < minAlt) minAlt = alt;
      if (alt > maxAlt) maxAlt = alt;
    }
    return {
      'duration': '${duration.inHours}:'
          '${(duration.inMinutes % 60).toString().padLeft(2, '0')}:'
          '${(duration.inSeconds % 60).toString().padLeft(2, '0')}',
      'distance': dist,
      'avgSpeed': cnt > 0 ? totalSpeed / cnt : 0,
      'minAlt': minAlt.isFinite ? minAlt : null,
      'maxAlt': maxAlt.isFinite ? maxAlt : null,
    };
  }

  @override
  Widget build(BuildContext context) {
    Set<Polyline> polylines = {};
    Set<Marker> markers = {};
    if (_arrowMarkerIcon != null) {
      final res = ColoredPolylines.makeColoredPath(
        path: _trackingPath,
        arrowIcon: _arrowMarkerIcon!,
        arrowInterval: 5,
      );
      polylines = res.polylines;
      markers = res.markers;
    }
    if (_trackingPath.isNotEmpty) {
      markers.add(
        Marker(
          markerId: const MarkerId('start'),
          position: LatLng(
            (_trackingPath.first['latitude'] as num).toDouble(),
            (_trackingPath.first['longitude'] as num).toDouble(),
          ),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          infoWindow: const InfoWindow(title: '시작'),
        ),
      );
    }
    if (_trackingPath.length > 1) {
      markers.add(
        Marker(
          markerId: const MarkerId('end'),
          position: LatLng(
            (_trackingPath.last['latitude'] as num).toDouble(),
            (_trackingPath.last['longitude'] as num).toDouble(),
          ),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
          infoWindow: const InfoWindow(title: '종료'),
        ),
      );
    }
    final stats = _pathStats;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.readOnly ? '경로 미리보기' : '어프로치 기록'),
        backgroundColor: Colors.blueAccent,
        actions: [
          IconButton(
            icon: Icon(
              _mapType == MapType.normal ? Icons.satellite : Icons.map,
            ),
            tooltip: _mapType == MapType.normal ? '위성' : '지도',
            onPressed: () => setState(() {
              _mapType =
              _mapType == MapType.normal ? MapType.hybrid : MapType.normal;
            }),
          ),
        ],
      ),
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: _currentLatLng != null
                ? CameraPosition(target: _currentLatLng!, zoom: 15)
                : _defaultCamera,
            myLocationEnabled: !widget.readOnly,
            myLocationButtonEnabled: !widget.readOnly,
            zoomControlsEnabled: false,
            polylines: polylines,
            markers: markers,
            mapType: _mapType,
            onMapCreated: (c) => _mapController.complete(c),
          ),
          if (stats.isNotEmpty)
            Positioned(
              top: 24,
              left: 18,
              right: 18,
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.93),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 6)],
                ),
                padding: const EdgeInsets.symmetric(
                    horizontal: 22, vertical: 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '시간: ${stats['duration']}',
                      style:
                      const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text(
                      '거리: ${(stats['distance'] / 1000).toStringAsFixed(2)} km',
                      style: const TextStyle(fontSize: 15),
                    ),
                    Text(
                      '평균속도: ${stats['avgSpeed'].toStringAsFixed(2)} m/s',
                      style: const TextStyle(fontSize: 15),
                    ),
                    if (stats['minAlt'] != null && stats['maxAlt'] != null)
                      Text(
                        '고도: ${stats['minAlt']!.toStringAsFixed(1)} ~ ${stats['maxAlt']!.toStringAsFixed(1)} m',
                        style: const TextStyle(fontSize: 15),
                      ),
                  ],
                ),
              ),
            ),
          if (!widget.readOnly)
            Positioned(
              bottom: 28,
              left: 20,
              right: 20,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  ElevatedButton.icon(
                    icon: const Icon(Icons.fiber_manual_record, size: 20),
                    label: const Text('기록 시작'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor:
                      _isRecording ? Colors.grey : Colors.redAccent,
                      padding: const EdgeInsets.symmetric(
                          vertical: 14, horizontal: 18),
                    ),
                    onPressed: _isRecording ? null : _startRecording,
                  ),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.stop, size: 20),
                    label: const Text('기록 종료'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor:
                      _isRecording ? Colors.blueAccent : Colors.grey,
                      padding: const EdgeInsets.symmetric(
                          vertical: 14, horizontal: 18),
                    ),
                    onPressed: _isRecording ? _stopRecording : null,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
