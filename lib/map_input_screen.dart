// lib/map_input_screen.dart

import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:routefinding/widgets/watermarked_image.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'home_screen.dart';
import 'map_screen.dart';
import 'screens/tracking_screen.dart';
import 'screens/image_editor_screen.dart';

import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher_string.dart';
import 'package:gpx/gpx.dart';

const String _kDraftListKey = 'route_report_draft_list';
const String _kDraftPrefix = 'route_report_draft_';

class _PitchEntry {
  final nameCtrl = TextEditingController();
  final lengthCtrl = TextEditingController();
  final diffCtrl = TextEditingController();
  final styleCtrl = TextEditingController();
  final gearCtrl = TextEditingController();
  List<dynamic> images = []; // File 또는 String (최대 4장)

  _PitchEntry({String? initialName, List<dynamic>? initialImages}) {
    if (initialName != null) nameCtrl.text = initialName;
    if (initialImages != null) images = List<dynamic>.from(initialImages);
  }
  void dispose() {
    nameCtrl.dispose();
    lengthCtrl.dispose();
    diffCtrl.dispose();
    styleCtrl.dispose();
    gearCtrl.dispose();
  }
  Map<String, dynamic> toJson() => {
    'name': nameCtrl.text,
    'length': lengthCtrl.text,
    'difficulty': diffCtrl.text,
    'style': styleCtrl.text,
    'gear': gearCtrl.text,
    'images': images.map((img) {
      if (img is File) return img.path;
      if (img is String) return img;
      return null;
    }).where((e) => e != null).toList(),
  };
  static _PitchEntry fromJson(Map<String, dynamic> json) {
    final p = _PitchEntry();
    p.nameCtrl.text = json['name'] as String? ?? '';
    p.lengthCtrl.text = json['length'] as String? ?? '';
    p.diffCtrl.text = json['difficulty'] as String? ?? '';
    p.styleCtrl.text = json['style'] as String? ?? '';
    p.gearCtrl.text = json['gear'] as String? ?? '';
    final imgs = json['images'] as List?;
    if (imgs != null) {
      p.images = imgs
          .where((e) => e != null)
          .map((e) => (e is String && File(e).existsSync()) ? File(e) : e)
          .toList();
    }
    return p;
  }
}

class _DraftMeta {
  final String id, title;
  final DateTime savedAt;
  _DraftMeta({required this.id, required this.title, required this.savedAt});
  factory _DraftMeta.fromJson(Map<String, dynamic> j) => _DraftMeta(
    id: j['id'] as String,
    title: j['title'] as String,
    savedAt: DateTime.parse(j['savedAt'] as String),
  );
  Map<String, dynamic> toJson() =>
      {'id': id, 'title': title, 'savedAt': savedAt.toIso8601String()};
}

class MapInputScreen extends StatefulWidget {
  final String? reportId;
  const MapInputScreen({Key? key, this.reportId}) : super(key: key);
  @override
  State<MapInputScreen> createState() => _MapInputScreenState();
}

class _MapInputScreenState extends State<MapInputScreen> {
  List<dynamic> _displayImages = []; // 루트 대표 이미지들 (File 또는 String)
  List<String?> _existingImageUrls = [];
  String _typeRoot = '리드';
  String? _editingDraftId;
  List<_DraftMeta> _draftList = [];
  List<String> _leadMountains = ['직접 입력'];
  List<String> _boulderMountains = ['직접 입력'];
  bool _loadingMountains = true;
  List<Map<String, dynamic>> _trackingPath = [];
  bool _hasTracked = false;
  String _selectedMountain = '직접 입력';
  final _customMountainCtrl = TextEditingController();
  final _routeNameCtrl = TextEditingController();
  final _overviewCtrl = TextEditingController();
  final _typeCtrl = TextEditingController();
  final _equipmentCtrl = TextEditingController();
  final _avgDiffCtrl = TextEditingController();
  final _pioneerCtrl = TextEditingController();
  final _latCtrl = TextEditingController();
  final _lngCtrl = TextEditingController();
  final _zoneCtrl = TextEditingController();
  final _directionsCtrl = TextEditingController();
  final _noCtrl = TextEditingController();
  final _difficultyCtrl = TextEditingController();
  final List<_PitchEntry> _pitches = [];
  bool _loadingExisting = false;
  bool _saving = false;
  File? _selectedImage;
  String? _existingImageUrl;
  String? _gpxFilePath;
  // --- [구역 선택 상태] ---
  List<String> _zones = [];     // 현재 산에 대한 구역 후보
  String? _selectedZone;        // 드롭다운으로 선택된 구역
  bool _manualZone = false;     // '직접 입력' 모드 여부


  @override
  void initState() {
    super.initState();
    _loadDraftList();
    _fetchMountainList();
    if (widget.reportId != null) {
      _loadingExisting = true;
      _loadExistingReport();
    }
  }

