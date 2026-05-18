// lib/splash_screen.dart

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:async';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  late final VideoPlayerController _controller;
  StreamSubscription<String>? _fcmTokenSub; // null safety 적용

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.asset('assets/videos/splash_video.mp4');
    _saveFcmTokenIfLoggedIn();
    _listenFcmTokenRefresh();
    _loadAndPlay();
  }

  void _listenFcmTokenRefresh() {
    _fcmTokenSub = FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null && newToken.isNotEmpty) {
        try {
          await FirebaseFirestore.instance
              .collection('users')
              .doc(user.uid)
              .set({'fcmToken': newToken}, SetOptions(merge: true));
          debugPrint('==FCM 토큰 갱신(자동저장): $newToken');
        } catch (e) {
          debugPrint('==FCM 토큰 Firestore 저장 실패: $e');
        }
      }
    });
  }

  Future<void> _saveFcmTokenIfLoggedIn() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      try {
        final token = await FirebaseMessaging.instance.getToken();
        if (token != null) {
          await FirebaseFirestore.instance
              .collection('users')
              .doc(user.uid)
              .set({'fcmToken': token}, SetOptions(merge: true));
          debugPrint('==FCM Firestore 저장 완료!');
        }
      } catch (e, stack) {
        debugPrint('==FCM 토큰 저장 실패: $e\n$stack');
      }
    }
  }

  Future<void> _loadAndPlay() async {
    await _controller.initialize();
    if (!mounted) return;
    setState(() {});
    _controller
      ..play()
      ..setLooping(false)
      ..addListener(_videoEndListener);
  }

  void _videoEndListener() {
    if (!mounted) return;
    final pos = _controller.value.position;
    final dur = _controller.value.duration;
    // 두 값 모두 0이 아닌 값만 체크
    if (dur.inMilliseconds > 0 && pos >= dur) {
      _controller.removeListener(_videoEndListener); // 중복 호출 방지
      _goNext();
    }
  }

  void _goNext() {
    if (!mounted) return;
    final user = FirebaseAuth.instance.currentUser;
    final target = user != null ? '/home' : '/login';
    // 중복 push 방지 (이미 라우트가 이동된 뒤 호출될 수도 있음)
    if (Navigator.canPop(context)) {
      Navigator.of(context).popUntil((r) => r.isFirst);
      Navigator.of(context).pushReplacementNamed(target);
    } else {
      Navigator.of(context).pushReplacementNamed(target);
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_videoEndListener);
    _controller.dispose();
    _fcmTokenSub?.cancel(); // null safety
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_controller.value.isInitialized) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      body: SizedBox.expand(
        child: FittedBox(
          fit: BoxFit.cover,
          child: SizedBox(
            width: _controller.value.size.width,
            height: _controller.value.size.height,
            child: VideoPlayer(_controller),
          ),
        ),
      ),
    );
  }
}
