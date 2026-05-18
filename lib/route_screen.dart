// lib/route_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:routefinding/widgets/watermarked_image.dart';
import 'package:routefinding/widgets/full_image_screen.dart';
import 'constants/firestore_fields.dart';
import 'generic_route_detail_screen.dart';
import 'utils/image_url_helper.dart'; // getRouteImageUrl 정의

class RouteScreen extends StatefulWidget {
  final String mountainId;
  final String mountainName;

  const RouteScreen({
    Key? key,
    required this.mountainId,
    required this.mountainName,
  }) : super(key: key);

  @override
  State<RouteScreen> createState() => _RouteScreenState();
}

class _RouteScreenState extends State<RouteScreen> {
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    // 승인된 route_reports 중 해당 산에 속하는 루트만 쿼리
    final routesRef = FirebaseFirestore.instance
        .collection('route_reports')
        .where(RouteFields.status, isEqualTo: 'approved')
        .where(RouteFields.mountain, isEqualTo: widget.mountainName);

    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.mountainName} 루트'),
      ),
      body: Column(
        children: [
          // ── 1) 검색 바 ──
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextField(
              decoration: const InputDecoration(
                labelText: '루트 검색',
                border: UnderlineInputBorder(),
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (txt) => setState(() => _searchQuery = txt.trim()),
            ),
          ),

          // ── 2) 루트 리스트 ──
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: routesRef.snapshots(),
              builder: (ctx, snap) {
                if (snap.hasError) {
                  return Center(child: Text('로드 실패: ${snap.error}'));
                }
                if (!snap.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }

                final allDocs = snap.data!.docs;
                // 검색어 적용: routeName 포함시 노출 (대소문자 무관)
                final docs = _searchQuery.isEmpty
                    ? allDocs
                    : allDocs.where((d) {
                  final name = (d.data()[RouteFields.routeName] as String?) ?? '';
                  return name.toLowerCase().contains(_searchQuery.toLowerCase());
                }).toList();

                if (docs.isEmpty) {
                  return const Center(child: Text('등록된 루트가 없습니다.'));
                }

                return ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: docs.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (ctx2, idx) {
                    final doc = docs[idx];
                    final data = doc.data();
                    final name = data[RouteFields.routeName] as String? ?? doc.id;
                    final overview = data[RouteFields.overview] as String? ?? '';
                    final rawImageUrl = data[RouteFields.imageUrl] as String? ?? '';
                    final zone = data[RouteFields.zone] as String? ?? '';

                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(color: Colors.grey.shade300),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(6),
                          onTap: () {
                            // 상세화면 이동
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => GenericRouteDetailScreen(
                                  routeRef: doc.reference,
                                  title: '${widget.mountainName} · $name',
                                ),
                              ),
                            );
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // ── 썸네일 이미지 ──
                                Container(
                                  width: 72,
                                  height: 72,
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade200,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: rawImageUrl.isEmpty
                                      ? const Icon(
                                    Icons.photo,
                                    size: 36,
                                    color: Colors.grey,
                                  )
                                      : FutureBuilder<String?>(
                                    future: getRouteImageUrl(
                                      rawImageUrl,
                                      doc.id,
                                      mountain: widget.mountainName,
                                      zone: zone,
                                    ),
                                    builder: (c, imgSnap) {
                                      if (imgSnap.connectionState != ConnectionState.done) {
                                        return const Center(
                                          child: SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(strokeWidth: 2),
                                          ),
                                        );
                                      }
                                      final url = imgSnap.data;
                                      if (url == null) {
                                        return const Icon(
                                          Icons.broken_image,
                                          size: 36,
                                          color: Colors.grey,
                                        );
                                      }
                                      return ClipRRect(
                                        borderRadius: BorderRadius.circular(4),
                                        child: GestureDetector(
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
                                          child: WatermarkedImage(
                                            imageProvider: NetworkImage(url),
                                            watermarkText: 'RouteFinding',
                                            fit: BoxFit.cover,
                                            width: 72,
                                            height: 72,
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                ),

                                const SizedBox(width: 12),

                                // ── 제목·개요 텍스트 ──
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        name,
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.bold,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        overview,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          color: Colors.black87,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),

                                const SizedBox(width: 8),

                                // ── 화살표 아이콘 ──
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
          ),
        ],
      ),
    );
  }
}