  Future<void> _fetchMountainList() async {
    try {
      final leadSnap = await FirebaseFirestore.instance
          .collection('route_reports')
          .where('status', isEqualTo: 'approved')
          .get();
      final Set<String> leadSet = {};
      for (var doc in leadSnap.docs) {
        final m = (doc.data()['mountain'] as String?)?.trim();
        if (m != null && m.isNotEmpty) leadSet.add(m);
      }
      final boulderSnap = await FirebaseFirestore.instance
          .collection('bouldering_reports')
          .where('status', isEqualTo: 'approved')
          .get();
      final Set<String> boulderSet = {};
      for (var doc in boulderSnap.docs) {
        final m = (doc.data()['mountain'] as String?)?.trim();
        if (m != null && m.isNotEmpty) boulderSet.add(m);
      }
      if (!mounted) return;
      setState(() {
        _leadMountains = ['직접 입력', ...leadSet.toList()..sort()];
        _boulderMountains = ['직접 입력', ...boulderSet.toList()..sort()];
        _loadingMountains = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingMountains = false);
    }
  }

  // 산 이름으로 구역 후보들을 불러와 드롭다운에 채웁니다.
  Future<void> _loadZonesForMountain(String mountain) async {
    try {
      final set = <String>{};

      // 리드 제보에서 구역 수집
      final leadQs = await FirebaseFirestore.instance
          .collection('route_reports')
          .where('mountain', isEqualTo: mountain)
          .limit(500)
          .get();
      for (final d in leadQs.docs) {
        final z = (d.data()['zone'] as String?)?.trim();
        if (z != null && z.isNotEmpty) set.add(z);
      }

      // 볼더링 제보에서도 구역 수집
      final boulderQs = await FirebaseFirestore.instance
          .collection('bouldering_reports')
          .where('mountain', isEqualTo: mountain)
          .limit(500)
          .get();
      for (final d in boulderQs.docs) {
        final z = (d.data()['zone'] as String?)?.trim();
        if (z != null && z.isNotEmpty) set.add(z);
      }

      final list = set.toList()..sort();
      if (!mounted) return;
      setState(() {
        _zones = list;
        // 산이 바뀌면 구역 선택/입력 초기화
        _selectedZone = null;
        _manualZone = false;
        _zoneCtrl.clear(); // 기존 컨트롤러와 동기화(임시저장 호환)
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('구역 목록 불러오기 실패: $e')),
      );
    }
  }


  @override
  void dispose() {
    _customMountainCtrl.dispose();
    _routeNameCtrl.dispose();
    _overviewCtrl.dispose();
    _typeCtrl.dispose();
    _equipmentCtrl.dispose();
    _avgDiffCtrl.dispose();
    _pioneerCtrl.dispose();
    _latCtrl.dispose();
    _lngCtrl.dispose();
    _zoneCtrl.dispose();
    _directionsCtrl.dispose();
    _noCtrl.dispose();
    _difficultyCtrl.dispose();
    for (var p in _pitches) {
      p.dispose();
    }
    super.dispose();
  }

  Future<void> _loadDraftList() async {
    final prefs = await SharedPreferences.getInstance();
    final user = FirebaseAuth.instance.currentUser;
    List<_DraftMeta> local = [];
    final listKey = user != null
        ? '$_kDraftListKey ${user.uid}'
        : _kDraftListKey;
    final raw = prefs.getString(listKey);
    if (raw != null) {
      try {
        final arr = json.decode(raw) as List;
        local = arr
            .map((e) => _DraftMeta.fromJson(e as Map<String, dynamic>))
            .toList();
      } catch (_) {}
    }
    if (!mounted) return;
    setState(() => _draftList = local);
  }

  Future<void> _loadExistingReport() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('route_reports')
          .doc(widget.reportId)
          .get();
      if (!doc.exists) {
        if (!mounted) return;
        return setState(() => _loadingExisting = false);
      }
      final d = doc.data();
      if (d == null) {
        if (!mounted) return;
        return setState(() => _loadingExisting = false);
      }
      setState(() {
        _typeRoot = d['typeRoot'] as String? ?? '리드';
        final m = (d['mountain'] as String?) ?? '직접 입력';
        _selectedMountain =
        (_typeRoot == '리드' ? _leadMountains : _boulderMountains)
            .contains(m) ? m : '직접 입력';
        if (_selectedMountain == '직접 입력') _customMountainCtrl.text = m;
        _routeNameCtrl.text = d['routeName'] as String? ?? '';
        _overviewCtrl.text = d['overview'] as String? ?? '';
        _typeCtrl.text = d['type'] as String? ?? '';
        _equipmentCtrl.text = d['equipment'] as String? ?? '';
        _avgDiffCtrl.text = d['avgDifficulty'] as String? ?? '';
        _pioneerCtrl.text = d['pioneer'] as String? ?? '';
        _zoneCtrl.text = d['zone'] as String? ?? '';
        _directionsCtrl.text = d['directions'] as String? ?? '';
        _noCtrl.text = (d['no']?.toString() ?? '');
        _difficultyCtrl.text = d['difficulty'] as String? ?? '';
        _latCtrl.text = (d['latitude'] is num)
            ? (d['latitude'] as num).toStringAsFixed(6)
            : (d['latitude']?.toString() ?? '');
        _lngCtrl.text = (d['longitude'] is num)
            ? (d['longitude'] as num).toStringAsFixed(6)
            : (d['longitude']?.toString() ?? '');
        // 대표 이미지 배열로 합치기
        _existingImageUrls = [];
        final arr = d['imageUrls'] as List?;
        if (arr != null) {
          // 만약 기존 DB에 단일 imageUrl 필드만 있는 경우도 병행 처리
          _existingImageUrls.addAll(arr.whereType<String>());
        }
        final single = d['imageUrl'] as String?;
        if (single != null && single.isNotEmpty && !_existingImageUrls.contains(single)) {
          _existingImageUrls.add(single);
        }
// 중복 및 공백 제거(사실상 위에서 이미 toSet 효과)
// (여기서 null이나 '' 등도 완전히 제거)
        _existingImageUrls = _existingImageUrls.where((e) => e != null && e.isNotEmpty).toSet().toList();
        _displayImages = List<dynamic>.from(_existingImageUrls);


      });

      // [추가] 산 기준으로 구역 후보 로딩 후 기존 구역을 선택/수동 상태로 반영
      try {
        final mountainForZone = (_selectedMountain == '직접 입력')
            ? _customMountainCtrl.text.trim()
            : _selectedMountain;
        if (mountainForZone.isNotEmpty) {
          await _loadZonesForMountain(mountainForZone);
          final z = _zoneCtrl.text.trim();
          if (z.isNotEmpty) {
            if (_zones.contains(z)) {
              if (mounted) {
                setState(() {
                  _manualZone = false;
                  _selectedZone = z;
                });
              }
            } else {
              if (mounted) {
                setState(() {
                  _manualZone = true;
                  _selectedZone = null;
                });
              }
            }
          }
        }
      } catch (_) {}


      final tracking = (d['trackingPath'] as List? ?? [])
          .map((pt) => Map<String, dynamic>.from(pt as Map))
          .toList();
      if (!mounted) return;
      setState(() {
        _trackingPath = tracking;
        _hasTracked = tracking.isNotEmpty;
      });
      if (_typeRoot == '리드') {
        final snap = await doc.reference.collection('pitches').get();
        final pitchDocs = snap.docs.toList();
        final List<_PitchEntry> loaded = [];
        for (var pd in pitchDocs) {
          final d2 = pd.data();
          var images = <dynamic>[]; // final → var로 변경
          final arr = d2['images'] as List?;
          final single = d2['imageUrl'] as String?;
          if (arr != null) images.addAll(arr.whereType<String>());
          if (single != null && single.isNotEmpty && images.isEmpty) images.add(single);

// 중복/공백 제거
          images = images.where((e) => e != null && e.isNotEmpty).toSet().toList();

          loaded.add(_PitchEntry(
            initialName: d2['name'] as String?,
            initialImages: images,
          )..lengthCtrl.text = d2['length'] as String? ?? ''
            ..diffCtrl.text = d2['difficulty'] as String? ?? ''
            ..styleCtrl.text = d2['style'] as String? ?? ''
            ..gearCtrl.text = d2['gear'] as String? ?? '');
        }
        if (!mounted) return;
        setState(() {
          for (final p in _pitches) {
            p.dispose();
          }
          _pitches
            ..clear()
            ..addAll(loaded);
        });
      }
      if (!mounted) return;
      setState(() => _loadingExisting = false);
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingExisting = false);
    }
  }

  Future<File?> _pickImage() async {
    final picker = ImagePicker();
    final src = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.camera_alt),
            title: const Text('카메라'),
            onTap: () => Navigator.pop(context, ImageSource.camera),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library),
            title: const Text('갤러리'),
            onTap: () => Navigator.pop(context, ImageSource.gallery),
          ),
        ],
      ),
    );
    if (src == null) return null;
    final picked = await picker.pickImage(source: src);
    return picked == null ? null : File(picked.path);
  }

  Future<List<File>> _pickImages({int maxImages = 8}) async {
    final picker = ImagePicker();
    final List<File> files = [];
    try {
      final images = await picker.pickMultiImage(imageQuality: 92);
      if (images != null) {
        for (var img in images.take(maxImages)) {
          files.add(File(img.path));
        }
      }
    } catch (_) {}
    return files;
  }

  Future<String?> _uploadImage(File file, String path) async {
    try {
      final ref = FirebaseStorage.instance.ref().child(path);
      await ref.putFile(file);
      final url = await ref.getDownloadURL();
      return url;
    } catch (_) {
      return null;
    }
  }

  Future<void> _pickLocationOnMap() async {
    final picked = await Navigator.of(context).push<LatLng>(
      MaterialPageRoute(
        builder: (_) => MapScreen(
          mountain: _selectedMountain == '직접 입력'
              ? _customMountainCtrl.text
              : _selectedMountain,
          picking: true,
        ),
      ),
    );
    if (picked != null) {
      _latCtrl.text = picked.latitude.toStringAsFixed(6);
      _lngCtrl.text = picked.longitude.toStringAsFixed(6);
      setState(() {});
    }
  }

  Future<void> _recordTracking() async {
    final res = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(builder: (_) => const TrackingScreen()),
    );
    if (res != null) {
      setState(() {
        _trackingPath = List<Map<String, dynamic>>.from(res['points'] as List);
        _gpxFilePath = res['gpxPath'] as String?;
        _hasTracked = _trackingPath.isNotEmpty;
        final last = _trackingPath.last;
        final lat = last['latitude'] as double?;
        final lng = last['longitude'] as double?;
        if (lat != null && lng != null) {
          _latCtrl.text = lat.toStringAsFixed(6);
          _lngCtrl.text = lng.toStringAsFixed(6);
        }
      });
    }
  }

  // 루트 대표이미지 여러장 첨부
  Future<void> _addRootImages() async {
    final imgs = await _pickImages(maxImages: 8 - _displayImages.length);
    if (imgs.isNotEmpty) {
      setState(() {
        // 중복 파일 방지: 파일 경로와 String URL 모두 체크
        final existing = _displayImages.map((img) => img is File ? img.path : img).toSet();
        for (final img in imgs) {
          if (!existing.contains(img.path)) {
            _displayImages.add(img);
            existing.add(img.path);
          }
        }
      });
    }
  }


  // 피치별 여러장 첨부
  Future<void> _pickPitchImages(int idx) async {
    final imgs = await _pickImages(maxImages: 4 - _pitches[idx].images.length);
    if (imgs.isNotEmpty) {
      setState(() {
        // 중복 파일 방지
        final existing = _pitches[idx].images.map((img) => img is File ? img.path : img).toSet();
        for (final img in imgs) {
          if (!existing.contains(img.path)) {
            _pitches[idx].images.add(img);
            existing.add(img.path);
          }
        }
      });
    }
  }


  Future<void> _addOrUpdateRoute() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('로그인이 필요합니다.')),
      );
      return;
    }
    if (_routeNameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('루트 이름을 입력하세요.')),
      );
      return;
    }
    final lat = double.tryParse(_latCtrl.text);
    final lng = double.tryParse(_lngCtrl.text);
    if (lat == null || lng == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('위도·경도를 확인하세요.')),
      );
      return;
    }
    setState(() => _saving = true);

    try {
      final mountainName = _selectedMountain == '직접 입력'
          ? _customMountainCtrl.text.trim()
          : _selectedMountain;
      // 드롭다운 선택 또는 직접입력한 구역을 취합
      final zoneCandidate = _manualZone
          ? _zoneCtrl.text.trim()
          : (_selectedZone ?? '').trim();

      if (zoneCandidate.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('구역을 선택하거나 입력해 주세요.')),
        );
        setState(() => _saving = false);
        return;
      }
      final zoneName = zoneCandidate;

      final routeName = _routeNameCtrl.text.trim().isEmpty
          ? '미지정'
          : _routeNameCtrl.text.trim();

      // 대표이미지 중복 없이 저장
      final List<String> imageUrls = [];
      final Set<String> addedUrls = {};
      for (var img in _displayImages) {
        if (img is File) {
          final url = await _uploadImage(
            img,
            'route_images/$mountainName/$zoneName/$routeName/${DateTime.now().millisecondsSinceEpoch}_${imageUrls.length}.jpg',
          );
          if (url != null && !addedUrls.contains(url)) {
            imageUrls.add(url);
            addedUrls.add(url);
          }
        } else if (img is String && img.isNotEmpty && !addedUrls.contains(img)) {
          imageUrls.add(img);
          addedUrls.add(img);
        }
      }

