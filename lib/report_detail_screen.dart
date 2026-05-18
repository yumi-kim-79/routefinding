import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'utils/colored_polylines.dart';
import 'constants/firestore_fields.dart';

class ReportDetailScreen extends StatelessWidget {
  final String reportId;
  final QueryDocumentSnapshot<Map<String, dynamic>> reportData;

  const ReportDetailScreen({
    Key? key,
    required this.reportId,
    required this.reportData,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final data = reportData.data();
    final routeName = (data[RouteFields.routeName] ?? reportId).toString();
    final mountain = (data[RouteFields.mountain] ?? '').toString();

    // 어프로치 경로
    final trackingPathRaw = data[RouteFields.trackingPath] as List<dynamic>? ?? [];
    final poly = ColoredPolylines.makeColoredPath(
      path: trackingPathRaw,
      arrowIcon: null,
      arrowInterval: 9999,
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

    return Scaffold(
      appBar: AppBar(
        title: Text(
          mountain, // 상단에는 산 이름만
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 1. 산이름/구역/루트명 카드(세로로!)
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 산 이름 (무조건 노출)
                  Text(
                    '산 이름: $mountain',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
                  ),
                  const SizedBox(height: 4),
                  // 구역(있을 때만)
                  if (data[RouteFields.zone]?.toString().isNotEmpty ?? false) ...[
                    Text(
                      '구역: ${data[RouteFields.zone]}',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                    const SizedBox(height: 4),
                  ],
                  // 루트명(줄임X, 여러 줄 허용)
                  Text(
                    '루트 이름: $routeName',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ],
              ),
            ),
          ),
          // 2. 어프로치/루트 경로 미니맵
          if (poly.polylines.isNotEmpty && start != null)
            Padding(
              padding: const EdgeInsets.only(top: 18.0, bottom: 18.0),
              child: SizedBox(
                height: 140,
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
          // 3. 세부 내용(개요, 구역, 난이도, 장비, 상세설명)
          if (data[RouteFields.overview]?.toString().isNotEmpty ?? false)
            Padding(
              padding: const EdgeInsets.only(top: 4.0, bottom: 4.0),
              child: Text(
                '개요: ${data[RouteFields.overview]}',
                style: const TextStyle(fontSize: 15),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          if (data[RouteFields.zone]?.toString().isNotEmpty ?? false)
            Padding(
              padding: const EdgeInsets.only(top: 2.0, bottom: 2.0),
              child: Text(
                '구역: ${data[RouteFields.zone]}',
                style: const TextStyle(fontSize: 15),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          if (data[RouteFields.avgDifficulty]?.toString().isNotEmpty ?? false)
            Padding(
              padding: const EdgeInsets.only(top: 2.0, bottom: 2.0),
              child: Text(
                '평균난이도: ${data[RouteFields.avgDifficulty]}',
                style: const TextStyle(fontSize: 15),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          if (data[RouteFields.equipment]?.toString().isNotEmpty ?? false)
            Padding(
              padding: const EdgeInsets.only(top: 2.0, bottom: 2.0),
              child: Text(
                '장비: ${data[RouteFields.equipment]}',
                style: const TextStyle(fontSize: 15),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          if (data['description']?.toString().isNotEmpty ?? false)
            Padding(
              padding: const EdgeInsets.only(top: 4.0),
              child: Text(
                '상세설명: ${data['description']}',
                style: const TextStyle(fontSize: 15),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ),
        ],
      ),
    );
  }
}
