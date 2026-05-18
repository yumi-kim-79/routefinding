import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'post_detail_screen.dart';
import 'constants/firestore_fields.dart';
import 'utils/image_url_helper.dart';
import '../common/profile_with_crown.dart';

class CategoryPostsScreen extends StatefulWidget {
  final String category;
  const CategoryPostsScreen({super.key, required this.category});

  @override
  State<CategoryPostsScreen> createState() => _CategoryPostsScreenState();
}

class _CategoryPostsScreenState extends State<CategoryPostsScreen> {
  static const _adminEmail = 'yusung790926@gmail.com';
  bool _showAll = false;
  final int _initialCount = 8;

  bool get _isAdmin => FirebaseAuth.instance.currentUser?.email == _adminEmail;
  String? get myUid => FirebaseAuth.instance.currentUser?.uid;

  @override
  Widget build(BuildContext context) {
    final postsRef = FirebaseFirestore.instance.collection('posts');

    final pinnedQuery = postsRef
        .where(PostFields.category, isEqualTo: widget.category)
        .where(PostFields.isPinned, isEqualTo: true)
        .orderBy(PostFields.timestamp, descending: true);

    final regularQuery = postsRef
        .where(PostFields.category, isEqualTo: widget.category)
        .where(PostFields.isPinned, isEqualTo: false)
        .orderBy(PostFields.timestamp, descending: true);

    return Scaffold(
      appBar: AppBar(title: Text('${widget.category} 게시판')),
      body: Column(
        children: [
          // 고정 공지
          StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: pinnedQuery.snapshots(),
            builder: (ctx, pinnedSnap) {
              if (!pinnedSnap.hasData || pinnedSnap.data!.docs.isEmpty) {
                return const SizedBox.shrink();
              }
              final doc = pinnedSnap.data!.docs.first;
              final data = doc.data();
              return Column(
                children: [
                  Container(
                    width: double.infinity,
                    color: Colors.orange.shade100,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: const Center(
                      child: Text('📌 고정 공지', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                  _PostTile(
                    docId: doc.id,
                    data: data,
                    isAdmin: _isAdmin,
                    myUid: myUid,
                    onDeleted: () => setState(() {}),
                  ),
                  const Divider(height: 1),
                ],
              );
            },
          ),

          // 일반 게시글 전체
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: regularQuery.snapshots(),
              builder: (ctx, snap) {
                if (snap.hasError) return Center(child: Text('에러 발생: ${snap.error}'));
                if (!snap.hasData) return const Center(child: CircularProgressIndicator());

                final allDocs = snap.data!.docs;
                final bool showMoreButton = !_showAll && allDocs.length > _initialCount;
                final displayDocs = _showAll ? allDocs : allDocs.take(_initialCount).toList();

                return ListView.separated(
                  itemCount: displayDocs.length + (showMoreButton ? 1 : 0),
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    if (showMoreButton && index == displayDocs.length) {
                      return Center(
                        child: TextButton(
                          onPressed: () => setState(() => _showAll = true),
                          child: const Text('더보기'),
                        ),
                      );
                    }
                    final doc = displayDocs[index];
                    final data = doc.data();
                    return _PostTile(
                      docId: doc.id,
                      data: data,
                      isAdmin: _isAdmin,
                      myUid: myUid,
                      onDeleted: () => setState(() {}),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// 게시글 타일
class _PostTile extends StatelessWidget {
  final String docId;
  final Map<String, dynamic> data;
  final bool isAdmin;
  final String? myUid;
  final VoidCallback? onDeleted;

  const _PostTile({
    required this.docId,
    required this.data,
    required this.isAdmin,
    required this.myUid,
    this.onDeleted,
  });

  @override
  Widget build(BuildContext context) {
    final title = data[PostFields.title] as String? ?? '';
    final ts = (data[PostFields.timestamp] as Timestamp?)?.toDate().toLocal();
    final isPinned = data[PostFields.isPinned] == true;
    final rawImages = data[PostFields.images];
    final rawUrl = (rawImages is List && rawImages.isNotEmpty) ? rawImages[0] : '';
    final userId = data[PostFields.userId] as String?;
    final canEditOrDelete = isAdmin || (myUid != null && userId == myUid);

    return ListTile(
      tileColor: isPinned ? Colors.orange.shade50 : null,
      leading: SizedBox(
        width: 48,
        height: 48,
        child: rawUrl.isEmpty
            ? const Icon(Icons.image, size: 32, color: Colors.grey)
            : FutureBuilder<String?>(
          future: getPostImageUrl(rawUrl, docId),
          builder: (c, imgSnap) {
            if (imgSnap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator(strokeWidth: 2));
            }
            final url = imgSnap.data;
            if (url == null) {
              return Container(
                color: Colors.grey.shade200,
                child: const Icon(Icons.broken_image, size: 32),
              );
            }
            return ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Image.network(
                url,
                width: 48,
                height: 48,
                fit: BoxFit.cover,
              ),
            );
          },
        ),
      ),
      title: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.w500),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (isPinned)
            const Padding(
              padding: EdgeInsets.only(left: 6),
              child: Icon(Icons.push_pin, size: 18, color: Colors.orange),
            ),
        ],
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (userId != null)
            FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
              future: FirebaseFirestore.instance
                  .collection('users')
                  .doc(userId)
                  .get(),
              builder: (ctx, userSnap) {
                if (!userSnap.hasData) {
                  return const SizedBox(
                    height: 28,
                    child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                  );
                }
                final udata = userSnap.data!.data()!;
                return ProfileWithCrown(
                  photoUrl: udata['photoUrl'] as String? ?? '',
                  level: udata['level'] as String? ?? '',
                  nickname: udata['nickname'] as String? ?? '(알 수 없음)',
                  displayType: 'comment',
                  radius: 14,
                  crownSize: 16,
                  showNickname: true,
                );
              },
            ),
          const SizedBox(height: 4),
          Text(
            ts != null
                ? '${ts.year}-${ts.month.toString().padLeft(2, '0')}-${ts.day.toString().padLeft(2, '0')} '
                '${ts.hour.toString().padLeft(2, '0')}:${ts.minute.toString().padLeft(2, '0')}'
                : '',
            style: const TextStyle(fontSize: 12, color: Colors.grey),
          ),
        ],
      ),
      trailing: canEditOrDelete
          ? Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: const Icon(Icons.edit, color: Colors.blue),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => PostDetailScreen(postId: docId, isAdmin: isAdmin),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete, color: Colors.red),
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('정말 삭제하시겠습니까?'),
                  content: const Text('삭제한 글은 복구할 수 없습니다.'),
                  actions: [
                    TextButton(
                      child: const Text('취소'),
                      onPressed: () => Navigator.of(context).pop(false),
                    ),
                    TextButton(
                      child: const Text('삭제', style: TextStyle(color: Colors.red)),
                      onPressed: () => Navigator.of(context).pop(true),
                    ),
                  ],
                ),
              );
              if (confirmed == true) {
                await FirebaseFirestore.instance.collection('posts').doc(docId).delete();
                onDeleted?.call();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('삭제되었습니다.')),
                );
              }
            },
          ),
        ],
      )
          : null,
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => PostDetailScreen(postId: docId, isAdmin: isAdmin),
        ),
      ),
    );
  }
}