// Firestore에는 imageUrls만 저장 (기존꺼 합치지 않음!)

      String? gpxUrl;
      if (_gpxFilePath?.isNotEmpty == true) {
        final gpxFile = File(_gpxFilePath!);
        gpxUrl = await _uploadImage(
          gpxFile,
          'route_gpx/$mountainName/$routeName/approach.gpx',
        );
      }

      final data = <String, dynamic>{
        'typeRoot': _typeRoot,
        'mountain': mountainName,
        'routeName': routeName,
        'latitude': lat,
        'longitude': lng,
        'imageUrls': imageUrls,  // ✅ 대표 이미지 배열만 저장!
        if (gpxUrl != null) 'gpxUrl': gpxUrl,
        'status': widget.reportId == null ? 'pending' : FieldValue.delete(),
        'authorUid': user.uid,
        'timestamp': FieldValue.serverTimestamp(),
        'trackingPath': _trackingPath,
        'overview': _overviewCtrl.text.trim(),
        'type': _typeCtrl.text.trim(),
        'equipment': _equipmentCtrl.text.trim(),
        'avgDifficulty': _avgDiffCtrl.text.trim(),
        'pioneer': _pioneerCtrl.text.trim(),
        'description': _overviewCtrl.text.trim(),
        'zone': zoneName, // ✅ 리드/볼더링 공통으로 저장
        if (_typeRoot == '볼더링') 'directions': _directionsCtrl.text.trim(),
        if (_typeRoot == '볼더링') 'no': _noCtrl.text.trim(),
        if (_typeRoot == '볼더링') 'difficulty': _difficultyCtrl.text.trim(),
        if (_typeRoot == '리드') 'difficulty': _avgDiffCtrl.text.trim(),
      };

      final batch = FirebaseFirestore.instance.batch();
      final col = FirebaseFirestore.instance.collection(
        _typeRoot == '리드' ? 'route_reports' : 'bouldering_reports',
      );
      final ref = widget.reportId == null ? col.doc() : col.doc(widget.reportId);
      if (widget.reportId == null) {
        batch.set(ref, data);
      } else {
        final upd = Map<String, dynamic>.from(data)
          ..remove('status')
          ..remove('authorUid');
        batch.update(ref, upd);
      }
      if (_typeRoot == '리드') {
        final old = await ref.collection('pitches').get();
        for (var d in old.docs) {
          batch.delete(d.reference);
        }
        for (var i = 0; i < _pitches.length; i++) {
          final p = _pitches[i];
          // 피치 이미지 업로드 (중복 방지)
          final List<String> pitchImageUrls = [];
          final Set<String> pitchAddedUrls = {};

          for (var img in p.images) {
            if (img is File) {
              final url = await _uploadImage(
                img,
                'pitch_images/$mountainName/$routeName/pitch_${i + 1}_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(10000)}.jpg',
              );
              if (url != null && !pitchAddedUrls.contains(url)) {
                pitchImageUrls.add(url);
                pitchAddedUrls.add(url);
              }
            } else if (img is String && img.isNotEmpty && !pitchAddedUrls.contains(img)) {
              pitchImageUrls.add(img);
              pitchAddedUrls.add(img);
            }
          }

          batch.set(ref.collection('pitches').doc(), {
            'name': p.nameCtrl.text.trim(),
            'length': p.lengthCtrl.text.trim(),
            'difficulty': p.diffCtrl.text.trim(),
            'style': p.styleCtrl.text.trim(),
            'gear': p.gearCtrl.text.trim(),
            'images': pitchImageUrls,
            'authorUid': user.uid,
            'timestamp': FieldValue.serverTimestamp(),
          });
        }
      }
      await batch.commit();
      if (_editingDraftId != null) {
        await _deleteDraftById(_editingDraftId!);
        setState(() => _editingDraftId = null);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            widget.reportId == null ? '제보가 등록되었습니다.' : '수정이 완료되었습니다.',
          ),
        ),
      );

      if (widget.reportId == null) {
        // 새 제보 등록일 때만 홈(크루)로 이동
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const HomeScreen(initialIndex: 3)),
              (route) => false,
        );
      } else {
        // 수정일 때는 현재 화면만 닫고 true 반환
        Navigator.of(context).pop(true);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('저장 실패')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _saveNewDraft() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('로그인이 필요합니다.')));
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    final id = _editingDraftId ?? DateTime.now().millisecondsSinceEpoch.toString();
    final typeLabel = _typeRoot == '리드' ? '[리드] ' : '[볼더링] ';
    String routeTitle = _routeNameCtrl.text.trim();
    if (routeTitle.isEmpty) {
      final now = DateTime.now();
      routeTitle =
      '임시저장 @${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')} '
          '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    }
    final title = '$typeLabel$routeTitle';
    final imagesToSave = _displayImages.map((img) {
      if (img is File) return img.path;
      if (img is String) return img;
      return null;
    }).where((e) => e != null).toList();
    final draftData = {
      'typeRoot': _typeRoot,
      'selectedMountain': _selectedMountain,
      'customMountain': _customMountainCtrl.text,
      'routeName': _routeNameCtrl.text,
      'overview': _overviewCtrl.text,
      'type': _typeCtrl.text,
      'equipment': _equipmentCtrl.text,
      'avgDiff': _avgDiffCtrl.text,
      'pioneer': _pioneerCtrl.text,
      'latitude': _latCtrl.text,
      'longitude': _lngCtrl.text,
      'zone': _zoneCtrl.text,
      'directions': _directionsCtrl.text,
      'no': _noCtrl.text,
      'difficulty': _difficultyCtrl.text,
      'images': imagesToSave,
      'pitches': _pitches.map((p) => p.toJson()).toList(),
      'trackingPath': _trackingPath,
      'gpxPath': _gpxFilePath,
      'timestamp': DateTime.now().toIso8601String(),
    };
    await prefs.setString(
        '$_kDraftPrefix${user.uid}_$id', json.encode(draftData));
    final newMeta = _DraftMeta(id: id, title: title, savedAt: DateTime.now());
    final idx = _draftList.indexWhere((d) => d.id == id);
    setState(() {
      if (_editingDraftId != null && idx != -1) {
        _draftList[idx] = newMeta;
      } else {
        _draftList.insert(0, newMeta);
        _editingDraftId = id;
      }
    });
    await prefs.setString(
      '$_kDraftListKey ${user.uid}',
      json.encode(_draftList.map((e) => e.toJson()).toList()),
    );
    final userDrafts = FirebaseFirestore.instance
        .collection('user_drafts')
        .doc(user.uid)
        .collection('drafts')
        .doc(id);
    await userDrafts.set(draftData);
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('임시 저장이 완료되었습니다.')));
  }

  Future<void> _deleteDraftById(String id) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('로그인이 필요합니다.')));
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('$_kDraftPrefix${user.uid}_$id');
    await FirebaseFirestore.instance
        .collection('user_drafts')
        .doc(user.uid)
        .collection('drafts')
        .doc(id)
        .delete();
    setState(() => _draftList.removeWhere((m) => m.id == id));
    await prefs.setString('$_kDraftListKey ${user.uid}',
        json.encode(_draftList.map((e) => e.toJson()).toList()));
  }

  /// 클립보드에서 GPX 파일 경로 붙여넣기
  Future<void> _pasteGpx() async {
    final data = await Clipboard.getData('text/plain');
    final path = data?.text;
    if (path != null && path.isNotEmpty && File(path).existsSync()) {
      await _parseGpxAndLoad(path);
      setState(() => _gpxFilePath = path);
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('클립보드에서 GPX 경로를 붙여넣었습니다.'))
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('유효한 GPX 파일 경로가 아닙니다.'))
      );
    }
  }

  /// GPX 파일을 읽어서 _trackingPath에 담아줍니다.
  Future<void> _parseGpxAndLoad(String filePath) async {
    try {
      final xml = await File(filePath).readAsString();
      final gpx = GpxReader().fromString(xml);
      if (gpx.trks.isEmpty || gpx.trks.first.trksegs.isEmpty) throw Exception();
      final seg = gpx.trks.first.trksegs.first;
      final points = seg.trkpts.map((pt) =>
      <String, dynamic>{
        'latitude': pt.lat ?? 0.0,
        'longitude': pt.lon ?? 0.0,
        'altitude': pt.ele,
        'timestamp': pt.time?.millisecondsSinceEpoch,
      }).toList();
      setState(() {
        _trackingPath = points;
        _hasTracked = points.isNotEmpty;
      });
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('GPX 파싱에 실패했습니다.'))
      );
    }
  }

  /// GPX 파일 열기(다운로드)
  Future<void> _downloadGpx() async {
    if (_gpxFilePath != null) {
      await launchUrlString('file://${_gpxFilePath!}');
    }
  }

  /// GPX 경로를 클립보드에 복사
  Future<void> _copyGpxPath() async {
    if (_gpxFilePath != null) {
      await Clipboard.setData(ClipboardData(text: _gpxFilePath!));
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('GPX 경로를 클립보드에 복사했습니다.'))
      );
    }
  }

  /// GPX 파일 자체를 공유
  Future<void> _shareGpx() async {
    if (_gpxFilePath != null) {
      await Share.shareXFiles([XFile(_gpxFilePath!)],
          text: '어프로치 GPX 파일을 공유합니다.');
    }
  }

  Future<void> _restoreDraft(String id) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('$_kDraftPrefix${user.uid}_$id');
    if (raw == null) return;
    try {
      final jsonMap = json.decode(raw) as Map<String, dynamic>;
      setState(() {
        _typeRoot = jsonMap['typeRoot'] ?? '리드';
        _selectedMountain = jsonMap['selectedMountain'] ?? '직접 입력';
        _customMountainCtrl.text = jsonMap['customMountain'] ?? '';
        _routeNameCtrl.text = jsonMap['routeName'] ?? '';
        _overviewCtrl.text = jsonMap['overview'] ?? '';
        _typeCtrl.text = jsonMap['type'] ?? '';
        _equipmentCtrl.text = jsonMap['equipment'] ?? '';
        _avgDiffCtrl.text = jsonMap['avgDiff'] ?? '';
        _pioneerCtrl.text = jsonMap['pioneer'] ?? '';
        _latCtrl.text = jsonMap['latitude'] ?? '';
        _lngCtrl.text = jsonMap['longitude'] ?? '';
        _zoneCtrl.text = jsonMap['zone'] ?? '';
        _directionsCtrl.text = jsonMap['directions'] ?? '';
        _noCtrl.text = jsonMap['no'] ?? '';
        _difficultyCtrl.text = jsonMap['difficulty'] ?? '';
        _displayImages = (jsonMap['images'] as List?)
            ?.map((img) {
          if (img == null) return null;
          if (img is String && img.startsWith('/')) return File(img);
          return img;
        }).where((img) => img != null).toList() ?? [];
        // 피치 복원
        for (final p in _pitches) {
          p.dispose();
        }
        _pitches
          ..clear()
          ..addAll(
            (jsonMap['pitches'] as List?)?.map((e) => _PitchEntry.fromJson(e)).toList() ?? [],
          );
        _trackingPath = (jsonMap['trackingPath'] as List?)
            ?.map((pt) => Map<String, dynamic>.from(pt as Map)).toList() ?? [];
        _gpxFilePath = jsonMap['gpxPath'];
        _editingDraftId = id;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('임시저장을 불러왔습니다.')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('임시저장 복원에 실패했습니다.')),
      );
    }
  }



  Future<bool> _onWillPop() async => !_saving;

  @override
  Widget build(BuildContext context) {
    if (_loadingExisting) {
      return Scaffold(
        appBar: AppBar(title: const Text('루트 제보')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        appBar: AppBar(title: const Text('루트 제보')),
        body: Stack(
          children: [
            ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                // 타입 선택
                Row(
                  children: ['리드', '볼더링'].map((t) =>
                      Expanded(
                        child: RadioListTile<String>(
                          title: Text(t),
                          value: t,
                          groupValue: _typeRoot,
                          onChanged: (v) async {
                            setState(() {
                              _typeRoot = v!;
                              _selectedMountain = '직접 입력';
                              _customMountainCtrl.clear();

                              // 구역 상태 초기화
                              _zones = [];
                              _selectedZone = null;
                              _manualZone = false;
                              _zoneCtrl.clear();
                            });
                          },

                        ),
                      )).toList(),
                ),
                const SizedBox(height: 16),
                // 등반지 선택
                if (_loadingMountains)
                  const Center(child: CircularProgressIndicator())
                else
                  ...[
                    const Text('등반지 선택', style: TextStyle(color: Colors.purple)),
                    DropdownButtonFormField<String>(
                      value: _selectedMountain,
                      decoration: const InputDecoration(
                          border: UnderlineInputBorder()),
                      items: (_typeRoot == '리드'
                          ? _leadMountains
                          : _boulderMountains)
                          .map((m) =>
                          DropdownMenuItem(value: m, child: Text(m)))
                          .toList(),
                      onChanged: (v) async {
                        if (v == null) return;
                        setState(() {
                          _selectedMountain = v;

                          // 산 바뀌면 구역 상태 초기화
                          _zones = [];
                          _selectedZone = null;
                          _manualZone = false;
                          _zoneCtrl.clear();
                        });

                        // '직접 입력'이 아닌 실제 산을 선택했을 때만 구역 후보 로딩
                        final mountainText = (v == '직접 입력') ? _customMountainCtrl.text.trim() : v;
                        if (mountainText.isNotEmpty && mountainText != '직접 입력') {
                          await _loadZonesForMountain(mountainText);
                        }
                      },

                    ),
                    if (_selectedMountain == '직접 입력')
                      TextField(
                        controller: _customMountainCtrl,
                        decoration: const InputDecoration(labelText: '등반지 입력'),
                      ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                        icon: const Icon(Icons.public),
                        label: const Text('지도에서 좌표 선택'),
                        onPressed: _pickLocationOnMap,
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                // 루트 대표 이미지 - 여러장 첨부, 드래그, 삭제
                // ─────────────────────────────────────────────
                // [추가] 구역 선택
                const Text('구역 선택', style: TextStyle(color: Colors.purple)),

                DropdownButtonFormField<String>(
                  value: _manualZone ? '___manual___' : _selectedZone,
                  decoration: const InputDecoration(
                    border: UnderlineInputBorder(),
                    hintText: '구역을 선택하세요',
                  ),
                  items: [
                    ..._zones.map((z) => DropdownMenuItem(
                      value: z,
                      child: Text(z),
                    )),
                    const DropdownMenuItem(
                      value: '___manual___',
                      child: Text('직접 입력…'),
                    ),
                  ],
                  onChanged: (v) {
                    setState(() {
                      if (v == '___manual___') {
                        _manualZone = true;
                        _selectedZone = null;
                      } else {
                        _manualZone = false;
                        _selectedZone = v;
                        _zoneCtrl.text = v ?? ''; // 임시저장/호환용
                      }
                    });
                  },
                ),

                if (_manualZone) ...[
                  const SizedBox(height: 8),
                  TextField(
                    controller: _zoneCtrl,
                    decoration: const InputDecoration(labelText: '구역 직접 입력'),
                    onChanged: (_) {
                      // 수동 입력 시 드롭다운 값과 동기화는 하지 않고 저장 시점에 _zoneCtrl 사용
                    },
                    enabled: !_saving,
                  ),
                ],
                const SizedBox(height: 16),
                // ─────────────────────────────────────────────


                SizedBox(
                  height: 220,
                  child: Column(
                    children: [
                      Expanded(
                        child: ReorderableListView.builder(
                          scrollDirection: Axis.horizontal,
                          itemCount: _displayImages.length < 8
                              ? _displayImages.length + 1
                              : 8,
                          onReorder: (oldIndex, newIndex) {
                            final count = _displayImages.length;
                            if (oldIndex >= count || newIndex > count) return;
                            if (newIndex > oldIndex) newIndex--;
                            newIndex = newIndex.clamp(0, count - 1);
                            setState(() {
                              final img = _displayImages.removeAt(oldIndex);
                              _displayImages.insert(newIndex, img);
                            });
                          },
                          itemBuilder: (ctx, i) {
                            if (i < _displayImages.length) {
                              final img = _displayImages[i];
                              return Container(
                                key: ValueKey(img),
                                width: 200,
                                margin: const EdgeInsets.only(right: 12),
                                child: Stack(
                                  children: [
                                    ReorderableDragStartListener(
                                      index: i,
                                      child: GestureDetector(
                                        onTap: !_saving
                                            ? () async {
                                          final picked = await _pickImage();
                                          if (picked != null) {
                                            final edited = await Navigator.push<File?>(
                                              context,
                                              MaterialPageRoute(
                                                builder: (_) =>
                                                    ImageEditorScreen(imageFile: picked),
                                              ),
                                            );
                                            if (edited != null) {
                                              setState(() {
                                                _displayImages[i] = edited;
                                              });
                                            }
                                          }
                                        }
                                            : null,
                                        child: img is File
                                            ? WatermarkedImage(
                                          imageProvider: FileImage(img),
                                          width: double.infinity,
                                          height: 200,
                                          watermarkText: 'RouteFinding',
                                          fit: BoxFit.cover,
                                        )
                                            : img is String
                                            ? WatermarkedImage(
                                          imageProvider: NetworkImage(img),
                                          width: double.infinity,
                                          height: 200,
                                          watermarkText: 'RouteFinding',
                                          fit: BoxFit.cover,
                                        )
                                            : const SizedBox.shrink(),
                                      ),
                                    ),
                                    Positioned(
                                      top: 8,
                                      right: 8,
                                      child: IconButton(
                                        icon: const Icon(Icons.delete,
                                            color: Colors.redAccent),
                                        onPressed: !_saving
                                            ? () =>
                                            setState(() => _displayImages.removeAt(i))
                                            : null,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }
                            // + 버튼 (여러장 선택)
                            return Container(
                              key: const ValueKey('add_btn'),
                              width: 200,
                              child: Center(
                                child: IconButton(
                                  icon: const Icon(Icons.add_a_photo, size: 40),
                                  onPressed: !_saving &&
                                      _displayImages.length < 8
                                      ? _addRootImages
                                      : null,
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        '길게 눌러 좌우로 드래그하면 이미지 순서를 바꿀 수 있습니다',
                        style: TextStyle(fontSize: 12, color: Colors.purple),
                      ),
                    ],
                  ),
                ),

                // 트래킹 기록 및 GPX 버튼
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ElevatedButton.icon(
                      icon: const Icon(Icons.timeline),
                      label: Text(_hasTracked ? '기록 재실행' : '어프로치 기록'),
                      onPressed: _recordTracking,
                    ),
                    const SizedBox(height: 8),
                    if (_gpxFilePath != null) ...[
                      const Text('GPX 파일:',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 12,
                        children: [
                          ElevatedButton.icon(
                            icon: const Icon(Icons.paste),
                            label: const Text('붙여넣기'),
                            onPressed: _pasteGpx,
                          ),
                          ElevatedButton.icon(
                            icon: const Icon(Icons.file_download),
                            label: const Text('다운로드'),
                            onPressed: _downloadGpx,
                          ),
                          ElevatedButton.icon(
                            icon: const Icon(Icons.copy),
                            label: const Text('복사'),
                            onPressed: _copyGpxPath,
                          ),
                          ElevatedButton.icon(
                            icon: const Icon(Icons.share),
                            label: const Text('공유'),
                            onPressed: _shareGpx,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                    ],
                  ],
                ),

                // 미니맵
                if (_trackingPath.isNotEmpty) ...[
                  Container(
                    margin: const EdgeInsets.symmetric(vertical: 12),
                    height: 200,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.purple, width: 2),
                    ),
                    clipBehavior: Clip.hardEdge,
                    child: Builder(
                      builder: (_) {
                        final latLngPoints = _trackingPath
                            .map((p) =>
                            LatLng(
                              (p['latitude'] as num).toDouble(),
                              (p['longitude'] as num).toDouble(),
                            ))
                            .toList();
                        return GoogleMap(
                          initialCameraPosition: CameraPosition(
                            target: latLngPoints.first,
                            zoom: 15,
                          ),
                          polylines: {
                            Polyline(
                              polylineId: const PolylineId('approach'),
                              points: latLngPoints,
                              width: 5,
                            ),
                          },
                          markers: {
                            Marker(
                              markerId: const MarkerId('start'),
                              position: latLngPoints.first,
                              infoWindow: const InfoWindow(title: '출발'),
                            ),
                            if (latLngPoints.length > 1)
                              Marker(
                                markerId: const MarkerId('end'),
                                position: latLngPoints.last,
                                infoWindow: const InfoWindow(title: '도착'),
                              ),
                          },
                          zoomControlsEnabled: false,
                          myLocationButtonEnabled: false,
                          scrollGesturesEnabled: false,
                          rotateGesturesEnabled: false,
                          tiltGesturesEnabled: false,
                          zoomGesturesEnabled: false,
                        );
                      },
                    ),
                  ),
                ],

                const SizedBox(height: 16),

                // 루트 이름 및 기타 입력 폼
                TextField(
                  controller: _routeNameCtrl,
                  decoration: const InputDecoration(labelText: '루트 이름'),
                  enabled: !_saving,
                ),
                const SizedBox(height: 8),

                // 리드 / 볼더링 상세
                if (_typeRoot == '리드') ...[
                  TextField(
                    controller: _overviewCtrl,
                    decoration: const InputDecoration(labelText: '등반 개요'),
                    enabled: !_saving,
                    maxLines: 2,
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _typeCtrl,
                    decoration: const InputDecoration(labelText: '등반 형태'),
                    enabled: !_saving,
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _equipmentCtrl,
                    decoration: const InputDecoration(labelText: '등반 장비'),
                    enabled: !_saving,
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _avgDiffCtrl,
                    decoration: const InputDecoration(labelText: '평균 난이도'),
                    enabled: !_saving,
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _pioneerCtrl,
                    decoration: const InputDecoration(labelText: '[기타내용]'),
                    enabled: !_saving,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _latCtrl,
                    decoration: const InputDecoration(labelText: '위도'),
                    enabled: !_saving,
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _lngCtrl,
                    decoration: const InputDecoration(labelText: '경도'),
                    enabled: !_saving,
                  ),
                  const SizedBox(height: 16),

                  // 피치 목록 (리드)
                  for (var i = 0; i < _pitches.length; i++) ...[
                    Card(
                      margin: const EdgeInsets.symmetric(vertical: 8),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('피치 ${i + 1}', style: const TextStyle(
                                    fontWeight: FontWeight.bold)),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline),
                                  onPressed: !_saving
                                      ? () {
                                    setState(() {
                                      _pitches[i].dispose();
                                      _pitches.removeAt(i);
                                    });
                                  }
                                      : null,
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            // 피치 이미지들 - 여러장, 드래그, 삭제
                            SizedBox(
                              height: 120,
                              child: Column(
                                children: [
                                  Expanded(
                                    child: ReorderableListView.builder(
                                      scrollDirection: Axis.horizontal,
                                      itemCount: _pitches[i].images.length < 4
                                          ? _pitches[i].images.length + 1
                                          : 4,
                                      onReorder: (oldIdx, newIdx) {
                                        final count = _pitches[i].images.length;
                                        if (oldIdx >= count || newIdx > count) return;
                                        if (newIdx > oldIdx) newIdx--;
                                        newIdx = newIdx.clamp(0, count - 1);
                                        setState(() {
                                          final img = _pitches[i].images.removeAt(oldIdx);
                                          _pitches[i].images.insert(newIdx, img);
                                        });
                                      },
                                      itemBuilder: (c, j) {
                                        if (j < _pitches[i].images.length) {
                                          final img = _pitches[i].images[j];
                                          return Container(
                                            key: ValueKey(img),
                                            width: 100,
                                            margin: const EdgeInsets.only(right: 10),
                                            child: Stack(
                                              children: [
                                                ReorderableDragStartListener(
                                                  index: j,
                                                  child: GestureDetector(
                                                    onTap: !_saving
                                                        ? () async {
                                                      final picked = await _pickImage();
                                                      if (picked != null) {
                                                        final edited = await Navigator.push<File?>(
                                                          context,
                                                          MaterialPageRoute(
                                                            builder: (_) =>
                                                                ImageEditorScreen(imageFile: picked),
                                                          ),
                                                        );
                                                        if (edited != null) {
                                                          setState(() {
                                                            _pitches[i].images[j] = edited;
                                                          });
                                                        }
                                                      }
                                                    }
                                                        : null,
                                                    child: img is File
                                                        ? WatermarkedImage(
                                                      imageProvider: FileImage(img),
                                                      width: double.infinity,
                                                      height: 100,
                                                      watermarkText: 'RouteFinding',
                                                      fit: BoxFit.cover,
                                                    )
                                                        : img is String
                                                        ? WatermarkedImage(
                                                      imageProvider: NetworkImage(img),
                                                      width: double.infinity,
                                                      height: 100,
                                                      watermarkText: 'RouteFinding',
                                                      fit: BoxFit.cover,
                                                    )
                                                        : const SizedBox.shrink(),
                                                  ),
                                                ),
                                                Positioned(
                                                  top: 4,
                                                  right: 4,
                                                  child: IconButton(
                                                    icon: const Icon(Icons.delete, color: Colors.redAccent),
                                                    onPressed: !_saving
                                                        ? () => setState(() => _pitches[i].images.removeAt(j))
                                                        : null,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          );
                                        }
                                        // + 버튼 (피치 여러장 첨부)
                                        return Container(
                                          key: const ValueKey('add_pitch_img'),
                                          width: 100,
                                          child: Center(
                                            child: IconButton(
                                              icon: const Icon(Icons.add_a_photo, size: 28),
                                              onPressed: !_saving &&
                                                  _pitches[i].images.length < 4
                                                  ? () => _pickPitchImages(i)
                                                  : null,
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  const Text(
                                    '피치 이미지: 드래그로 순서 변경, 최대 4장',
                                    style: TextStyle(fontSize: 11, color: Colors.purple),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextField(controller: _pitches[i].nameCtrl,
                                decoration: const InputDecoration(
                                    labelText: '이름'),
                                enabled: !_saving),
                            TextField(controller: _pitches[i].lengthCtrl,
                                decoration: const InputDecoration(
                                    labelText: '길이'),
                                enabled: !_saving),
                            TextField(controller: _pitches[i].diffCtrl,
                                decoration: const InputDecoration(
                                    labelText: '난이도'),
                                enabled: !_saving),
                            TextField(controller: _pitches[i].styleCtrl,
                                decoration: const InputDecoration(
                                    labelText: '형태'),
                                enabled: !_saving),
                            TextField(controller: _pitches[i].gearCtrl,
                                decoration: const InputDecoration(
                                    labelText: '장비'),
                                enabled: !_saving),
                          ],
                        ),
                      ),
                    ),
                  ],
                  Align(
                    alignment: Alignment.centerRight,
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.add),
                      label: const Text('피치 추가'),
                      onPressed: !_saving
                          ? () {
                        setState(() {
                          _pitches.add(_PitchEntry());
                        });
                      }
                          : null,
                    ),
                  ),
                ] else
                  ...[
                    // 볼더링 상세
                    // 볼더링 상세 (구역은 위의 '구역 선택' 블록에서 처리합니다)
                    const SizedBox.shrink(),
                    const SizedBox(height: 8),

                    TextField(controller: _overviewCtrl,
                        decoration: const InputDecoration(labelText: '바위 소개'),
                        enabled: !_saving,
                        maxLines: 2),
                    const SizedBox(height: 8),
                    TextField(controller: _directionsCtrl,
                        decoration: const InputDecoration(labelText: '찾아가는 길'),
                        enabled: !_saving,
                        maxLines: 2),
                    const SizedBox(height: 8),
                    TextField(controller: _noCtrl,
                        decoration: const InputDecoration(labelText: '번호'),
                        enabled: !_saving),
                    const SizedBox(height: 8),
                    TextField(controller: _difficultyCtrl,
                        decoration: const InputDecoration(labelText: '난이도'),
                        enabled: !_saving),
                    const SizedBox(height: 16),
                    TextField(controller: _latCtrl,
                        decoration: const InputDecoration(labelText: '위도'),
                        readOnly: true,
                        enabled: !_saving),
                    const SizedBox(height: 8),
                    TextField(controller: _lngCtrl,
                        decoration: const InputDecoration(labelText: '경도'),
                        readOnly: true,
                        enabled: !_saving),
                    const SizedBox(height: 16),
                  ],

                // 임시 저장 / 불러오기 / 최종 저장 버튼
                ElevatedButton(onPressed: _saveNewDraft,
                    child: const Text('임시 저장'),
                    style: ElevatedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48))),
                const SizedBox(height: 8),
                ElevatedButton(
                  onPressed: (_draftList.isNotEmpty && !_saving) ? () async {
                    final selected = await showDialog<_DraftMeta>(
                      context: context,
                      builder: (_) => SimpleDialog(
                        title: const Text('임시 저장 목록'),
                        children: _draftList.map((d) => SimpleDialogOption(
                          onPressed: () => Navigator.pop(context, d),
                          child: Text('${d.title}\n${d.savedAt.toString().substring(0, 16)}', style: const TextStyle(fontSize: 13)),
                        )).toList(),
                      ),
                    );
                    if (selected != null) {
                      await _restoreDraft(selected.id);
                    }
                  } : null,
                  child: const Text('임시 저장 불러오기'),
                  style: ElevatedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48)),
                ),

                const SizedBox(height: 8),
                ElevatedButton(onPressed: _saving ? null : _addOrUpdateRoute,
                    child: Text(widget.reportId == null ? '루트 제보 저장' : '수정 완료'),
                    style: ElevatedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48))),
                const SizedBox(height: 16),
              ], // ListView.children 끝
            ), // ListView 끝

            // 2) 저장 중 오버레이
            if (_saving)
              Positioned.fill(
                child: Container(
                  color: Colors.black.withOpacity(0.4),
                  child: const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(
                                Colors.white)),
                        SizedBox(height: 12),
                        Text('저장 중... 이미지 업로드에 시간이 걸릴 수 있습니다.',
                            style: TextStyle(fontSize: 16, color: Colors
                                .white)),
                      ],
                    ),
                  ),
                ),
              ),
          ], // Stack.children 끝
        ), // Stack 끝
      ), // Scaffold 끝
    ); // WillPopScope 끝
  }
}
