import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'post_detail_screen.dart';
import '../common/profile_with_crown.dart';

class NoticeBoardScreen extends StatefulWidget {
  const NoticeBoardScreen({Key? key}) : super(key: key);

  @override
  State<NoticeBoardScreen> createState() => _NoticeBoardScreenState();
}

class _NoticeBoardScreenState extends State<NoticeBoardScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final List<String> _categories = ['공지', '자유', '크루'];
  bool _showMoreNotices = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _categories.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('게시판'),
        bottom: TabBar(
          controller: _tabController,
          tabs: _categories.map((c) => Tab(text: c)).toList(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            tooltip: '글쓰기',
            onPressed: () {
              Navigator.of(context).pushNamed('/write_post');
            },
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: _categories.map(_buildCategoryTab).toList(),
      ),
    );
  }

  Widget _buildCategoryTab(String category) {
    if (category != '공지') return _buildDefaultTab(category);

    final noticeQuery = FirebaseFirestore.instance
        .collection('posts')
        .where('category', isEqualTo: '공지')
        .orderBy('isPinned', descending: true)
        .orderBy('timestamp', descending: true);

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: noticeQuery.snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        final docs = snapshot.data!.docs;
        if (docs.isEmpty) return const Center(child: Text('공지 게시판에 글이 없습니다.'));

        final QueryDocumentSnapshot<Map<String, dynamic>>? pinnedDoc =
        docs.where((doc) => doc['isPinned'] == true).isNotEmpty
            ? docs.firstWhere((doc) => doc['isPinned'] == true)
            : null;

        final otherDocs = docs.where((doc) => doc['isPinned'] != true).toList();
        final latest = otherDocs.take(1).toList();
        final rest = otherDocs.skip(1).toList();
        final displayDocs = _showMoreNotices ? otherDocs : latest;


        return Column(
          children: [
            if (pinnedDoc != null)
              Container(
                margin: const EdgeInsets.all(10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.yellow.shade100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: GestureDetector(
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => PostDetailScreen(postId: pinnedDoc.id),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.push_pin, color: Colors.orange),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          pinnedDoc.data()['title'] ?? '(제목 없음)',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                itemCount: displayDocs.length + (rest.isNotEmpty ? 1 : 0),
                itemBuilder: (context, index) {
                  if (index == displayDocs.length && rest.isNotEmpty) {
                    return TextButton(
                      onPressed: () => setState(() => _showMoreNotices = !_showMoreNotices),
                      child: Text(_showMoreNotices ? '접기' : '더보기'),
                    );
                  }
                  final docSnap = displayDocs[index];
                  return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
                    future: FirebaseFirestore.instance.collection('users').doc(docSnap['userId']).get(),
                    builder: (context, userSnap) {
                      String nickname = '(알 수 없음)';
                      String? photoUrl;
                      String? level;
                      if (userSnap.hasData && userSnap.data!.exists) {
                        final data = userSnap.data!.data()!;
                        nickname = data['nickname'] ?? nickname;
                        photoUrl = data['photoUrl'];
                        level = data['level'];
                      }
                      return _buildSinglePostCard(
                        docId: docSnap.id,
                        title: docSnap['title'],
                        createdAt: (docSnap['timestamp'] as Timestamp?)?.toDate(),
                        thumbnailUrl: docSnap['thumbnailUrl'],
                        profileWidget: ProfileWithCrown(
                          photoUrl: photoUrl,
                          nickname: nickname,
                          level: level,
                          radius: 13,
                          crownSize: 18,
                          displayType: 'comment',
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildDefaultTab(String category) {
    final query = FirebaseFirestore.instance
        .collection('posts')
        .where('category', isEqualTo: category)
        .orderBy('timestamp', descending: true);

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: query.snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        final docsList = snapshot.data!.docs;
        if (docsList.isEmpty) return Center(child: Text('$category 게시판에 글이 없습니다.'));

        return ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
          itemCount: docsList.length,
          itemBuilder: (context, index) {
            final docSnap = docsList[index];
            final data = docSnap.data();
            final String title = data['title'] ?? '(제목 없음)';
            final Timestamp? ts = data['timestamp'];
            final DateTime? createdAt = ts?.toDate();
            final String authorUid = data['userId'] ?? '';
            final String? thumbnailUrl = data['thumbnailUrl'];

            return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
              future: FirebaseFirestore.instance.collection('users').doc(authorUid).get(),
              builder: (context, userSnap) {
                String nickname = '(알 수 없는 사용자)';
                String? photoUrl;
                String? level;
                if (userSnap.hasData && userSnap.data!.exists) {
                  final userData = userSnap.data!.data()!;
                  nickname = userData['nickname'] ?? '(닉네임 없음)';
                  photoUrl = userData['photoUrl'];
                  level = userData['level'];
                }
                return _buildSinglePostCard(
                  docId: docSnap.id,
                  title: title,
                  thumbnailUrl: thumbnailUrl,
                  createdAt: createdAt,
                  profileWidget: ProfileWithCrown(
                    photoUrl: photoUrl,
                    nickname: nickname,
                    level: level,
                    radius: 13,
                    crownSize: 18,
                    displayType: 'comment',
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  Widget _buildSinglePostCard({
    required String docId,
    required String title,
    String? thumbnailUrl,
    DateTime? createdAt,
    required Widget profileWidget,
  }) {
    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => PostDetailScreen(postId: docId),
          ),
        );
      },
      child: Card(
        margin: const EdgeInsets.symmetric(vertical: 6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 2,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              if (thumbnailUrl != null && thumbnailUrl.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: Image.network(
                    thumbnailUrl,
                    width: 80,
                    height: 80,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                    const Icon(Icons.broken_image, size: 40, color: Colors.grey),
                  ),
                )
              else
                Container(
                  width: 80,
                  height: 80,
                  color: Colors.grey.shade200,
                  child: const Center(child: Icon(Icons.photo, size: 40, color: Colors.grey)),
                ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Expanded(child: profileWidget),
                        const SizedBox(width: 6),
                        if (createdAt != null)
                          Expanded(
                            child: Text(
                              '작성: ${_formatDate(createdAt)}',
                              style: const TextStyle(fontSize: 12, color: Colors.black54),
                              textAlign: TextAlign.right,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.black38),
            ],
          ),
        ),
      ),
    );
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
