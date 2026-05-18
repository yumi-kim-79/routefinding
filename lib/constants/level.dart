// lib/constants/level.dart

import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

/// ===============================
///     관리자·등급 관련 상수/유틸
/// ===============================
/// 24시간마다 첫 출석 포인트 지급 함수
Future<bool> checkAndGiveAttendancePoint() async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return false;

  final prefs = await SharedPreferences.getInstance();
  final lastAttendanceKey = 'lastAttendance_${user.uid}';
  final lastAttendance = prefs.getInt(lastAttendanceKey) ?? 0;
  final now = DateTime.now().millisecondsSinceEpoch;

  if (now - lastAttendance >= 86400000) {
    await updateUserPointAndLevel(addPoint: 3);
    await prefs.setInt(lastAttendanceKey, now);
    // Firestore 출석 기록 필요시 아래 주석 해제
    // await FirebaseFirestore.instance.collection('attendance').add({
    //   'userId': user.uid,
    //   'timestamp': FieldValue.serverTimestamp(),
    // });
    return true; // 오늘 출석 성공!
  }
  return false; // 이미 오늘 출석 처리됨
}
// ─ 관리자/부관리자/테스터 이메일 리스트
const adminEmails = [
  'yusung790926@gmail.com',
  'routefinding2025@gmail.com',
];

const subAdminEmails = [
  'yusung0926@naver.com',
];

const testerEmails = [
  'vsdfsdf2@gmail.com',
  'kkn8359@gmail.com',
  'dbsgoal7543@naver.com',
  'ham115@naver.com',
  'hhhh4440@nate.com',
  'aidije@gmail.com',
  'showkmh860104@gmail.com',
  'hdwkiu123@gmail.com',
  '5771312@naver.com',
  'fs5750@naver.com',
  'waterfog1177@gmail.com',
  'motorking7@naver.com',
  'a01071168238@gmail.com',
  'kml5419@gmail.com',
  'aaakym@hanmail.net',
  'hurjinhee0305@gmail.com',
  'testuser@example.com',
  'yuseok8052@gmail.com',
  'aaakym@naver.com',
  'daehanhome@naver.com',
  'sjm094@naver.com',
  'hjeeha@gmail.com',
  'recon848@gmail.com',
];

/// 등급(레벨) 기준표 (최소점수)
const Map<String, int> levelPointMap = {
  "5.6": 0,
  "5.7": 100,
  "5.8": 200,
  "5.9": 400,
  "5.10": 800,
  "5.11": 1600,
  "5.12": 3200,
  "5.13": 6400,
  // 5.14 부관리자, 5.15 관리자
};

/// 등급(레벨) 계산 함수
/// - 관리자/부관리자/테스터는 등급 우선 처리
/// - 그 외 유저는 누적 포인트 기준으로 결정
String calcLevel(String email, int point) {
  if (adminEmails.contains(email)) return "5.15";
  if (subAdminEmails.contains(email)) return "5.14";
  if (testerEmails.contains(email)) {
    if (point >= 6400) return "5.13";
    return "5.12";
  }
  if (point >= 6400) return "5.13";
  if (point >= 3200) return "5.12";
  if (point >= 1600) return "5.11";
  if (point >= 800)  return "5.10";
  if (point >= 400)  return "5.9";
  if (point >= 200)  return "5.8";
  if (point >= 100)  return "5.7";
  return "5.6";
}

/// (내 계정용) 등급 필드 자동 동기화 함수
Future<void> updateMyLevelIfNeeded() async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return;
  final email = user.email ?? '';
  final userDoc = FirebaseFirestore.instance.collection('users').doc(user.uid);

  final doc = await userDoc.get();
  double point = 0;
  final p = doc.data()?['point'];
  if (p is int) {
    point = p.toDouble();
  } else if (p is double) {
    point = p;
  }

  final String correctLevel = calcLevel(email, point.toInt());

  // 등급 필드가 다르면 업데이트
  if ((doc.data()?['level'] ?? '5.6') != correctLevel) {
    await userDoc.update({'level': correctLevel});
  }
}

/// 공통 유틸: 포인트 적립 및 등급 자동 반영
/// - addPoint : 더해줄 점수(소수 가능)
/// - userId   : 대상 유저 uid(생략시 내 계정)
Future<void> updateUserPointAndLevel({
  required double addPoint,
  String? userId,
}) async {
  try {
    // 대상 계정(없으면 내 계정)
    final user = FirebaseAuth.instance.currentUser;
    final targetUid = userId ?? user?.uid;
    if (targetUid == null) return;

    final userDoc = FirebaseFirestore.instance.collection('users').doc(targetUid);
    final doc = await userDoc.get();

    double point = 0;
    final p = doc.data()?['point'];
    if (p is int) {
      point = p.toDouble();
    } else if (p is double) {
      point = p;
    }

    final newPoint = point + addPoint;

    // 이메일: 내 계정은 user, 타인은 doc에 저장된 email
    String email = '';
    if (userId == null) {
      email = user?.email ?? '';
    } else {
      email = doc.data()?['email'] ?? '';
    }

    // 파이어스토어 업데이트(포인트/레벨 동시)
    await userDoc.update({
      'point': newPoint,
      'level': calcLevel(email, newPoint.toInt()),
    });
  } catch (e) {
    print('포인트/레벨 반영 오류: $e');
  }
}

// ───────────────────────────────
// [★] 등급표 및 "다음 등급까지" 안내용 유틸
// ───────────────────────────────

/// 다음 등급의 레벨을 반환 (ex. "5.8"→"5.9", 최고등급이면 null)
String? getNextLevel(String level) {
  final keys = levelPointMap.keys.toList();
  final idx = keys.indexOf(level);
  if (idx < 0 || idx == keys.length - 1) return null;
  return keys[idx + 1];
}

/// 다음 등급까지 남은 점수 계산 (null이면 최고 등급)
int? getRemainToNextLevel(String level, int point) {
  final next = getNextLevel(level);
  if (next == null) return null;
  final nextMinPoint = levelPointMap[next]!;
  final remain = nextMinPoint - point;
  return remain > 0 ? remain : 0;
}

// ───────────────────────────────
// 사용 예시 (어디서든 호출 가능)
// ─ 게시글 작성  : await updateUserPointAndLevel(addPoint: 1);
// ─ 댓글/대댓글 : await updateUserPointAndLevel(addPoint: 0.5);
// ─ 루트 승인   : await updateUserPointAndLevel(addPoint: 10, userId: '해당유저uid');
// ─ 첫 출석     : await updateUserPointAndLevel(addPoint: 3);
// ─ 다음 등급까지 남은 점수 표시 :
//   getRemainToNextLevel('5.10', 850);  // 결과: 750
// ───────────────────────────────
