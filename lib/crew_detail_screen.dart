// lib/crew_detail_screen.dart

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';

import '../common/profile_with_crown.dart';
import 'crew_join_form_screen.dart';
import 'crew_board_tab.dart';
import 'crew_post_detail_screen.dart';
import 'crew_post_write_screen.dart';
import 'dart:async';

class CrewDetailScreen extends StatefulWidget {
  final String crewId;
  final bool showAllTabs;

  const CrewDetailScreen({required this.crewId, this.showAllTabs = true, Key? key}) : super(key: key);

  @override
  State<CrewDetailScreen> createState() => _CrewDetailScreenState();
}

class _CrewDetailScreenState extends State<CrewDetailScreen>
    with SingleTickerProviderStateMixin {
  final User _currentUser = FirebaseAuth.instance.currentUser!;
  // ① crew 문서 참조를 필드로 뺌
  late final DocumentReference<Map<String, dynamic>> crewRef;
  late TabController _tabController;
  DateTime _chatLastRead = DateTime.now();
  int _unreadChatCount = 0;
  late StreamSubscription<QuerySnapshot> _chatSub;

  Map<String, dynamic>? crewData;
  List<Map<String, dynamic>> members = [];
  List<Map<String, dynamic>> joinRequests = [];
  String? myUid;
  String myStatus = '';
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    // crewRef 초기화
    crewRef = FirebaseFirestore.instance
        .collection('crews')
        .doc(widget.crewId);

    // TabController 세팅 (탭 갯수는 3으로 고정)
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      if (_tabController.index == 2) {
        // 채팅 탭 열면 읽음 처리
        setState(() {
          _chatLastRead = DateTime.now();
          _unreadChatCount = 0;
        });
      }
    });

    // 채팅 메시지 스트림 구독 → 언리드 카운트 집계
    _chatSub = crewRef
        .collection('chatMessages')
        .orderBy('createdAt')
        .snapshots()
        .listen((snap) {
      final cnt = snap.docs.where((d) {
        final ts = (d.data()['createdAt'] as Timestamp?);
        return ts != null && ts.toDate().isAfter(_chatLastRead);
      }).length;
      if (cnt != _unreadChatCount) {
        setState(() => _unreadChatCount = cnt);
      }
    });

    _fetchCrewData();
  }

  @override
  void dispose() {
    _chatSub.cancel();
    _tabController.dispose();
    super.dispose();
  }


  Future<void> _fetchCrewData() async {
    setState(() => isLoading = true);
    final user = FirebaseAuth.instance.currentUser;
    myUid = user?.uid;
    if (myUid == null) { setState(() => isLoading = false); return; }

    final doc = await FirebaseFirestore.instance.collection('crews').doc(widget.crewId).get();
    final crew = doc.data();
    if (crew == null) { setState(() => isLoading = false); return; }

    // 멤버 목록
    final memSnap = await doc.reference.collection('members').get();
    members = memSnap.docs.map((d) => d.data()).toList();

    // 내 상태
    if (crew['leaderUid'] == myUid) {
      myStatus = 'leader';
    } else if (members.any((m) => m['uid'] == myUid)) {
      myStatus = 'member';
    } else {
      final req = await doc.reference.collection('joinRequests').doc(myUid).get();
      myStatus = (req.exists && req.data()?['status']=='pending') ? 'pending' : 'none';
    }

    // 리더라면 pending 요청도
    if (myStatus=='leader') {
      final reqSnap = await doc.reference.collection('joinRequests').get();
      joinRequests = reqSnap.docs.where((d) => d.data()['status']=='pending').map((d) => d.data()).toList();
    } else {
      joinRequests = [];
    }

    setState(() { crewData = crew; isLoading = false; });
  }

  /// 크루원 탈퇴 (리더 강제/사유 전달 + 알림)
  Future<void> _removeMember(String memberUid, String nickname) async {
    final reasonCtrl = TextEditingController();
    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('강제 탈퇴 사유 입력'),
        content: TextField(
          controller: reasonCtrl,
          decoration: const InputDecoration(hintText: '탈퇴 사유를 입력하세요'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('취소')),
          TextButton(
            onPressed: () async {
              final reason = reasonCtrl.text.trim();
              Navigator.pop(context);

              final ref = FirebaseFirestore.instance.collection('crews').doc(widget.crewId);
              // 1) 멤버 컬렉션에서 삭제
              await ref.collection('members').doc(memberUid).delete();
              await ref.update({'memberCount': FieldValue.increment(-1)});
              // 2) 알림 보내기
              await FirebaseFirestore.instance.collection('notifications').add({
                'receiverId': memberUid,
                'type': 'crew_member_removed',
                'crewId': widget.crewId,
                'message': '리더가 $nickname 님을 탈퇴시켰습니다. 사유: $reason',
                'timestamp': FieldValue.serverTimestamp(),
                'checked': false,
              });
              // 3) 화면 갱신
              await _fetchCrewData();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('$nickname 님이 강제 탈퇴되었습니다.')),
                );
              }
            },
            child: const Text('강제 탈퇴', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  /// 크루원 자발적 탈퇴 (확인 다이얼로그)
  Future<void> _leaveCrew() async {
    // 디버그용
    print('[LOG] _leaveCrew 호출됨');

    // 1) 확인 다이얼로그
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('크루 탈퇴'),
        content: const Text('정말로 크루를 탈퇴하시겠습니까?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(true),
            child: const Text('탈퇴', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    // 취소 또는 dialogCtx 오류 시 빠져나감
    if (ok != true || myUid == null) {
      print('[LOG] 탈퇴 취소 또는 myUid 없음 (myStatus=$myStatus)');
      return;
    }

    try {
      // 2) 멤버컬렉션에서 삭제 & memberCount 감소
      final crewDoc = FirebaseFirestore.instance.collection('crews').doc(widget.crewId);
// (A) joinRequests 문서도 삭제
      await crewDoc.collection('joinRequests').doc(myUid).delete();
// (B) 실제 멤버 탈퇴
      await crewDoc.collection('members').doc(myUid).delete();
      await crewDoc.update({'memberCount': FieldValue.increment(-1)});


      // 3) 리더에게 알림 보내기
      await FirebaseFirestore.instance
          .collection('notifications')
          .add({
        'receiverId': crewData!['leaderUid'] as String,
        'type': 'crew_member_left',
        'crewId': widget.crewId,
        'message':
        '${FirebaseAuth.instance.currentUser?.displayName ?? '익명'} 님이 크루를 탈퇴했습니다.',
        'timestamp': FieldValue.serverTimestamp(),
        'checked': false,
      });

      // 4) 화면 즉시 갱신
      await _fetchCrewData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('크루에서 탈퇴했습니다.')),
        );
      }
    } catch (e) {
      print('[ERROR] _leaveCrew 실패: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('탈퇴 중 오류 발생: $e')),
        );
      }
    }
  }

  /// 가입신청
  /// 1:1 가입 신청 문서 생성
  Future<void> _applyJoin() async {
    final crewDoc = FirebaseFirestore.instance
        .collection('crews')
        .doc(widget.crewId);
    final reqRef = crewDoc.collection('joinRequests').doc(_currentUser.uid);

    // 이미 남아있는 신청 기록이 있으면 삭제 (rejected → pending 재신청 처리용)
    final existing = await reqRef.get();
    if (existing.exists) {
      await reqRef.delete();
    }

    // 새로 만들기
    await reqRef.set({
      'uid':          _currentUser.uid,
      'nickname':     _currentUser.displayName ?? _currentUser.email,
      'status':       'pending',
      'requestedAt':  FieldValue.serverTimestamp(),
    });

    // 리더에게 알림 보내기
    final crewData = (await crewDoc.get()).data()!;
    final leaderUid = crewData['leaderUid'] as String;
    await FirebaseFirestore.instance.collection('notifications').add({
      'receiverId': leaderUid,
      'type':       'crew_join_request',
      'crewId':     widget.crewId,
      'message':    '${_currentUser.displayName ?? '익명'} 님이 가입을 요청했습니다.',
      'timestamp':  FieldValue.serverTimestamp(),
      'checked':    false,
    });

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('가입 신청을 보냈습니다.'))
    );
    await _fetchCrewData();  // 화면 갱신
  }


  /// 가입신청 취소
  Future<void> _cancelJoin() async {
    if (myUid == null) return;
    await crewRef
        .collection('joinRequests')
        .doc(myUid)
        .delete();
    await _fetchCrewData();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('가입 신청이 취소되었습니다.')),
    );
  }

  /// 리더 - 가입 승인
  Future<void> _approve(String reqUid, String nickname) async {
    // 1) 멤버 추가 & 요청 상태 변경
    await crewRef.collection('members').doc(reqUid).set({
      'uid': reqUid,
      'nickname': nickname,
      'role': 'normal',
      'joinedAt': FieldValue.serverTimestamp(),
    });
    await crewRef.collection('joinRequests').doc(reqUid).update({
      'status': 'approved',
    });
    await crewRef.update({
      'memberCount': FieldValue.increment(1),
    });

    // 2) 신청자에게 알림
    await FirebaseFirestore.instance
        .collection('notifications')
        .add({
      'receiverId': reqUid,
      'type': 'crew_join_approved',
      'crewId': widget.crewId,
      'message': '축하합니다, $nickname 님의 가입 요청이 승인되었습니다!',
      'timestamp': FieldValue.serverTimestamp(),
      'checked': false,
    });

    // 3) 갱신/피드백
    await _fetchCrewData();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$nickname 님이 가입되었습니다!')),
    );
  }

  /// 리더 - 가입 거부 (사유 입력 + 알림 전송)
  Future<void> _reject(String reqUid, String nickname, String reason) async {
    // 1) 요청 상태 및 사유 업데이트
    await crewRef.collection('joinRequests').doc(reqUid).update({
      'status': 'rejected',
      'rejectionReason': reason,
    });

    // 2) 신청자에게 거부 알림
    await FirebaseFirestore.instance
        .collection('notifications')
        .add({
      'receiverId': reqUid,
      'type': 'crew_join_rejected',
      'crewId': widget.crewId,
      'message': '$nickname 님의 가입 요청이 거부되었습니다. 사유: $reason',
      'timestamp': FieldValue.serverTimestamp(),
      'checked': false,
    });

    // 3) 화면 갱신
    await _fetchCrewData();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$nickname 님의 가입 요청이 거부되었습니다.')),
    );
  }

  /// 크루 정보 수정 다이얼로그 (리더 전용)
  Future<void> _editCrewDialog() async {
    final nameCtrl = TextEditingController(text: crewData?['name'] ?? '');
    final introCtrl = TextEditingController(text: crewData?['intro'] ?? '');
    XFile? newImage;
    bool isUploading = false;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSt) => AlertDialog(
          title: const Text('크루 정보 수정'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                GestureDetector(
                  onTap: () async {
                    final picked = await ImagePicker().pickImage(source: ImageSource.gallery);
                    if (picked != null) setSt(() => newImage = picked);
                  },
                  child: newImage != null
                      ? ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.file(File(newImage!.path), width: 100, height: 100, fit: BoxFit.cover),
                  )
                      : (crewData!['imageUrl'] != null && (crewData!['imageUrl'] as String).isNotEmpty)
                      ? ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(crewData!['imageUrl'], width: 100, height: 100, fit: BoxFit.cover),
                  )
                      : Container(
                    width: 100,
                    height: 100,
                    color: Colors.grey[300],
                    child: const Icon(Icons.add_a_photo),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: '크루 이름')),
                const SizedBox(height: 10),
                TextField(
                  controller: introCtrl,
                  minLines: 2,
                  maxLines: 5,
                  decoration: const InputDecoration(labelText: '소개글'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
            ElevatedButton(
              onPressed: isUploading
                  ? null
                  : () async {
                setSt(() => isUploading = true);
                String? imgUrl = crewData?['imageUrl'];
                if (newImage != null) {
                  final ref = FirebaseStorage.instance
                      .ref('crew_images/${widget.crewId}/cover.jpg');
                  await ref.putFile(File(newImage!.path));
                  imgUrl = await ref.getDownloadURL();
                }
                await crewRef.update({
                  'name': nameCtrl.text.trim(),
                  'intro': introCtrl.text.trim(),
                  'imageUrl': imgUrl,
                });
                setSt(() => isUploading = false);
                Navigator.pop(ctx);
                await _fetchCrewData();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('수정되었습니다!')),
                  );
                }
              },
              child: const Text('저장'),
            ),
          ],
        ),
      ),
    );
  }
  /// 가입 요청 거부
  Future<void> _rejectJoin(String applicantUid, String reason) async {
    final crewDoc = FirebaseFirestore.instance
        .collection('crews')
        .doc(widget.crewId);
    final reqRef = crewDoc.collection('joinRequests').doc(applicantUid);

    // 1) 상태 업데이트
    await reqRef.update({
      'status':         'rejected',
      'rejectedReason': reason,
      'rejectedAt':     FieldValue.serverTimestamp(),
    });

    // 2) 신청자에게 알림
    await FirebaseFirestore.instance.collection('notifications').add({
      'receiverId': applicantUid,
      'type':       'crew_join_rejected',
      'crewId':     widget.crewId,
      'message':    reason,
      'timestamp':  FieldValue.serverTimestamp(),
      'checked':    false,
    });

    // 3) UI 갱신
    if (!mounted) return;
    await _fetchCrewData();
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('가입 요청을 거부했습니다.'))
    );
  }


  /// 크루 삭제 (리더 전용)
  Future<void> _deleteCrew() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('크루 삭제'),
        content: const Text('정말로 이 크루를 삭제하시겠습니까? 모든 정보가 사라집니다.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx, false), child: const Text('취소')),
          ElevatedButton(onPressed: () => Navigator.pop(dialogCtx, true), child: const Text('삭제')),
        ],
      ),
    );
    if (ok == true) {
      await crewRef.delete();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('크루가 삭제되었습니다.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('크루 홈'),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            const Tab(text: '크루 소개'),
            const Tab(text: '크루 게시판'),
            // ───────────────────────────────────────────
            // 변경된 채팅 탭: Row로 텍스트+배지 처리
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('크루 채팅'),
                  if (_unreadChatCount > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                      child: Text(
                        '$_unreadChatCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          height: 1, // 텍스트가 위아래로 잘리지 않게
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            // ───────────────────────────────────────────
          ],
        ),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
        controller: _tabController,  // 여기도 추가
        children: [
          _buildIntroTab(),
          CrewBoardTab(
            crewId: widget.crewId,
            isMember: myStatus == 'leader' || myStatus == 'member',
          ),
          CrewChatTab(
            crewId: widget.crewId,
            crewName: crewData?['name'] ?? '',
          ),
        ],
      ),
    );
  }

  /// 소개/멤버/가입 관리 탭
  Widget _buildIntroTab() {
    if (crewData == null) return const Center(child: Text('크루 정보 없음'));
    final isLeader = myStatus == 'leader';

    return RefreshIndicator(
      onRefresh: _fetchCrewData,
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          // 1) 리더만 [수정][삭제]
          if (isLeader)
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton.icon(
                  onPressed: _editCrewDialog,
                  icon: const Icon(Icons.edit, size: 18),
                  label: const Text('수정'),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: _deleteCrew,
                  icon: const Icon(Icons.delete, size: 18, color: Colors.red),
                  label: const Text('삭제', style: TextStyle(color: Colors.red)),
                ),
              ],
            ),

          // 2) 커버 이미지
          if (crewData!['imageUrl'] != null && (crewData!['imageUrl'] as String).isNotEmpty)
            Center(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image.network(
                  crewData!['imageUrl'],
                  width: 130,
                  height: 130,
                  fit: BoxFit.cover,
                ),
              ),
            ),
          if (crewData!['imageUrl'] != null && (crewData!['imageUrl'] as String).isNotEmpty)
            const SizedBox(height: 20),

          // 3) 이름·소개
          Text(
            '크루 이름: ${crewData!['name']}',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            '소개: ${crewData!['intro']}',
            style: const TextStyle(fontSize: 16),
          ),
          const SizedBox(height: 16),

          // 4) 리더 프로필 동기화
          FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
            future: FirebaseFirestore.instance
                .collection('users')
                .doc(crewData!['leaderUid'] as String)
                .get(),
            builder: (ctx, snap) {
              if (!snap.hasData || !snap.data!.exists) {
                return Row(
                  children: [
                    const CircleAvatar(radius: 24, child: Icon(Icons.person)),
                    const SizedBox(width: 12),
                    Text(
                      '리더: ${crewData!['leaderNickname']}',
                      style: const TextStyle(fontSize: 16),
                    ),
                  ],
                );
              }
              final user = snap.data!.data()!;
              final photoUrl = user['photoUrl'] as String?;
              final leaderNick = user['nickname'] as String? ?? crewData!['leaderNickname'];
              final level = user['level'] as String?;

              return Row(
                children: [
                  ProfileWithCrown(
                    photoUrl: photoUrl,
                    nickname: leaderNick,
                    level: level,
                    radius: 24,
                    crownSize: 14,
                    displayType: 'profile',
                    showNickname: false,
                  ),
                  const SizedBox(width: 12),
                  Text('리더: $leaderNick', style: const TextStyle(fontSize: 16)),
                ],
              );
            },
          ),

          const SizedBox(height: 22),

          // 5) 크루원 목록
          Text('크루원 (${members.length}명)', style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: members.map((m) {
              final uid  = m['uid'] as String;
              final nick = m['nickname'] as String? ?? '';
              final role = m['role'] as String? ?? '';
              final isLeaderMember = role == 'leader';

              // ◀ 리더인 경우: 강제 탈퇴 아이콘 추가
              if (isLeader && !isLeaderMember) {
                return Chip(
                  label: Text(nick),
                  deleteIcon: const Icon(Icons.remove_circle, color: Colors.red),
                  onDeleted: () => _removeMember(uid, nick),
                );
              }
              // ◀ 자신(리더)이면 단순 표시
              if (isLeaderMember) {
                return Chip(label: Text('$nick(리더)'));
              }
              // ◀ 일반 크루원이면 그냥 표시
              return Chip(label: Text(nick));
            }).toList(),
          ),

          const SizedBox(height: 28),

          // 6) 일반 크루원은 '크루 탈퇴하기' 버튼
          if (myStatus == 'member')
            Center(
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                onPressed: _leaveCrew,
                child: const Text('크루 탈퇴하기'),
              ),
            ),


          const SizedBox(height: 16),

          // 7) 가입 신청/취소 버튼 (리더 제외)
          if (!isLeader)
            Center(child: _buildJoinActionButton()),

          const SizedBox(height: 16),

          // 8) 리더의 가입 요청 관리
          if (isLeader && joinRequests.isNotEmpty)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Divider(height: 32),
                const Text('가입 요청 관리', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                // ... (기존 joinRequests 리스트 UI) ...
              ],
            ),

          for (var req in joinRequests)
              _buildRequestCard(req),
          ],
       ),

    );
  }

  /// 각 가입 요청 카드
  Widget _buildRequestCard(Map<String, dynamic> req) {
    final reqUid = req['uid'] as String;
    final nickname = req['nickname'] as String? ?? '(익명)';
    final aboutMe = req['aboutMe'] as String? ?? '';

    return Card(
      child: ListTile(
        leading: const Icon(Icons.person),
        title: Text(nickname),
        subtitle: const Text('가입 요청'),
        onTap: () {
          final reasonCtrl = TextEditingController();
          showDialog(
            context: context,
            builder: (_) => AlertDialog(
              title: const Text('가입신청서'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('닉네임: $nickname'),
                    const SizedBox(height: 8),
                    const Text('가입 인사'),
                    const SizedBox(height: 6),
                    Text(aboutMe),
                    const SizedBox(height: 16),
                    TextField(
                      controller: reasonCtrl,
                      decoration: const InputDecoration(
                        labelText: '거부 사유',
                        hintText: '거부 사유를 입력하세요',
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('취소')),
                TextButton(
                  onPressed: () {
                    final reason = reasonCtrl.text.trim();
                    Navigator.pop(context);
                    _reject(reqUid, nickname, reason);
                  },
                  child: const Text('거부', style: TextStyle(color: Colors.red)),
                ),
              ],
            ),
          );
        },
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.check, color: Colors.green),
              tooltip: '승인',
              onPressed: () => _approve(reqUid, nickname),
            ),
            IconButton(
              icon: const Icon(Icons.close, color: Colors.red),
              tooltip: '거부',
              onPressed: () {
                final reasonCtrl = TextEditingController();
                showDialog(
                  context: context,
                  builder: (_) => AlertDialog(
                    title: const Text('거부 사유 입력'),
                    content: TextField(
                      controller: reasonCtrl,
                      decoration: const InputDecoration(hintText: '거부 사유를 입력하세요'),
                    ),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(context), child: const Text('취소')),
                      TextButton(
                        onPressed: () {
                          final reason = reasonCtrl.text.trim();
                          Navigator.pop(context);
                          _reject(reqUid, nickname, reason);
                        },
                        child: const Text('거부', style: TextStyle(color: Colors.red)),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  /// 내 상태에 따른 버튼
  Widget _buildJoinActionButton() {
    switch (myStatus) {
      case 'none':
        return ElevatedButton(
          onPressed: () async {
            final result = await Navigator.push<bool>(
              context,
              MaterialPageRoute(
                builder: (_) => CrewJoinFormScreen(crewId: widget.crewId),
              ),
            );
            if (result == true) {
              await _fetchCrewData();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('가입 신청이 완료되었습니다!')),
                );
              }
            }
          },
          child: const Text('크루 가입 신청'),
        );
      case 'pending':
        return OutlinedButton(
          onPressed: _cancelJoin,
          child: const Text('가입신청 취소'),
        );
      case 'member':
        return Chip(
          label: const Text('가입완료'),
          backgroundColor: Colors.green.shade100,
        );
      default:
        return const SizedBox.shrink();
    }
  }
}

// ──────────────
// 크루 채팅 탭
// ──────────────
class CrewChatTab extends StatefulWidget {
  final String crewId;
  final String crewName;
  const CrewChatTab({
    required this.crewId,
    required this.crewName,
    Key? key,
  }) : super(key: key);

  @override
  State<CrewChatTab> createState() => _CrewChatTabState();
}

class _CrewChatTabState extends State<CrewChatTab> {
  final TextEditingController _ctrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  String? myUid, myNickname;

  @override
  void initState() {
    super.initState();
    final user = FirebaseAuth.instance.currentUser;
    myUid = user?.uid;
    myNickname = user?.displayName ?? user?.email ?? '익명';
  }

  Future<void> _send() async {
    final txt = _ctrl.text.trim();
    if (txt.isEmpty) return;

    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final userDoc = await FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .get();

    final nickname = userDoc.data()?['nickname'] ?? '익명';
    final photoUrl = userDoc.data()?['photoUrl'] ?? '';
    final level = userDoc.data()?['level']?.toString() ?? '';

    _ctrl.clear();
    await FirebaseFirestore.instance
        .collection('crews').doc(widget.crewId)
        .collection('chatMessages')
        .add({
      'text': txt,
      'senderUid': user.uid,
      'nickname': nickname,
      'photoUrl': photoUrl,
      'level': level,
      'createdAt': FieldValue.serverTimestamp(),
    });

    Future.delayed(const Duration(milliseconds: 300), () {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.jumpTo(_scrollCtrl.position.maxScrollExtent);
      }
    });
  }


  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: 8),
        Text('${widget.crewName} 채팅방', style: const TextStyle(fontWeight: FontWeight.bold)),
        const Divider(),
        Expanded(
          child: StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance
                .collection('crews').doc(widget.crewId)
                .collection('chatMessages')
                .orderBy('createdAt')
                .snapshots(),
            builder: (ctx, snap) {
              if (!snap.hasData) return const Center(child: CircularProgressIndicator());
              final docs = snap.data!.docs;
              return ListView.builder(
                controller: _scrollCtrl,
                itemCount: docs.length,
                  itemBuilder: (_, idx) {
                    final d = docs[idx].data() as Map<String, dynamic>;
                    final mine = d['senderUid'] == myUid;
                    final senderName = d['nickname'] ?? '익명';
                    final level = d['level'] != null ? 'Lv.${d['level']}' : '';
                    final photoUrl = d['photoUrl'] ?? '';
                    final message = d['text'] ?? '';
                    final time = d['createdAt'] != null
                        ? (d['createdAt'] as Timestamp).toDate().toString().substring(0, 16)
                        : '';

                    return Align(
                      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                        padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 13),
                        decoration: BoxDecoration(
                          color: mine ? Colors.blue[100] : Colors.grey[200],
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (!mine && photoUrl.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(right: 6),
                                    child: CircleAvatar(
                                      radius: 12,
                                      backgroundImage: NetworkImage(photoUrl),
                                      backgroundColor: Colors.grey[300],
                                    ),
                                  ),
                                Text(
                                  senderName,
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                ),
                                if (level.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(left: 4),
                                    child: Text(
                                      level,
                                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                                    ),
                                  ),
                                if (mine && photoUrl.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(left: 6),
                                    child: CircleAvatar(
                                      radius: 12,
                                      backgroundImage: NetworkImage(photoUrl),
                                      backgroundColor: Colors.grey[300],
                                    ),
                                  ),
                              ],
                            ),


                            const SizedBox(height: 4),
                            Text(message, style: const TextStyle(fontSize: 15)),
                            if (time.isNotEmpty)
                              Text(
                                time,
                                style: const TextStyle(fontSize: 10, color: Colors.grey),
                              ),
                          ],
                        ),
                      ),
                    );
                  }
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(left: 8, right: 8, bottom: 8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _ctrl,
                  decoration: const InputDecoration(hintText: '메시지 입력...'),
                  onSubmitted: (_) => _send(),
                ),
              ),
              IconButton(icon: const Icon(Icons.send), onPressed: _send),
            ],
          ),
        ),
      ],
    );
  }
}
