import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'package:routefinding/widgets/full_image_screen.dart';
import 'package:routefinding/widgets/watermarked_image.dart';

import 'post_detail_screen.dart';
import 'comment_detail_screen.dart';
import 'generic_route_detail_screen.dart';
import 'widgets/my_profile_tab.dart';
import 'screens/notification_list_screen.dart';

// ★ 프로필+왕관 위젯
import '../common/profile_with_crown.dart';

// ★ 포인트/레벨 자동 함수 import

class MyPageScreen extends StatefulWidget {
  const MyPageScreen({Key? key}) : super(key: key);

  @override
  State<MyPageScreen> createState() => _MyPageScreenState();
}

class _MyPageScreenState extends State<MyPageScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final User? currentUser = FirebaseAuth.instance.currentUser;
  static const String _adminEmail = 'yusung790926@gmail.com';
  String _myRouteSearchText = '';

  bool _updating = false;
  bool _needsBatchUpdate = false;
  String _updateResult = '';

  bool get _isAdmin => currentUser != null && currentUser!.email == _adminEmail;



  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<bool> _onWillPop() async {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return false;
    }
    return false;
  }

  Widget _buildNotificationIcon() {
    final uid = currentUser!.uid;
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('notifications')
          .where('receiverId', isEqualTo: uid)
          .where('checked', isEqualTo: false)
          .snapshots(),
      builder: (context, snap) {
        final count = (snap.hasData ? snap.data!.docs.length : 0);
        return IconButton(
          icon: Stack(
            clipBehavior: Clip.none,
            children: [
              const Icon(Icons.notifications),
              if (count > 0)
                Positioned(
                  top: -2,
                  right: -2,
                  child: Container(
                    padding: const EdgeInsets.all(1),
                    decoration: const BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      '$count',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          tooltip: '읽지 않은 알림',
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const NotificationListScreen(),
              ),
            );
          },
        );
      },
    );
  }


  List<Widget> _buildReportActionButtons(String docId, String status, String authorUid, String mountain) {
    // 예시: 본인 글만 삭제 가능, admin이면 승인/반려 버튼 등 추가
    List<Widget> buttons = [];
    final isMyPost = (currentUser?.uid == authorUid);
    final isAdmin = _isAdmin;

    // 삭제 버튼 (본인 or 관리자)
    if (isMyPost || isAdmin) {
      buttons.add(
        IconButton(
          icon: Icon(Icons.delete, color: Colors.red[300]),
          tooltip: '삭제',
          onPressed: () async {
            final confirm = await showDialog<bool>(
              context: context,
              builder: (context) => AlertDialog(
                title: const Text('제보 삭제'),
                content: const Text('정말 삭제하시겠습니까?'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context, false),
                    child: const Text('취소'),
                  ),
                  TextButton(
                    onPressed: () => Navigator.pop(context, true),
                    child: const Text('삭제'),
                  ),
                ],
              ),
            );
            if (confirm == true) {
              // route_reports / bouldering_reports 분기
              // mountain, routeName, docSnap.reference, data 등에서 판별
              final isBouldering = (mountain.contains('볼더') || mountain.toLowerCase().contains('boulder'))
                  || (status == 'bouldering'); // 확실한 키값 있으면 교체
              final coll = isBouldering ? 'bouldering_reports' : 'route_reports';
              await FirebaseFirestore.instance.collection(coll).doc(docId).delete();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('제보가 삭제되었습니다.')),
              );
            }
          },
        ),
      );
    }

    // 예시: 관리자용 승인/반려 버튼 (원하는 대로 추가)
    if (isAdmin && status == 'pending') {
      buttons.addAll([
        IconButton(
          icon: const Icon(Icons.check, color: Colors.green),
          tooltip: '승인',
          onPressed: () async {
            await FirebaseFirestore.instance.collection('route_reports').doc(docId)
                .update({'status': 'approved'});
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('승인 처리되었습니다.')),
            );
          },
        ),
        IconButton(
          icon: const Icon(Icons.clear, color: Colors.orange),
          tooltip: '반려',
          onPressed: () async {
            String? reason = await showDialog<String>(
              context: context,
              builder: (context) {
                TextEditingController _controller = TextEditingController();
                return AlertDialog(
                  title: const Text('반려 사유 입력'),
                  content: TextField(
                    controller: _controller,
                    decoration: const InputDecoration(
                      hintText: '반려 사유를 입력하세요',
                    ),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context, null),
                      child: const Text('취소'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(context, _controller.text),
                      child: const Text('반려'),
                    ),
                  ],
                );
              },
            );
            if (reason != null && reason.trim().isNotEmpty) {
              await FirebaseFirestore.instance.collection('route_reports').doc(docId)
                  .update({'status': 'rejected', 'rejectionReason': reason});
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('반려 처리되었습니다.')),
              );
            }
          },
        ),
      ]);
    }

    return buttons;
  }


  Future<void> _updateAllPostsAndCommentsProfile() async {
    setState(() {
      _updating = true;
      _updateResult = '';
    });
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception('로그인 필요');

      final userSnap = await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .get();
      final profile = userSnap.data();
      if (profile == null) throw Exception('유저 정보 없음');

      final nickname = profile['nickname'] as String? ?? '';
      final photoUrl = profile['photoUrl'] as String? ?? '';
      final level = profile['level'] as String? ?? '';

      final postsSnap = await FirebaseFirestore.instance
          .collection('posts')
          .where('userId', isEqualTo: user.uid)
          .get();

      WriteBatch batch = FirebaseFirestore.instance.batch();
      for (final doc in postsSnap.docs) {
        batch.update(doc.reference, {
          'nickname': nickname,
          'photoUrl': photoUrl,
          'level': level,
        });
      }

      final postIds = postsSnap.docs.map((d) => d.id).toList();
      int commentCount = 0;
      for (final postId in postIds) {
        final commentsSnap = await FirebaseFirestore.instance
            .collection('posts')
            .doc(postId)
            .collection('comments')
            .where('userId', isEqualTo: user.uid)
            .get();
        for (final c in commentsSnap.docs) {
          batch.update(c.reference, {
            'nickname': nickname,
            'photoUrl': photoUrl,
            'level': level,
          });
          commentCount++;
        }
      }

      await batch.commit();
      setState(() {
        _updateResult = '게시글 ${postsSnap.size}개, 댓글 $commentCount개 갱신 완료!';
        _needsBatchUpdate = false; // ← 갱신 후 다시 비활성화
      });
    } catch (e) {
      setState(() {
        _updateResult = '오류: $e';
      });
    } finally {
      setState(() => _updating = false);
    }
  }

  /// 프로필 수정 이벤트 콜백
  void _onProfileChanged() {
    setState(() {
      _needsBatchUpdate = true;
      _updateResult = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    if (currentUser == null) {
      return WillPopScope(
        onWillPop: _onWillPop,
        child: Scaffold(
          appBar: AppBar(title: const Text('마이페이지')),
          body: const Center(child: Text('로그인이 필요합니다.')),
        ),
      );
    }

    final uid = currentUser!.uid;
    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('마이페이지'),
          bottom: TabBar(
            controller: _tabController,
            isScrollable: true,
            tabs: const [
              Tab(text: '내 제보 관리'),
              Tab(text: '내글'),
              Tab(text: '내댓글'),
              Tab(text: 'MY ROUTE'),
              Tab(text: '마이프로필'),
            ],
          ),
          actions: [
            _buildNotificationIcon(),
            IconButton(
              icon: const Icon(Icons.logout),
              tooltip: '로그아웃',
              onPressed: () async {
                await FirebaseAuth.instance.signOut();
                Navigator.of(context).popUntil((r) => r.isFirst);
                Navigator.of(context).pushReplacementNamed('/login');
              },
            ),
          ],
        ),
        body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance.collection('users').doc(uid).snapshots(),
          builder: (context, snapshot) {
            if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
            final user = snapshot.data!.data() ?? {};
            final nickname = user['nickname'] ?? '';
            final photoUrl = user['photoUrl'];
            final level    = user['level']    ?? '5.6';
            final point    = user['point']    ?? 0;

            return Column(
              children: [
                // ── 프로필 카드 + 갱신 버튼
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    children: [
                      ListTile(
                        leading: ProfileWithCrown(
                          photoUrl: photoUrl,
                          nickname: nickname,
                          level: level,
                          radius: 26,
                          crownSize: 24,
                          displayType: 'profile',
                          showNickname: false,
                        ),
                        title: Text(
                          nickname,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text(
                          '등급: $level   포인트: $point',
                          style: const TextStyle(fontSize: 14),
                        ),
                      ),
                      Center(
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.update),
                          label: const Text('내 게시글/댓글 프로필 일괄 갱신'),
                          onPressed: (!_needsBatchUpdate || _updating)
                              ? null
                              : _updateAllPostsAndCommentsProfile,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.deepPurple,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            minimumSize: const Size(200, 44), // 양 끝 여백 축소·가운데 정렬
                          ),
                        ),
                      ),

                      if (_updating)
                        const Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Center(child: CircularProgressIndicator()),
                        ),
                      if (_updateResult.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            _updateResult,
                            style: TextStyle(
                              color: _updateResult.startsWith('오류') ? Colors.red : Colors.green,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const Divider(height: 0),
                // ── 탭뷰
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildMyReportsTab(user),
                      _buildMyPostsTab(user),
                      _buildMyCommentsTab(user),
                      _buildMyRouteTab(),
                      // MyProfileTab 에서 프로필 수정시 _onProfileChanged 콜백 실행
                      MyProfileTab(onProfileChanged: _onProfileChanged),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  // =================== [1. 내 제보 관리 탭] ===================
  Widget _buildMyReportsTab(Map<String, dynamic> currentUserProfile) {
    final uid = currentUser!.uid;

    // ── 두 컬렉션 병합 스트림 (쿼리에서는 authorUid 만 필터링)
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('route_reports')
          .where('authorUid', isEqualTo: uid)
          .snapshots(),
      builder: (context, routeSnap) {
        if (routeSnap.hasError) return Center(child: Text('에러 발생: ${routeSnap.error}'));
        if (!routeSnap.hasData) return const Center(child: CircularProgressIndicator());

        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance
              .collection('bouldering_reports')
              .where('authorUid', isEqualTo: uid)
              .snapshots(),
          builder: (context, boulderSnap) {
            if (boulderSnap.hasError) return Center(child: Text('에러 발생: ${boulderSnap.error}'));
            if (!boulderSnap.hasData) return const Center(child: CircularProgressIndicator());

            // 두 컬렉션을 합친 뒤, client‑side 에서 approved 상태는 제외
            final combined = [
              ...routeSnap.data!.docs,
              ...boulderSnap.data!.docs,
            ];
            final docsList = combined
                .where((doc) {
              final status = doc.data()['status'] as String? ?? '';
              return status != 'approved';    // approved 문서는 제외
            })
                .toList()
              ..sort((a, b) {
                final aTs = (a.data()['timestamp'] as Timestamp?)?.toDate() ?? DateTime(0);
                final bTs = (b.data()['timestamp'] as Timestamp?)?.toDate() ?? DateTime(0);
                return bTs.compareTo(aTs);
              });

            if (docsList.isEmpty) {
              return Center(
                child: Text(_isAdmin
                    ? '승인 요청 중이거나 반려된 제보가 없습니다.'
                    : '아직 제보한 제보가 없습니다.'),
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: docsList.length,
              itemBuilder: (context, index) {
                final docSnap = docsList[index];
                final data = docSnap.data();

                // ── 첫 장 미리보기 이미지
                final imageUrls = data['imageUrls'] as List<dynamic>?;
                final imageUrl = (imageUrls != null && imageUrls.isNotEmpty)
                    ? imageUrls.first as String
                    : null;

                final status          = data['status']          as String? ?? 'draft';
                final routeName       = data['routeName']       as String? ?? '이름 없음';
                final mountain        = data['mountain']        as String? ?? '등반지 없음';
                final timestamp       = (data['timestamp']      as Timestamp?)?.toDate();
                final rejectionReason = data['rejectionReason'] as String? ?? '';
                final authorUid       = data['authorUid']       as String? ?? '';

                // 내 글이면 프로필 바로 사용
                String nickname = '(알 수 없는 사용자)';
                String? photoUrl;
                String? level;
                if (authorUid == uid) {
                  nickname = currentUserProfile['nickname'] ?? nickname;
                  photoUrl = currentUserProfile['photoUrl'];
                  level    = currentUserProfile['level']    ?? '';
                }

                return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
                  future: (authorUid != uid)
                      ? FirebaseFirestore.instance.collection('users').doc(authorUid).get()
                      : null,
                  builder: (ctx2, userSnap) {
                    if (authorUid != uid && userSnap.hasData && userSnap.data?.exists == true) {
                      final u = userSnap.data!.data()!;
                      nickname = u['nickname'] as String? ?? nickname;
                      photoUrl = u['photoUrl'] as String?;
                      level    = u['level']    as String?;
                    }
                    return _buildReportCard(
                      mountain:        mountain,
                      routeName:       routeName,
                      imageUrl:        imageUrl,
                      timestamp:       timestamp,
                      status:          status,
                      rejectionReason: rejectionReason,
                      nickname:        nickname,
                      photoUrl:        photoUrl,
                      level:           level,
                      docId:           docSnap.id,
                      authorUid:       authorUid,
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }


  // ─ 루트 제보 카드 (프로필/닉네임 ProfileWithCrown 적용)
  Widget _buildReportCard({
    required String mountain,
    required String routeName,
    required String? imageUrl,
    required DateTime? timestamp,
    required String status,
    required String rejectionReason,
    required String nickname,
    required String? photoUrl,
    required String? level,
    required String docId,
    required String authorUid,
  }) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => GenericRouteDetailScreen(
              routeRef: FirebaseFirestore.instance.collection('route_reports').doc(docId),
              title: '$mountain · $routeName',
            ),
          ),
        );
      },
      child: Card(
        margin: const EdgeInsets.symmetric(vertical: 6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 2,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (imageUrl != null && imageUrl.isNotEmpty)
                    GestureDetector(
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => FullImageScreen(
                            imageUrl: imageUrl,
                            watermarkText: 'routefinding',
                          ),
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: WatermarkedImage(
                          imageProvider: NetworkImage(imageUrl),
                          watermarkText: 'routefinding',
                          width: 80,
                          height: 80,
                        ),
                      ),
                    )
                  else
                    Container(
                      width: 80,
                      height: 80,
                      color: Colors.grey.shade200,
                      child: const Icon(Icons.photo, size: 40),
                    ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '$mountain · $routeName',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            ProfileWithCrown(
                              photoUrl: photoUrl,
                              nickname: nickname,
                              level: level,
                              radius: 10,
                              crownSize: 14,
                              displayType: 'comment',
                              showNickname: true,
                              textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w400, overflow: TextOverflow.ellipsis),
                            ),
                            // 프로필+닉네임+레벨 한 줄 오버플로우 처리됨
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                timestamp != null ? _formatDate(timestamp) : '',
                                style: const TextStyle(fontSize: 12, color: Colors.black54),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '상태: ${_statusToKorean(status)}',
                          style: TextStyle(
                            fontSize: 14,
                            color: _statusColor(status),
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (status == 'rejected' && rejectionReason.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              '반려 사유: $rejectionReason',
                              style: const TextStyle(fontSize: 13, color: Colors.orange),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: _buildReportActionButtons(docId, status, authorUid, mountain),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // =================== [2. 내글 탭] ===================
  Widget _buildMyPostsTab(Map<String, dynamic> currentUserProfile) {
    final uid = currentUser!.uid;
    final query = FirebaseFirestore.instance
        .collection('posts')
        .where('userId', isEqualTo: uid);

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: query.snapshots(),
      builder: (context, snapshot) {
        if (snapshot.hasError) return Center(child: Text('에러 발생: ${snapshot.error}'));
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());

        final docsList = snapshot.data!.docs.toList()
          ..sort((a, b) {
            final aTs = (a.data()['timestamp'] as Timestamp?)?.toDate() ?? DateTime(0);
            final bTs = (b.data()['timestamp'] as Timestamp?)?.toDate() ?? DateTime(0);
            return bTs.compareTo(aTs);
          });

        if (docsList.isEmpty) return const Center(child: Text('아직 작성한 글이 없습니다.'));

        final nickname = currentUserProfile['nickname'] ?? '(닉네임 없음)';
        final photoUrl = currentUserProfile['photoUrl'];
        final level = currentUserProfile['level'] ?? '';

        return ListView.builder(
          padding: const EdgeInsets.all(8),
          itemCount: docsList.length,
          itemBuilder: (context, index) {
            final docSnap = docsList[index];
            final data = docSnap.data();
            final title = data['title'] as String? ?? '(제목 없음)';
            final content = data['content'] as String? ?? '';
            final snippet = content.length > 30 ? content.substring(0, 30) + '...' : content;
            final createdAt = (data['timestamp'] as Timestamp?)?.toDate();

            return ListTile(
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => PostDetailScreen(postId: docSnap.id)),
              ),
              leading: ProfileWithCrown(
                photoUrl: photoUrl,
                nickname: nickname,
                level: level,
                radius: 18,
                crownSize: 16,
                displayType: 'comment',
                showNickname: true,
                textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w400, overflow: TextOverflow.ellipsis),
              ),
              title: Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  FutureBuilder<QuerySnapshot<Map<String, dynamic>>>(
                    future: FirebaseFirestore.instance
                        .collection('notifications')
                        .where('receiverId', isEqualTo: uid)
                        .where('checked', isEqualTo: false)
                        .where('postId', isEqualTo: docSnap.id)
                        .get(),
                    builder: (context, notifSnap) {
                      final hasNotif = notifSnap.hasData && notifSnap.data!.docs.isNotEmpty;
                      return hasNotif
                          ? const Padding(
                        padding: EdgeInsets.only(left: 6),
                        child: Icon(Icons.notification_important,
                            color: Colors.red, size: 18),
                      )
                          : const SizedBox.shrink();
                    },
                  ),
                ],
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (createdAt != null)
                    Text(
                      '$nickname   ${_formatDate(createdAt)}',
                      style: const TextStyle(fontSize: 12, color: Colors.black54),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  const SizedBox(height: 4),
                  Text(snippet, maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
              trailing: const Icon(Icons.arrow_forward_ios, size: 16),
            );
          },
        );
      },
    );
  }

  // ================ [3. 내댓글 탭] =================
  Widget _buildMyCommentsTab(Map<String, dynamic> currentUserProfile) {
    final uid = currentUser!.uid;
    final query = FirebaseFirestore.instance
        .collectionGroup('comments')
        .where('userId', isEqualTo: uid)
        .orderBy('timestamp', descending: true);

    final nickname = currentUserProfile['nickname'] ?? '(닉네임 없음)';
    final photoUrl = currentUserProfile['photoUrl'];
    final level = currentUserProfile['level'] ?? '';

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: query.snapshots(),
      builder: (context, snapshot) {
        if (snapshot.hasError) return Center(child: Text('에러 발생: ${snapshot.error}'));
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());

        final docsList = snapshot.data!.docs;
        if (docsList.isEmpty) return const Center(child: Text('아직 작성한 댓글이 없습니다.'));

        return ListView.builder(
          padding: const EdgeInsets.all(8),
          itemCount: docsList.length,
          itemBuilder: (context, index) {
            final docSnap = docsList[index];
            final data = docSnap.data();
            final text = data['text'] as String? ?? '';
            final createdAt = (data['timestamp'] as Timestamp?)?.toDate();
            final parentPostRef = docSnap.reference.parent.parent;
            final parentPostId = parentPostRef?.id ?? '';

            return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
              future: FirebaseFirestore.instance
                  .collection('posts')
                  .doc(parentPostId)
                  .get(),
              builder: (context, postSnap) {
                String postTitle = '(알 수 없는 글)';
                if (postSnap.hasData && postSnap.data!.exists) {
                  postTitle = postSnap.data!.data()!['title'] as String? ?? postTitle;
                }
                return ListTile(
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => CommentDetailScreen(
                        parentPostId: parentPostId,
                        commentId: docSnap.id,
                      ),
                    ),
                  ),
                  leading: ProfileWithCrown(
                    photoUrl: photoUrl,
                    nickname: nickname,
                    level: level,
                    radius: 14,
                    crownSize: 14,
                    displayType: 'comment',
                    showNickname: true,
                    textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w400, overflow: TextOverflow.ellipsis),
                  ),
                  title: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(postTitle,
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold, fontSize: 16),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis),
                            const SizedBox(height: 4),
                            Text(text,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis),
                          ],
                        ),
                      ),
                      FutureBuilder<QuerySnapshot<Map<String, dynamic>>>(
                        future: FirebaseFirestore.instance
                            .collection('notifications')
                            .where('receiverId', isEqualTo: uid)
                            .where('checked', isEqualTo: false)
                            .where('commentId', isEqualTo: docSnap.id)
                            .get(),
                        builder: (context, notifSnap) {
                          final hasNotif = notifSnap.hasData && notifSnap.data!.docs.isNotEmpty;
                          return hasNotif
                              ? const Padding(
                            padding: EdgeInsets.only(left: 6),
                            child: Icon(Icons.notification_important,
                                color: Colors.red, size: 18),
                          )
                              : const SizedBox.shrink();
                        },
                      ),
                    ],
                  ),
                  subtitle: createdAt != null
                      ? Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      '작성자: $nickname   ${_formatDate(createdAt)}',
                      style: const TextStyle(fontSize: 12, color: Colors.black54),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  )
                      : null,
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                );
              },
            );
          },
        );
      },
    );
  }

  // ================= [4. MY ROUTE 탭] ====================
  Widget _buildMyRouteTab() {
    final uid = currentUser!.uid;
    final myRoutesRef = FirebaseFirestore.instance
        .collection('users')
        .doc(uid)
        .collection('my_routes')
        .orderBy('savedAt', descending: true);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(
            decoration: const InputDecoration(
              hintText: 'MY ROUTE 검색',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.all(Radius.circular(8)),
              ),
              isDense: true,
            ),
            onChanged: (v) {
              setState(() {
                _myRouteSearchText = v.trim().toLowerCase();
              });
            },
          ),
        ),
        Expanded(
          child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: myRoutesRef.snapshots(),
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return Center(child: Text('오류: ${snapshot.error}'));
              }
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              final allDocs = snapshot.data!.docs;

              return ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                itemCount: allDocs.length,
                itemBuilder: (context, index) {
                  final myDoc = allDocs[index];
                  final myData = myDoc.data();
                  final storedRef = myData['routeRef'] as DocumentReference<Map<String, dynamic>>?;
                  final storedId = myDoc.id;
                  if (storedRef == null) {
                    final storedMountain = (myData['mountain'] as String?) ?? '이름 없음';
                    final storedRouteName = (myData['routeName'] as String?) ?? '';
                    return _myRouteTile(
                      mountain: storedMountain,
                      routeName: storedRouteName,
                      imageUrl: null,
                      storedId: storedId,
                      storedRef: null,
                    );
                  }
                  return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
                    future: storedRef.get(),
                    builder: (context, routeSnap) {
                      if (routeSnap.connectionState != ConnectionState.done) {
                        return const Padding(
                          padding: EdgeInsets.all(24),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }
                      if (!routeSnap.hasData || !routeSnap.data!.exists) {
                        return _myRouteTile(
                          mountain: '삭제된 루트입니다.',
                          routeName: '',
                          imageUrl: null,
                          storedId: storedId,
                          storedRef: null,
                        );
                      }
                      final routeData = routeSnap.data!.data()!;
                      final currentMountain = (routeData['mountain'] as String?) ?? '이름 없음';
                      final currentRouteName = (routeData['routeName'] as String?) ?? '';
                      final imageUrl = routeData['imageUrl'] as String?;
                      final keyword = _myRouteSearchText.toLowerCase();
                      if (keyword.isNotEmpty &&
                          !(currentMountain.toLowerCase().contains(keyword) ||
                              currentRouteName.toLowerCase().contains(keyword))) {
                        return const SizedBox.shrink();
                      }
                      return _myRouteTile(
                        mountain: currentMountain,
                        routeName: currentRouteName,
                        imageUrl: imageUrl,
                        storedId: storedId,
                        storedRef: storedRef,
                      );
                    },
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _myRouteTile({
    required String mountain,
    required String routeName,
    required String? imageUrl,
    required String storedId,
    required DocumentReference<Map<String, dynamic>>? storedRef,
  }) {
    final uid = currentUser!.uid;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Card(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        elevation: 2,
        child: ListTile(
          contentPadding: const EdgeInsets.all(12),
          leading: (imageUrl != null && imageUrl.isNotEmpty)
              ? GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => FullImageScreen(
                    imageUrl: imageUrl,
                    watermarkText: 'routefinding',
                  ),
                ),
              );
            },
            child: Container(
              width: 60,
              height: 60,
              color: Colors.grey.shade200,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: WatermarkedImage(
                  imageProvider: NetworkImage(imageUrl),
                  watermarkText: 'routefinding',
                  width: 60,
                  height: 60,
                ),
              ),
            ),
          )
              : Container(
            width: 60,
            height: 60,
            color: Colors.grey.shade200,
            child: const Center(
              child: Icon(
                Icons.photo,
                size: 30,
                color: Colors.grey,
              ),
            ),
          ),
          title: Text(
            '$mountain · $routeName',
            style: const TextStyle(fontWeight: FontWeight.bold),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: IconButton(
            icon: const Icon(Icons.delete, color: Colors.redAccent),
            onPressed: () async {
              final shouldDelete = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('삭제 확인'),
                  content: const Text('정말 삭제하시겠습니까?'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.of(ctx).pop(false),
                        child: const Text('취소')),
                    TextButton(
                        onPressed: () => Navigator.of(ctx).pop(true),
                        child: const Text('확인')),
                  ],
                ),
              );
              if (shouldDelete == true) {
                await FirebaseFirestore.instance
                    .collection('users')
                    .doc(uid)
                    .collection('my_routes')
                    .doc(storedId)
                    .delete();
              }
            },
          ),
          onTap: () {
            if (storedRef != null) {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => GenericRouteDetailScreen(
                    routeRef: storedRef,
                    title: '$mountain · $routeName',
                  ),
                ),
              );
            }
          },
        ),
      ),
    );
  }

  // ==================== 유틸 ========================
  String _statusToKorean(String status) {
    switch (status) {
      case 'draft':
        return '임시 저장';
      case 'pending':
        return '승인 대기';
      case 'approved':
        return '승인 완료';
      case 'rejected':
        return '반려됨';
      default:
        return status;
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'draft':
        return Colors.grey;
      case 'pending':
        return Colors.orange;
      case 'approved':
        return Colors.green;
      case 'rejected':
        return Colors.orange;
      default:
        return Colors.black;
    }
  }

  String _formatDate(DateTime dt) {
    final y = dt.year.toString().padLeft(4, '0');
    final mo = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final h = dt.hour.toString().padLeft(2, '0');
    final mi = dt.minute.toString().padLeft(2, '0');
    return '$y-$mo-$d $h:$mi';
  }
}
