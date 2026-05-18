// utils/colored_polylines.dart

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';

/// 지도 Polyline과 진행방향 화살표 마커를 생성하는 유틸 클래스
class ColoredPolylines {
  /// Polyline/Marker 세트 반환 (모든 기능 100% 유지)
  ///
  /// [path] : List<LatLng> 또는 List<Map<String, dynamic>>
  /// [arrowIcon] : BitmapDescriptor 커스텀 화살표 PNG (null이면 마커X)
  /// [arrowInterval] : 마커 생성 간격 (기본 5, 1이하면 모든 점마다 표시)
  static ({Set<Polyline> polylines, Set<Marker> markers}) makeColoredPath({
    required List<dynamic> path,
    BitmapDescriptor? arrowIcon,
    int arrowInterval = 5,
  }) {
    final parsed = _parsePath(path);
    if (parsed.length < 2) return (polylines: {}, markers: {});

    final polylines = <Polyline>{};
    final markers = <Marker>{};
    final interval = (arrowInterval <= 1) ? 1 : arrowInterval;

    for (int i = 1; i < parsed.length; i++) {
      final p1 = parsed[i - 1], p2 = parsed[i];
      final lat1 = p1['latitude'] as double, lng1 = p1['longitude'] as double;
      final lat2 = p2['latitude'] as double, lng2 = p2['longitude'] as double;

      final t1 = p1['timestamp'] as int, t2 = p2['timestamp'] as int;
      final dt = (t2 - t1) / 1000.0;
      final dist = Geolocator.distanceBetween(lat1, lng1, lat2, lng2);
      final speed = (dt > 0) ? dist / dt : 0.0;

      polylines.add(
        Polyline(
          polylineId: PolylineId('seg_$i'),
          points: [LatLng(lat1, lng1), LatLng(lat2, lng2)],
          width: 6,
          color: _colorBySpeed(speed),
        ),
      );

      if (arrowIcon != null && i % interval == 0) {
        final bearing = Geolocator.bearingBetween(lat1, lng1, lat2, lng2);
        markers.add(
          Marker(
            markerId: MarkerId('arrow_$i'),
            position: LatLng(lat2, lng2),
            icon: arrowIcon,
            rotation: bearing,
            anchor: const Offset(0.5, 0.5),
            flat: true,
          ),
        );
      }
    }
    return (polylines: polylines, markers: markers);
  }

  /// 입력 path → List<Map<String, dynamic>> 통일 (timestamp 없으면 0)
  static List<Map<String, dynamic>> _parsePath(List<dynamic> path) {
    if (path.isEmpty) return [];
    if (path.first is LatLng) {
      return path.map<Map<String, dynamic>>((p) => {
        'latitude': (p as LatLng).latitude,
        'longitude': (p as LatLng).longitude,
        'timestamp': 0,
      }).toList();
    }
    if (path.first is Map) {
      return List<Map<String, dynamic>>.from(path.map((p) => {
        'latitude': (p['latitude'] as num).toDouble(),
        'longitude': (p['longitude'] as num).toDouble(),
        'timestamp': (p['timestamp'] ?? 0) is int
            ? (p['timestamp'] ?? 0)
            : int.tryParse('${p['timestamp']}') ?? 0,
      }));
    }
    return [];
  }

  /// 속도(m/s) → 컬러 (고속: green, 중간: yellow, 저속: red)
  static Color _colorBySpeed(double speed) {
    if (speed >= 1.0) return Colors.green;
    if (speed >= 0.5) return Colors.yellow;
    return Colors.red;
  }
}
