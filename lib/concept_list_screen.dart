import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:routefinding/widgets/full_image_screen.dart';
import 'constants/firestore_fields.dart';
import 'generic_route_detail_screen.dart';
import 'package:cached_network_image/cached_network_image.dart';

/// 이미지 워터마크 위젯
/// - 이미지를 클릭하면 전체보기(확대)
/// - 이미지가 없거나 에러시 대체 아이콘 표시
Widget buildImageWithWatermark(
    BuildContext context,
    String imageUrl, {
      double height = 80,
      double borderRadius = 8,
    }
    ) {
  final fontSize = height * 0.15;
  return GestureDetector(
    onTap: () => Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => FullImageScreen(imageUrl: imageUrl),
      ),
    ),
    child: Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(borderRadius),
          child: CachedNetworkImage(
            imageUrl: imageUrl,
            height: height,
            width: height * 1.3,
            fit: BoxFit.cover,
            placeholder: (_, __) => Container(
              height: height,
              width: height * 1.3,
              color: Colors.grey[200],
              child: const Center(
                child: SizedBox(
                  width: 24, height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
            errorWidget: (_, __, ___) => Container(
              height: height,
              width: height * 1.3,
              color: Colors.grey[200],
              child: const Icon(Icons.broken_image, size: 32, color: Colors.grey),
            ),
          ),
        ),
        Positioned.fill(
          child: Center(
            child: Opacity(
              opacity: 0.7,
              child: Text(
                'routefinding',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: fontSize,
                  fontWeight: FontWeight.bold,
                  shadows: [
                    Shadow(
                      blurRadius: 2,
                      color: Colors.black.withOpacity(0.5),
                      offset: const Offset(0.5, 0.5),
                    ),
                  ],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

/// 개념도(리드/볼더링) 전체 리스트/필터 화면
/// 네트워크 fetch 최적화 및 캐싱, 상태관리 고도화
class ConceptListScreen extends StatefulWidget {
  const ConceptListScreen({Key? key}) : super(key: key);

  @override
  State<ConceptListScreen> createState() => _ConceptListScreenState();
}

class _ConceptListScreenState extends State<ConceptListScreen> {
  String _selectedType     = '리드';
  String? _selectedMountain;
  String? _selectedZone;
  String _searchText       = '';

  final List<String> _typeOptions = ['리드', '볼더링'];
  List<String> _mountains = [];
  List<String> _zones     = [];

  /// 산/구역 목록 메모리 캐싱 (타입별)
  final Map<String, List<String>> _mountainCache = {};
  final Map<String, Map<String, List<String>>> _zoneCache = {};

  @override
  void initState() {
    super.initState();
    _loadMountainLists();
  }

  /// 타입별 산 목록 파이어스토어 fetch(최초 1회만)
  Future<void> _loadMountainLists() async {
    final key = _selectedType;
    if (_mountainCache.containsKey(key)) {
      setState(() {
        _mountains = _mountainCache[key]!;
        _selectedMountain = null;
        _zones = [];
        _selectedZone = null;
      });
      return;
    }
    final fire = FirebaseFirestore.instance;
    final Set<String> mountainSet = {};

    if (_selectedType == '리드') {
      final snap = await fire
          .collection('route_reports')
          .where(RouteFields.status, isEqualTo: 'approved')
          .where('typeRoot', isEqualTo: '리드')
          .get();
      for (var doc in snap.docs) {
        final m = doc.data()[RouteFields.mountain] as String?;
        if (m != null && m.isNotEmpty) mountainSet.add(m);
      }
    } else {
      final snap = await fire
          .collection('bouldering_reports')
          .where('status', isEqualTo: 'approved')
          .get();
      for (var doc in snap.docs) {
        final m = doc.data()['mountain'] as String?;
        if (m != null && m.isNotEmpty) mountainSet.add(m);
      }
    }
    final result = mountainSet.toList()..sort();
    _mountainCache[key] = result;
    setState(() {
      _mountains = result;
      _selectedMountain = null;
      _zones = [];
      _selectedZone = null;
    });
  }

  /// 산 선택 시 구역 목록 로드 (1회 캐싱)
  Future<void> _loadZonesForMountain(String? mountain) async {
    if (mountain == null) {
      setState(() {
        _zones = [];
        _selectedZone = null;
      });
      return;
    }
    final tkey = _selectedType;
    final mkey = mountain;
    _zoneCache.putIfAbsent(tkey, () => {});
    if (_zoneCache[tkey]!.containsKey(mkey)) {
      setState(() {
        _zones = _zoneCache[tkey]![mkey]!;
        _selectedZone = null;
      });
      return;
    }

    final fire = FirebaseFirestore.instance;
    final Set<String> zoneSet = {};
    if (_selectedType == '리드') {
      final snap = await fire
          .collection('route_reports')
          .where(RouteFields.status, isEqualTo: 'approved')
          .where('typeRoot', isEqualTo: '리드')
          .where(RouteFields.mountain, isEqualTo: mountain)
          .get();
      for (var doc in snap.docs) {
        final z = doc.data()[RouteFields.zone] as String?;
        if (z != null && z.isNotEmpty) zoneSet.add(z);
      }
    } else {
      final snap = await fire
          .collection('bouldering_reports')
          .where('status', isEqualTo: 'approved')
          .where('mountain', isEqualTo: mountain)
          .get();
      for (var doc in snap.docs) {
        final z = doc.data()['zone'] as String?;
        if (z != null && z.isNotEmpty) zoneSet.add(z);
      }
    }
    final result = zoneSet.toList()..sort();
    _zoneCache[tkey]![mkey] = result;
    setState(() {
      _zones = result;
      _selectedZone = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final fire = FirebaseFirestore.instance;

    // 쿼리 준비 (StreamBuilder에서만 실시간 처리)
    Query<Map<String, dynamic>>? query;
    if (_selectedMountain != null) {
      query = fire
          .collection('route_reports')
          .where('status', isEqualTo: 'approved')
          .where('typeRoot', isEqualTo: '리드')
          .where('mountain', isEqualTo: _selectedMountain)
          .orderBy('zone')
          .orderBy('routeName');
      if (_selectedZone != null) {
        query = query.where('zone', isEqualTo: _selectedZone);
      }
    }


    return Scaffold(
      appBar: AppBar(title: const Text('개념도')),
      body: Column(
        children: [
          // 타입(리드/볼더링) 선택
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Wrap(
              spacing: 8,
              children: _typeOptions.map((type) {
                return ChoiceChip(
                  label: Text(type),
                  selected: _selectedType == type,
                  onSelected: (_) {
                    setState(() {
                      _selectedType = type;
                      _selectedMountain = null;
                      _selectedZone = null;
                      _zones = [];
                    });
                    _loadMountainLists();
                  },
                );
              }).toList(),
            ),
          ),
          // 산, 구역 드롭다운
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                const Text('등반지:', style: TextStyle(fontSize: 14)),
                const SizedBox(width: 8),
                SizedBox(
                  width: 160, height: 44,
                  child: DropdownButton<String>(
                    value: _selectedMountain,
                    hint: const Text('선택'),
                    isExpanded: true,
                    underline: Container(),
                    style: const TextStyle(fontSize: 15, color: Colors.black),
                    icon: const Icon(Icons.arrow_drop_down, size: 40),
                    items: _mountains.map((m) =>
                        DropdownMenuItem(value: m, child: Text(m, overflow: TextOverflow.ellipsis))
                    ).toList(),
                    onChanged: (v) {
                      setState(() {
                        _selectedMountain = v;
                        _selectedZone     = null;
                        _zones            = [];
                      });
                      _loadZonesForMountain(v);
                    },
                  ),
                ),
                const SizedBox(width: 16),
                const Text('구역:', style: TextStyle(fontSize: 14)),
                const SizedBox(width: 8),
                SizedBox(
                  width: 100, height: 44,
                  child: DropdownButton<String>(
                    value: _selectedZone,
                    hint: const Text('선택'),
                    isExpanded: true,
                    underline: Container(),
                    style: const TextStyle(fontSize: 15, color: Colors.black),
                    icon: const Icon(Icons.arrow_drop_down, size: 40),
                    items: _zones.map((z) =>
                        DropdownMenuItem(value: z, child: Text(z, overflow: TextOverflow.ellipsis))
                    ).toList(),
                    onChanged: (v) => setState(() {
                      _selectedZone = v;
                    }),
                  ),
                ),
              ],
            ),
          ),

          // 검색창
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: SizedBox(
              height: 44,
              child: TextField(
                decoration: InputDecoration(
                  hintText: _selectedMountain == null
                      ? '검색하려면 등반지를 먼저 선택해 주세요'
                      : '루트명 검색',
                  prefixIcon: const Icon(Icons.search),
                  border: const OutlineInputBorder(),
                  contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                ),
                enabled: _selectedMountain != null, // 등반지 선택 전에는 입력 비활성화
                onChanged: (v) => setState(() {
                  _searchText = v.trim();
                }),
              ),
            ),
          ),

          const Divider(height: 1),

          // 루트 리스트
          if (_selectedMountain == null)
            const Expanded(child: SizedBox())
          else
            Expanded(
              child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: query!.limit(1000).snapshots(),
                builder: (ctx, snap) {
                  if (snap.hasError) {
                    return Center(child: Text('에러: ${snap.error}'));
                  }
                  if (!snap.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  // 🔥 Firestore 정렬 그대로 사용! sort 코드 전부 삭제!
                  var docs = snap.data!.docs.toList();

                  // 🔍 검색어 필터 (정렬 유지)
                  if (_searchText.isNotEmpty) {
                    docs = docs.where((doc) {
                      final name = doc.data()[RouteFields.routeName]?.toString() ?? '';
                      return name.contains(_searchText);
                    }).toList();
                  }

                  // 🔥 이름순 등 정렬 코드 전부 삭제! (아래 두 개 모두 제거!)
                  // docs.sort((a, b) {...});
                  // docs.sort((a, b) {...});

                  if (docs.isEmpty) {
                    return const Center(child: Text('해당 조건의 루트가 없습니다.'));
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: docs.length,
                    itemBuilder: (context, i) {
                      final doc       = docs[i];
                      final data      = doc.data();
                      final mountain  = data['mountain']      as String? ?? '';
                      final zone      = data['zone']          as String? ?? '';
                      final routeName = data[RouteFields.routeName] as String? ?? '';
                      final overview  = data[RouteFields.overview]   as String? ?? '';
                      final difficulty= data[RouteFields.difficulty] as String? ?? '';

                      // ─── 여기부터 추가 ───
                      // 1) imageUrls 배열 꺼내기
                      final rawArray = data['imageUrls'] as List<dynamic>? ?? [];
                      final urls     = rawArray.cast<String>();
                      // 2) previewUrl 결정 (배열이 비어 있으면 기존 single 필드 사용)
                      final previewUrl = urls.isNotEmpty
                          ? urls.first
                          : (data[RouteFields.imageUrl] as String? ?? '');
                      // ─── 여기까지 추가 ───

                      final myRouteDoc = user == null
                          ? null
                          : fire
                          .collection('users')
                          .doc(user.uid)
                          .collection('my_routes')
                          .doc(doc.id);

                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        child: Card(
                          elevation: 2,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(8),
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => GenericRouteDetailScreen(
                                  routeRef: doc.reference,
                                  title: '$mountain · $zone · $routeName',
                                ),
                              ),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // 이미지+루트정보 한 줄
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      if (previewUrl.isNotEmpty)
                                        buildImageWithWatermark(context, previewUrl)
                                      else
                                        Container(
                                          width: 104,
                                          height: 80,
                                          decoration: BoxDecoration(
                                            color: Colors.grey[100],
                                            borderRadius: BorderRadius.circular(8),
                                            border: Border.all(color: Colors.grey[300]!),
                                          ),
                                          child: const Center(
                                            child: Text(
                                              '루트 개념도를\n제보해 주세요',
                                              style: TextStyle(
                                                fontSize: 13,
                                                color: Colors.grey,
                                                fontWeight: FontWeight.bold,
                                              ),
                                              textAlign: TextAlign.center,
                                            ),
                                          ),
                                        ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              '$mountain · $zone · $routeName',
                                              style: const TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            if (overview.isNotEmpty)
                                              Text(
                                                overview,
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(fontSize: 13, color: Colors.black87),
                                              ),
                                            if (_selectedType == '볼더링' && difficulty.isNotEmpty)
                                              Text(
                                                '난이도: $difficulty',
                                                style: const TextStyle(fontSize: 13, color: Colors.black54),
                                              ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      if (user != null && myRouteDoc != null)
                                        StreamBuilder<DocumentSnapshot>(
                                          stream: myRouteDoc.snapshots(),
                                          builder: (ctx2, bmSnap) {
                                            final exists = bmSnap.hasData && bmSnap.data!.exists;
                                            return IconButton(
                                              icon: Icon(
                                                exists ? Icons.bookmark : Icons.bookmark_border,
                                                color: exists ? Colors.blueAccent : Colors.grey,
                                              ),
                                              onPressed: () async {
                                                if (exists) {
                                                  await myRouteDoc.delete();
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    SnackBar(content: Text('“$routeName”을 MY ROUTE에서 제거했습니다.')),
                                                  );
                                                } else {
                                                  await myRouteDoc.set({
                                                    'mountain': mountain,
                                                    'routeName': routeName,
                                                    'routeRef': doc.reference,
                                                    'savedAt': Timestamp.now(),
                                                  });
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    SnackBar(content: Text('“$routeName”을 MY ROUTE에 저장했습니다.')),
                                                  );
                                                }
                                              },
                                            );
                                          },
                                        ),
                                    ],
                                  ),

                                  // 피치 미리보기 (리드 전용)
                                  if (_selectedType == '리드')
                                    _PitchPreviewList(docId: doc.id),
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

/// 리드 루트: 하위 컬렉션 pitches 미리보기 (StreamBuilder로 실시간 fetch)
class _PitchPreviewList extends StatelessWidget {
  final String docId;
  const _PitchPreviewList({required this.docId});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('route_reports')
          .doc(docId)
          .collection('pitches')
          .snapshots(),
      builder: (context, snap) {
        if (snap.hasError) {
          return const Text('피치정보 로드 실패', style: TextStyle(fontSize: 12, color: Colors.grey));
        }
        if (!snap.hasData) {
          return const Text('로딩 중...', style: TextStyle(fontSize: 12, color: Colors.grey));
        }
        final pdocs = snap.data!.docs;
        if (pdocs.isEmpty) {
          return const Text('피치정보 없음', style: TextStyle(fontSize: 12, color: Colors.grey));
        }
        // 피치 번호 오름차순 정렬
        pdocs.sort((a, b) {
          final na = a.data()[PitchFields.name] as String? ?? '';
          final nb = b.data()[PitchFields.name] as String? ?? '';
          final ai = int.tryParse(RegExp(r'\d+').firstMatch(na)?.group(0) ?? '') ?? 0;
          final bi = int.tryParse(RegExp(r'\d+').firstMatch(nb)?.group(0) ?? '') ?? 0;
          return ai.compareTo(bi);
        });
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: pdocs.map((pDoc) {
            final p       = pDoc.data();
            final pname   = p[PitchFields.name]       as String? ?? '';
            final plen    = p[PitchFields.length]     as String? ?? '';
            final pstyle  = p[PitchFields.style]      as String? ?? '';
            final pdiff   = p[PitchFields.difficulty] as String? ?? '';
            final pgear   = p[PitchFields.gear]       as String? ?? '';
            final pimage  = p[PitchFields.imageUrl]   as String? ?? '';
            return Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  if (pimage.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: buildImageWithWatermark(context, pimage, height: 48, borderRadius: 6),
                    ),
                  Expanded(
                    child: Text(
                      '$pname · $plen · $pstyle · $pdiff · $pgear',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        );
      },
    );
  }
}
