import 'package:flutter/material.dart';

class BottomNavBar extends StatelessWidget {
  /// 현재 선택된 탭 (0: 게시판, 1: 개념도, 2: 지도, 3: 마이페이지)
  final int currentIndex;

  const BottomNavBar({super.key, this.currentIndex = 0});

  static const _routes = [
    '/board',   // 0: 게시판
    '/',        // 1: 개념도
    '/reports', // 2: 지도
    '/mypage',  // 3: 마이페이지
  ];

  void _navigate(BuildContext context, int index) {
    final target = _routes[index];
    // 현재 라우트와 동일하면 이동 안 함
    if (ModalRoute.of(context)?.settings.name != target) {
      Navigator.pushReplacementNamed(context, target);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BottomNavigationBar(
      currentIndex: currentIndex,
      type: BottomNavigationBarType.fixed,
      onTap: (i) => _navigate(context, i),
      items: const [
        BottomNavigationBarItem(
          icon: Icon(Icons.list),
          label: '게시판',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.map_outlined),
          label: '개념도',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.location_on),
          label: '지도',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.person),
          label: '마이페이지',
        ),
      ],
    );
  }
}
