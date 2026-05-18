import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_app_check/firebase_app_check.dart';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'constants/level.dart';
import 'firebase_options.dart';
import 'splash_screen.dart';
import 'login_screen.dart';
import 'sign_up_screen.dart';
import 'bottom_nav_bar.dart';
import 'home_screen.dart';
import 'notice_board_screen.dart';
import 'route_report_list_screen.dart';
import 'route_report_admin_screen.dart';
import 'mypage_screen.dart';
import 'auth_service.dart';
import 'user_profile_screen.dart';
import 'constants/firestore_fields.dart';

// 알림 플러그인
final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
FlutterLocalNotificationsPlugin();

// FCM 백그라운드 메시지 핸들러
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
}

// FCM 토큰 Firestore에 저장
Future<void> saveFcmTokenToFirestore() async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return;
  final token = await FirebaseMessaging.instance.getToken();
  if (token == null) return;
  await FirebaseFirestore.instance
      .collection('users')
      .doc(user.uid)
      .set({'fcmToken': token}, SetOptions(merge: true));
}

// 앱 진입점
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // ✅ App Check 활성화
  await FirebaseAppCheck.instance.activate(
    androidProvider:
    kDebugMode ? AndroidProvider.debug : AndroidProvider.playIntegrity,
  );

  // 로컬 알림 초기화
  const initializationSettingsAndroid =
  AndroidInitializationSettings('@mipmap/ic_launcher');
  const initializationSettings =
  InitializationSettings(android: initializationSettingsAndroid);
  await flutterLocalNotificationsPlugin.initialize(initializationSettings);

  // FCM 권한 및 백그라운드 핸들러 등록
  await FirebaseMessaging.instance.requestPermission();
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  runApp(const MyApp());
}

// 메인앱: MaterialApp 즉시 build → 화면 분기만 빠르게(_RootScreen)
class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RouteFinding',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const _RootScreen(),
      routes: {
        '/login': (_) => const LoginScreen(),
        '/signup': (_) => const SignUpScreen(),
        '/home': (_) => const HomeScreen(),
        '/board': (_) => const NoticeBoardScreen(),
        '/mypage': (_) => const MyPageScreen(),
        '/reports': (_) => const RouteReportListScreen(),
        '/admin': (_) => const RouteReportAdminScreen(),
      },
    );
  }
}

// 진입분기: 스플래시/로그인/홈 화면만 빠르게 선택
class _RootScreen extends StatefulWidget {
  const _RootScreen({Key? key}) : super(key: key);

  @override
  State<_RootScreen> createState() => _RootScreenState();
}

class _RootScreenState extends State<_RootScreen> {
  Widget? _screen;

  @override
  void initState() {
    super.initState();
    _initScreen();
    _setupFcmAndUserState();
  }

  // 초기 화면 분기 (스플래시/로그인/홈)
  Future<void> _initScreen() async {
    final prefs = await SharedPreferences.getInstance();
    final packageInfo = await PackageInfo.fromPlatform();
    final savedVersion = prefs.getString('lastAppVersion') ?? '';
    final hasSeenSplash = prefs.getBool('hasSeenSplash') ?? false;
    final currentVersion = packageInfo.version;

    if (!hasSeenSplash || savedVersion != currentVersion) {
      await prefs.setString('lastAppVersion', currentVersion);
      await prefs.setBool('hasSeenSplash', true);
      setState(() => _screen = const SplashScreen());
      return;
    }

    final user = FirebaseAuth.instance.currentUser;
    setState(() => _screen = user != null ? const HomeScreen() : const LoginScreen());
  }

  // FCM/등급/알림 등은 로그인 이후만 처리(앱 전체 부하↓)
  void _setupFcmAndUserState() {
    FirebaseMessaging.instance
        .subscribeToTopic('all')
        .then((_) => print('Subscribed to topic ALL'))
        .catchError((e) => print('Error subscribing to ALL topic: $e'));

    FirebaseMessaging.onMessage.listen(showFlutterNotification);

    FirebaseMessaging.onMessageOpenedApp
        .listen((message) => print('알림 클릭됨: ${message.data}'));

    FirebaseAuth.instance.authStateChanges().listen((user) async {
      if (user != null) {
        await saveFcmTokenToFirestore();
        await updateMyLevelIfNeeded();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_screen == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return _screen!;
  }
}

// 푸시 → 로컬 알림 표시
void showFlutterNotification(RemoteMessage message) {
  final notification = message.notification;
  final android = message.notification?.android;
  if (notification != null && android != null) {
    flutterLocalNotificationsPlugin.show(
      notification.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'fcm_default_channel',
          'FCM 알림',
          importance: Importance.max,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
      ),
    );
  }
}
