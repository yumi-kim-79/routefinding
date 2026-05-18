// map_screen.dart
import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, Clipboard, ClipboardData;
import 'package:google_maps_flutter/google_maps_flutter.dart' as gmaps;
import 'package:google_maps_cluster_manager/google_maps_cluster_manager.dart'
    show ClusterManager, Cluster, ClusterItem;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

import 'generic_route_detail_screen.dart';
import 'map_input_screen.dart';
import 'mypage_screen.dart';
import 'constants/firestore_fields.dart';
// GPX 파싱 및 HTTP 요청을 위한 import
import 'package:http/http.dart' as http;
import 'package:gpx/gpx.dart';

// ─────────────────────────────────────────────
// ① 클러스터 아이템 정의 (지도 마커용)
class RouteItem implements ClusterItem {
  @override final gmaps.LatLng location;
  @override String get geohash => '${location.latitude},${location.longitude}';
  final String mountain;
  final String routeName;
  final String typeRoot;
  final String zone; // ✅ zone 필드 추가
  final DocumentReference<Map<String, dynamic>> ref;

  RouteItem({
    required this.location,
    required this.mountain,
    required this.routeName,
    required this.typeRoot,
    required this.zone,
    required this.ref,
  });
}

// ─────────────────────────────────────────────
// ② 메인 지도 화면 (탭/클러스터/필터/마커 등)
class MapScreen extends StatefulWidget {
  final String mountain;
  final bool picking; // 위치선택 모드 여부
  const MapScreen({Key? key, required this.mountain, this.picking = false}) : super(key: key);

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen>
    with SingleTickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  @override bool get wantKeepAlive => true;

  // ─ 상태 변수 및 컨트롤러
  late final TabController _tabCtrl = TabController(length: 2, vsync: this)..addListener(() => setState(() {}));
  gmaps.GoogleMapController? _mapCtrl;
  late final ClusterManager<RouteItem> _clusterManager;

  Set<gmaps.Marker> _markers = {};
  List<RouteItem> _cachedRouteItems = [];
  bool _loading = false;

  gmaps.LatLng _center = const gmaps.LatLng(37.5665, 126.9780); // 기본: 서울시청
  double _zoom = 13;
  gmaps.LatLng? _myLocation; // 내 위치

  ui.Image? _baseClusterImage;
  late gmaps.BitmapDescriptor _boulderingIcon;
  late gmaps.BitmapDescriptor _leadIcon;

  String? _selectedZone;
  List<String> _availableZones = [];

  String? _selectedType = '리드'; // "리드/볼더링" 선택, 기본은 리드
  gmaps.MapType _mapType = gmaps.MapType.normal;


