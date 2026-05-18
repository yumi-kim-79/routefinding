import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
// import 'package:flutter_windowmanager/flutter_windowmanager.dart';

import 'board_screen.dart';
import 'concept_list_screen.dart';
import 'map_screen.dart';
import 'mypage_screen.dart';
import 'crew_main_screen.dart';
import 'constants/level.dart'; // 등급/출석 관련 함수
import 'utils/update_checker.dart'; // [추가] 업데이트 확인 함수

/// 홈 화면 (앱의 메인 탭 구조)
class HomeScreen extends StatefulWidget {
  final int initialIndex; // 외부에서 진입 시 탭 인덱스

  const HomeScreen({Key? key, this.initialIndex = 0}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late int _currentIndex;         // 현재 하단탭 인덱스
  String _mountain = '북한산';    // 기본 산 이름 (최초)
  BannerAd? _bannerAd;            // AdMob 배너 인스턴스
  bool _isAdLoaded = false;       // 배너 광고 로드 상태

  final List<int> _tabHistory = []; // [여기!] 탭 히스토리

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;

    // 진입 시 한번만 실행되는 후처리들
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // [1] 앱 업데이트 체크
      await checkForUpdate(context);

      // [2] 출석 보상
      final isAttendance = await checkAndGiveAttendancePoint();
      if (isAttendance && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('🎉 출석 보상 3포인트 지급!'),
            duration: Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    });

    // 화면보안 (캡처방지) 필요시 활성화
    //_secureScreen();

    // 산 이름 복원
    _restoreMountainName();

    // 광고 초기화
    _initGoogleMobileAds();
  }

  /// (캡처방지: 필요 시 활성화)
  Future<void> _secureScreen() async {
    try {
      // await FlutterWindowManager.addFlags(FlutterWindowManager.FLAG_SECURE);
    } catch (e) {
      debugPrint('HomeScreen: FLAG_SECURE 적용 실패: $e');
    }
  }

  /// 최근 산 이름 복원
  Future<void> _restoreMountainName() async {
    final prefs = await SharedPreferences.getInstance();
    final savedMountain = prefs.getString('lastMountain');
    if (savedMountain != null && mounted) {
      setState(() => _mountain = savedMountain);
    }
  }

  /// 광고 초기화
  void _initGoogleMobileAds() {
    MobileAds.instance.initialize().then((_) => _loadBannerAd());
  }

  void _loadBannerAd() {
    _bannerAd = BannerAd(
      adUnitId: 'ca-app-pub-4653853586463291/2185792519',
      size: AdSize.banner,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (_) => setState(() => _isAdLoaded = true),
        onAdFailedToLoad: (ad, err) {
          debugPrint('BannerAd 실패: ${err.message}');
          ad.dispose();
          setState(() => _isAdLoaded = false);
        },
      ),
    )..load();
  }

  /// 탭 선택 시
  Future<void> _onTabTapped(int index) async {
    if (_currentIndex != index) {
      _tabHistory.add(_currentIndex); // [여기!] 이전 탭 저장
      setState(() => _currentIndex = index);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt('lastTabIndex', index);
    }
  }

  /// 뒤로가기 (WillPopScope)
  Future<bool> _onWillPop() async {
    if (_tabHistory.isNotEmpty) {
      setState(() {
        _currentIndex = _tabHistory.removeLast();
      });
      return false; // 앱 종료 안 함
    }
    return false; // 마지막 탭에서도 앱 종료 안 함
  }

  @override
  void dispose() {
    _bannerAd?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 주요 5개 탭 화면 (항상 유지)
    final pages = [
      const BoardScreen(),                  // 게시판
      const ConceptListScreen(),            // 개념도
      MapScreen(mountain: _mountain),       // 루트 위치 지도
      const CrewMainScreen(),               // 크루
      const MyPageScreen(),                 // 마이페이지
    ];

    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        body: Column(
          children: [
            Expanded(child: pages[_currentIndex]),
            if (_isAdLoaded && _bannerAd != null)
              Container(
                width: _bannerAd!.size.width.toDouble(),
                height: _bannerAd!.size.height.toDouble(),
                alignment: Alignment.center,
                child: AdWidget(ad: _bannerAd!),
              ),
          ],
        ),
        bottomNavigationBar: BottomNavigationBar(
          type: BottomNavigationBarType.fixed,
          currentIndex: _currentIndex,
          onTap: _onTabTapped,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.list), label: '게시판'),
            BottomNavigationBarItem(icon: Icon(Icons.map), label: '개념도'),
            BottomNavigationBarItem(icon: Icon(Icons.public), label: '루트 위치'),
            BottomNavigationBarItem(icon: Icon(Icons.groups), label: '크루'),
            BottomNavigationBarItem(icon: Icon(Icons.person), label: '마이페이지'),
          ],
        ),
      ),
    );
  }
}
