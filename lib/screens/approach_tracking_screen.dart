// lib/screens/approach_tracking_screen.dart

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:routefinding/utils/colored_polylines.dart';

class ApproachTrackingScreen extends StatefulWidget {
  final List<Map<String, dynamic>> trackingPath;
  const ApproachTrackingScreen({required this.trackingPath, Key? key}) : super(key: key);

  @override
  State<ApproachTrackingScreen> createState() => _ApproachTrackingScreenState();
}

class _ApproachTrackingScreenState extends State<ApproachTrackingScreen> {
  LatLng? _currentLocation;
  GoogleMapController? _mapController;
  MapType _mapType = MapType.normal;

  late final List<Map<String, dynamic>> _path;

  @override
  void initState() {
    super.initState();
    _path = List<Map<String, dynamic>>.from(widget.trackingPath);
    _getCurrentLocation();
    _startLocationUpdates();
  }

  Future<void> _getCurrentLocation() async {
    try {
      Position pos = await Geolocator.getCurrentPosition();
      setState(() {
        _currentLocation = LatLng(pos.latitude, pos.longitude);
      });
      _moveToUser();
    } catch (e) {
      // 위치 권한 거부 등 에러 무시 (별도 안내 가능)
    }
  }

  void _startLocationUpdates() {
    Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 5,
      ),
    ).listen((Position pos) {
      setState(() {
        _currentLocation = LatLng(pos.latitude, pos.longitude);
      });
    });
  }

  void _moveToUser() {
    if (_mapController != null && _currentLocation != null) {
      _mapController!.animateCamera(
        CameraUpdate.newLatLng(_currentLocation!),
      );
    }
  }

  Map<String, dynamic> get _pathStats {
    if (_path.length < 2) return {};
    final first = _path.first;
    final last = _path.last;
    final int t1 = (first['timestamp'] ?? 0);
    final int t2 = (last['timestamp'] ?? 0);
    final Duration duration = Duration(milliseconds: t2 - t1);

    double dist = 0.0;
    double totalSpeed = 0.0;
    double minAlt = double.infinity;
    double maxAlt = -double.infinity;
    int cntSpeed = 0;
    for (int i = 1; i < _path.length; i++) {
      final p1 = _path[i - 1];
      final p2 = _path[i];
      final lat1 = (p1['latitude'] as num).toDouble();
      final lng1 = (p1['longitude'] as num).toDouble();
      final lat2 = (p2['latitude'] as num).toDouble();
      final lng2 = (p2['longitude'] as num).toDouble();
      final d = Geolocator.distanceBetween(lat1, lng1, lat2, lng2);
      dist += d;
      final int ts1 = (p1['timestamp'] ?? 0);
      final int ts2 = (p2['timestamp'] ?? 0);
      final double dt = (ts2 - ts1) / 1000.0;
      final double speed = (dt > 0) ? d / dt : 0;
      if (speed > 0) {
        totalSpeed += speed;
        cntSpeed++;
      }
      if (p2['altitude'] != null) {
        final alt = (p2['altitude'] as num).toDouble();
        if (alt < minAlt) minAlt = alt;
        if (alt > maxAlt) maxAlt = alt;
      }
    }
    final avgSpeed = cntSpeed > 0 ? totalSpeed / cntSpeed : 0;
    final String durationStr =
        "${duration.inHours}:${(duration.inMinutes % 60).toString().padLeft(2, '0')}:${(duration.inSeconds % 60).toString().padLeft(2, '0')}";
    return {
      'duration': durationStr,
      'distance': dist,
      'avgSpeed': avgSpeed,
      'minAlt': minAlt.isFinite ? minAlt : null,
      'maxAlt': maxAlt.isFinite ? maxAlt : null,
    };
  }

  @override
  Widget build(BuildContext context) {
    if (_path.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('경로 따라가기')),
        body: const Center(child: Text('어프로치 경로가 없습니다.')),
      );
    }
    final first = LatLng(
      (_path.first['latitude'] as num).toDouble(),
      (_path.first['longitude'] as num).toDouble(),
    );

    final result = ColoredPolylines.makeColoredPath(
      path: _path,
      arrowInterval: 5,
    );
    final polylines = result.polylines;
    final markers = result.markers;
    final stats = _pathStats;

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
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: first,
              zoom: 15,
            ),
            polylines: polylines,
            markers: {
              if (_path.isNotEmpty)
                Marker(
                  markerId: const MarkerId('start'),
                  position: first,
                  icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
                  infoWindow: const InfoWindow(title: '출발'),
                ),
              if (_path.length > 1)
                Marker(
                  markerId: const MarkerId('end'),
                  position: LatLng(
                    (_path.last['latitude'] as num).toDouble(),
                    (_path.last['longitude'] as num).toDouble(),
                  ),
                  icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
                  infoWindow: const InfoWindow(title: '도착'),
                ),
              ...markers,
              if (_currentLocation != null)
                Marker(
                  markerId: const MarkerId('me'),
                  position: _currentLocation!,
                  icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
                  infoWindow: const InfoWindow(title: '내 위치'),
                ),
            },
            onMapCreated: (c) => _mapController = c,
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapType: _mapType,
          ),
          if (stats.isNotEmpty)
            Positioned(
              top: 32,
              left: 24,
              right: 24,
              child: _TrackingStatsCard(stats: stats),
            ),
        ],
      ),
    );
  }
}

class _TrackingStatsCard extends StatelessWidget {
  final Map<String, dynamic> stats;
  const _TrackingStatsCard({required this.stats});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.white.withOpacity(0.93),
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('기간: ${stats['duration']}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('거리: ${(stats['distance'] / 1000).toStringAsFixed(2)} km', style: const TextStyle(fontSize: 15)),
            const SizedBox(height: 4),
            Text('평균속도: ${stats['avgSpeed'].toStringAsFixed(2)} m/s', style: const TextStyle(fontSize: 15)),
            if (stats['minAlt'] != null && stats['maxAlt'] != null)
              Text('고도: ${stats['minAlt'].toStringAsFixed(1)} ~ ${stats['maxAlt'].toStringAsFixed(1)} m', style: const TextStyle(fontSize: 15)),
          ],
        ),
      ),
    );
  }
}