  // ─────────────────────────────
  // 초기 세팅 (클러스터 매니저, 아이콘, 최초 데이터 로딩)
  @override
  void initState() {
    super.initState();
    _clusterManager = ClusterManager<RouteItem>(
      [],
      _updateMarkers,
      markerBuilder: _markerBuilder,
      stopClusteringZoom: 14,
    );
    _initAssets();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadRoutes());
  }

  Future<void> _loadZonesForMountain(String mountain) async {
    final snapshot = await FirebaseFirestore.instance
        .collection('route_reports')
        .where('mountain', isEqualTo: mountain)
        .where('status', isEqualTo: 'approved')
        .get();

    final zoneSet = <String>{};
    for (final doc in snapshot.docs) {
      final zone = doc.data()['zone'] as String?;
      if (zone != null && zone.trim().isNotEmpty) {
        zoneSet.add(zone.trim());
      }
    }

    setState(() {
      _availableZones = zoneSet.toList()..sort();
      _selectedZone = _availableZones.isNotEmpty ? _availableZones.first : null;
    });
  }

  // ─ 클러스터/마커 아이콘 로딩
  Future<void> _initAssets() async {
    final data = await rootBundle.load('assets/icons/cluster_icon.png');
    final codec = await ui.instantiateImageCodec(data.buffer.asUint8List());
    _baseClusterImage = (await codec.getNextFrame()).image;
    _boulderingIcon = await gmaps.BitmapDescriptor.fromAssetImage(
      const ImageConfiguration(size: Size(48, 48)),
      'assets/icons/bouldering_marker.png',
    );
    _leadIcon = await gmaps.BitmapDescriptor.fromAssetImage(
      const ImageConfiguration(size: Size(48, 48)),
      'assets/icons/lead_marker.png',
    );
  }

  // ─ Firestore에서 루트 목록 로드(타입별)
  Future<void> _loadRoutes() async {
    setState(() {
      _loading = true;
      _cachedRouteItems = [];
    });
    await _determineMyLocation();

    Query<Map<String, dynamic>> query;

    if (_selectedType == '리드') {
      query = FirebaseFirestore.instance
          .collection('route_reports')
          .where(RouteFields.status, isEqualTo: 'approved')
          .where('typeRoot', isEqualTo: '리드');
    } else if (_selectedType == '볼더링') {
      query = FirebaseFirestore.instance
          .collection('bouldering_reports')
          .where('status', isEqualTo: 'approved');
    } else {
      setState(() => _loading = false);
      return;
    }

    if (_selectedZone != null) {
      query = query.where('zone', isEqualTo: _selectedZone);
    }

    final querySnap = await query.get();
    final items = <RouteItem>[];
    for (var doc in querySnap.docs) {
      final d = doc.data();
      final lat = d[RouteFields.latitude];
      final lng = d[RouteFields.longitude];
      final mtn = d[RouteFields.mountain] as String? ?? '';
      final name = d[RouteFields.routeName] as String? ?? '';
      final type = d['typeRoot'] as String? ?? _selectedType!;
      final zone = d[RouteFields.zone] as String? ?? ''; // ✅ for문 안으로 이동

      if (lat is double && lng is double) {
        items.add(RouteItem(
          location: gmaps.LatLng(lat, lng),
          mountain: mtn,
          routeName: name,
          typeRoot: type,
          zone: zone, // ✅ 전달
          ref: doc.reference,
        ));
      }
    }

    _cachedRouteItems = items;
    _clusterManager.setItems(items);
    if (mounted) setState(() => _loading = false);
  }

  // ─ 내 위치(Geolocator) 갱신
  Future<void> _determineMyLocation() async {
    if (!await Geolocator.isLocationServiceEnabled()) return;
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.deniedForever || perm == LocationPermission.denied) return;
    final pos = await Geolocator.getCurrentPosition();
    _myLocation = gmaps.LatLng(pos.latitude, pos.longitude);
    _center = _myLocation!;
  }

  // ─ 마커/클러스터 UI 갱신
  void _updateMarkers(Set<gmaps.Marker> markers) => setState(() => _markers = markers);

  // ─ 클러스터 및 루트 마커 생성
  Future<gmaps.Marker> _markerBuilder(Cluster<RouteItem> cluster) async {
    if (_baseClusterImage == null) {
      return gmaps.Marker(
        markerId: gmaps.MarkerId('loading_${cluster.getId()}'),
        position: cluster.location,
      );
    }

    // 여러 루트가 겹친 클러스터
    if (cluster.isMultiple) {
      final icon = await _makeClusterIconFromBase(
          _baseClusterImage!, cluster.count);
      return gmaps.Marker(
        markerId: gmaps.MarkerId('cluster_${cluster.getId()}'),
        position: cluster.location,
        icon: icon,
        onTap: () => _onClusterTap(cluster),
      );
    }

    // 단일 루트 마커
    final item = cluster.items.first;
    final icon = (item.typeRoot == '볼더링') ? _boulderingIcon : _leadIcon;

// 좌표가 같은 루트 수 확인
    final sameLocationItems = _cachedRouteItems.where((it) =>
    it.location.latitude == item.location.latitude &&
        it.location.longitude == item.location.longitude).toList();

    final markerId = sameLocationItems.length > 1
        ? 'stacked_${item.ref.id}_${sameLocationItems.length}'
        : item.ref.id;

    return gmaps.Marker(
      markerId: gmaps.MarkerId(markerId),
      position: item.location,
      icon: icon,
      infoWindow: gmaps.InfoWindow(
        title: '${item.mountain} · ${item.zone}',
        snippet: sameLocationItems.length > 1 ? '총 ${sameLocationItems
            .length}개 루트' : '',
      ),
      onTap: () {
        if (sameLocationItems.length > 1) {
          _showClusterActions(sameLocationItems);
        } else {
          _onMarkerTap(item); // ✅ 단일 루트는 바로 상세 보기
        }
      },
    );
  }

  // ─ 클러스터 클릭: 상세 팝업
  void _onClusterTap(Cluster<RouteItem> cluster) {
    final samePos = cluster.items.map((i) => i.location).toSet().length == 1;
    if (samePos) {
      // 좌표가 모두 동일한 경우 루트 리스트 팝업 먼저
      _showClusterList(cluster.items.toList());
    } else {
      _mapCtrl?.animateCamera(
        gmaps.CameraUpdate.newLatLngZoom(cluster.location, _zoom + 1),
      );
    }
  }

  // ─ 클러스터 메뉴 팝업 (상세·주소)
  void _showClusterActions(List<RouteItem> items) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.2,
        minChildSize: 0.1,
        maxChildSize: 0.4,
        builder: (_, controller) => Container(
          decoration: BoxDecoration(
            color: Theme.of(context).canvasColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: ListView(
            controller: controller,
            children: [
              ListTile(
                leading: const Icon(Icons.info),
                title: const Text('루트 상세보기'),
                onTap: () {
                  Navigator.pop(context);
                  _showClusterList(items); // ✅ 상세보기 대신 루트 리스트를 보여줌
                },
              ),

              ListTile(
                leading: const Icon(Icons.directions),
                title: const Text('주소보기'),
                onTap: () {
                  Navigator.pop(context);
                  _showAddress(items.first.location);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─ 클러스터 내 루트 리스트 팝업
  void _showClusterList(List<RouteItem> items) {
    // 구역별로 그룹화
    final grouped = <String, List<RouteItem>>{};
    for (final item in items) {
      final zone = item.zone.isNotEmpty ? item.zone : '기타';
      grouped.putIfAbsent(zone, () => []).add(item);
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.4,
        minChildSize: 0.2,
        maxChildSize: 0.8,
        builder: (_, controller) => Container(
          decoration: BoxDecoration(
            color: Theme.of(context).canvasColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: ListView(
            controller: controller,
            children: grouped.entries.map((entry) {
              return ExpansionTile(
                title: Text(entry.key),
                children: entry.value.map((item) {
                  return ListTile(
                    title: Text('${item.mountain} · ${item.routeName}'),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => GenericRouteDetailScreen(
                            routeRef: item.ref,
                            title: '${item.mountain} · ${item.routeName}',
                          ),
                        ),
                      );
                    },
                  );
                }).toList(),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }


  // ─ 단일 마커 클릭시 상세/주소 팝업
  void _onMarkerTap(RouteItem item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.2,
        minChildSize: 0.1,
        maxChildSize: 0.4,
        builder: (_, controller) => Container(
          decoration: BoxDecoration(
            color: Theme.of(context).canvasColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: ListView(
            controller: controller,
            shrinkWrap: true,
            children: [
              ListTile(
                leading: const Icon(Icons.info),
                title: const Text('루트 상세보기'),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => GenericRouteDetailScreen(
                        routeRef: item.ref,
                        title: '${item.mountain} · ${item.routeName}',
                      ),
                    ),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.directions),
                title: const Text('주소보기'),
                onTap: () {
                  Navigator.pop(context);
                  _showAddress(item.location);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─ 좌표 -> 주소 변환 및 복사
  Future<void> _showAddress(gmaps.LatLng dest) async {
    String address = '주소를 찾을 수 없습니다.';
    try {
      final places = await placemarkFromCoordinates(dest.latitude, dest.longitude);
      if (places.isNotEmpty) {
        final p = places.first;
        final admin = p.administrativeArea ?? '';
        final local = p.locality ?? '';
        final region = (admin.isNotEmpty && admin != local) ? '$admin $local' : admin;
        address = [
          if (region.isNotEmpty) region,
          if (p.subLocality?.isNotEmpty == true) p.subLocality,
          if (p.name?.isNotEmpty == true) p.name,
        ].join(' ');
      }
    } catch (_) {}
    await showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(child: SelectableText(address)),
            IconButton(
              icon: const Icon(Icons.copy),
              tooltip: '주소 복사',
              onPressed: () {
                Clipboard.setData(ClipboardData(text: address));
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('주소가 복사되었습니다.')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  // ─ 클러스터 마커(동그라미+숫자) 생성
  Future<gmaps.BitmapDescriptor> _makeClusterIconFromBase(ui.Image baseImage, int count) async {
    final w = baseImage.width;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.drawImage(baseImage, Offset.zero, Paint());
    final text = count.toString();
    final fontSize = w * 0.3;
    final borderStyle = TextStyle(
      fontSize: fontSize, fontWeight: FontWeight.bold,
      foreground: Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = fontSize * 0.15
        ..color = Colors.black,
    );
    final fillStyle = TextStyle(
      fontSize: fontSize, fontWeight: FontWeight.bold, color: Colors.white,
    );
    final borderPainter = TextPainter(
      text: TextSpan(text: text, style: borderStyle),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: w.toDouble());
    final fillPainter = TextPainter(
      text: TextSpan(text: text, style: fillStyle),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: w.toDouble());
    final dx = (w - borderPainter.width) / 2;
    final dy = (w - borderPainter.height) / 3;
    borderPainter.paint(canvas, Offset(dx, dy));
    fillPainter.paint(canvas, Offset(dx, dy));
    final img = await recorder.endRecording().toImage(w, w);
    final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
    return gmaps.BitmapDescriptor.fromBytes(bytes!.buffer.asUint8List());
  }

  // ─────────────────────────────
  // 메인 빌드: 탭별(지도/제보) & 위치선택 모드 지원
  @override
  Widget build(BuildContext context) {
    super.build(context);

    // 위치 선택(picking) 모드: 마커 고정 + 버튼
    if (widget.picking) {
      return _buildPickerMode();
    }

    // 타입 미선택시 아무것도 띄우지 않음
    if (_selectedType == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('루트 위치'),
          bottom: TabBar(controller: _tabCtrl, tabs: const [Tab(text: '지도'), Tab(text: '루트 제보')]),
          actions: [
            IconButton(
              tooltip: '마이페이지',
              icon: const Icon(Icons.person),
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const MyPageScreen())),
            ),
          ],
        ),
        body: IndexedStack(
          index: _tabCtrl.index,
          children: [
            Column(children: [_buildFilterChips()],),
            const MapInputScreen(),
          ],
        ),
      );
    }

    // 데이터 로딩시 로딩 인디케이터
    if (_loading) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('루트 위치'),
          bottom: TabBar(controller: _tabCtrl, tabs: const [Tab(text: '지도'), Tab(text: '루트 제보')]),
          actions: [
            if (_tabCtrl.index == 0)
              IconButton(
                icon: Icon(_mapType == gmaps.MapType.normal ? Icons.satellite : Icons.map),
                tooltip: _mapType == gmaps.MapType.normal ? '위성 지도' : '일반 지도',
                onPressed: () => setState(() {
                  _mapType = _mapType == gmaps.MapType.normal
                      ? gmaps.MapType.satellite
                      : gmaps.MapType.normal;
                }),
              ),
            IconButton(
              tooltip: '마이페이지',
              icon: const Icon(Icons.person),
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const MyPageScreen())),
            ),
          ],
        ),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    // 일반 모드 (지도/제보 탭)
    return _buildNormalMode();
  }

  // ─ 위치 선택(picking) 모드 뷰
  Widget _buildPickerMode() {
    return Scaffold(
      appBar: AppBar(title: const Text('위치 선택')),
      body: Stack(
        children: [
          _buildMapWidget(enableMyLocation: true),
          const Center(child: Icon(Icons.add_location_alt, color: Colors.red, size: 48)),
        ],
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16),
        child: ElevatedButton(
          child: const Text('위치 지정'),
          onPressed: () => Navigator.of(context).pop(_center),
        ),
      ),
    );
  }

  // ─ 지도/제보 메인 뷰
  Widget _buildNormalMode() {
    return Scaffold(
      appBar: AppBar(
        title: const Text('루트 위치'),
        bottom: TabBar(controller: _tabCtrl, tabs: const [Tab(text: '지도'), Tab(text: '루트 제보')]),
        actions: [
          if (_tabCtrl.index == 0)
            IconButton(
              icon: Icon(_mapType == gmaps.MapType.normal ? Icons.satellite : Icons.map),
              tooltip: _mapType == gmaps.MapType.normal ? '위성 지도' : '일반 지도',
              onPressed: () => setState(() {
                _mapType = _mapType == gmaps.MapType.normal
                    ? gmaps.MapType.satellite
                    : gmaps.MapType.normal;
              }),
            ),
          IconButton(
            tooltip: '마이페이지',
            icon: const Icon(Icons.person),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const MyPageScreen())),
          ),
        ],
      ),
      body: IndexedStack(
        index: _tabCtrl.index,
        children: [
          Column(children: [_buildFilterChips(), Expanded(child: _buildMapWidget())]),
          const MapInputScreen(),
        ],
      ),
      floatingActionButton: (_tabCtrl.index == 0 && _myLocation != null)
          ? Padding(
        padding: const EdgeInsets.only(bottom: 100, right: 12),
        child: FloatingActionButton(
          heroTag: 'loc_main',
          child: const Icon(Icons.my_location),
          onPressed: () {
            _mapCtrl?.animateCamera(gmaps.CameraUpdate.newLatLngZoom(_myLocation!, 15));
          },
        ),
      )
          : null,
    );
  }

  // ─ 지도 타입 필터 (리드/볼더링)
  Widget _buildFilterChips() {
    final widgets = <Widget>[]; // ⚠️ 내부에서 사용할 위젯 리스트 정의

    // 리드 / 볼더링 선택용 ChoiceChip
    widgets.addAll([
      for (final type in ['리드', '볼더링'])
        ChoiceChip(
          label: Text(type),
          selected: _selectedType == type,
          onSelected: (_) async {
            if (_selectedType != type) {
              setState(() {
                _selectedType = type;
                _selectedZone = null; // 구역 초기화
                _loading = true;
              });
              await _loadRoutes();
            }
          },
        ),
    ]);

    // 구역이 여러 개인 경우 Dropdown 추가
    if (_availableZones.length > 1) {
      widgets.add(
        DropdownButton<String>(
          value: _selectedZone,
          hint: const Text('구역 선택'),
          onChanged: (value) async {
            setState(() {
              _selectedZone = value;
              _loading = true;
            });
            await _loadRoutes();
          },
          items: _availableZones.map((zone) {
            return DropdownMenuItem(
              value: zone,
              child: Text(zone),
            );
          }).toList(),
        ),
      );
    }

    // Padding 및 정렬 포함하여 리턴
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      child: Center(
        child: Wrap(
          spacing: 12,
          children: widgets,
        ),
      ),
    );
  }



  // ─ 구글맵 뷰어 (마커, 클러스터, 내 위치 지원)
  Widget _buildMapWidget({bool enableMyLocation = false}) {
    if (_selectedType == null) {
      return const SizedBox.shrink();
    }
    return gmaps.GoogleMap(
      initialCameraPosition: gmaps.CameraPosition(target: _center, zoom: _zoom),
      onMapCreated: (c) {
        _mapCtrl = c;
        _clusterManager.setMapId(c.mapId);
        _clusterManager.updateMap();
      },
      onCameraMove: (p) {
        _clusterManager.onCameraMove(p);
        _center = p.target;
        _zoom = p.zoom;
      },
      onCameraIdle: _clusterManager.updateMap,
      markers: _markers,
      myLocationEnabled: enableMyLocation,
      myLocationButtonEnabled: false,
      mapToolbarEnabled: false,
      mapType: _mapType,
    );
  }
}
