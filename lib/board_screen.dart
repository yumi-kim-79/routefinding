// lib/screens/board_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'user_profile_screen.dart';
import 'post_detail_screen.dart';
import 'write_post_screen.dart';
import 'category_posts_screen.dart';
import '../constants/firestore_fields.dart';
import '../utils/image_url_helper.dart';
import '../common/profile_with_crown.dart';

class BoardScreen extends StatelessWidget {
  const BoardScreen({Key? key}) : super(key: key);

  static const categories = ['공지', '자유', '크루', '중고마켓'];
  static const _adminEmail = 'yusung790926@gmail.com';

  static bool isAdmin() =>
      FirebaseAuth.instance.currentUser?.email == _adminEmail;

  @override
  Widget build(BuildContext context) {
    final admin = isAdmin();

    return Scaffold(
      appBar: AppBar(
        title: const Text('게시판'),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: TextButton.icon(
              style: TextButton.styleFrom(
                backgroundColor: Colors.purple.shade200,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              icon: const Icon(Icons.edit, size: 20),
              label: const Text('글쓰기', style: TextStyle(fontSize: 16)),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) =>
                        WritePostScreen(initialCategory: categories.first),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      body: ListView(
        children: [
          const SizedBox(height: 16),
          const _PinnedNoticeBlock(),
          const _LatestNotices(limit: 1),
          ...categories
              .where((c) => c != '공지')
              .map((c) => _CategoryPreview(category: c, isAdmin: admin)),
        ],
      ),
    );
  }
}

class _PinnedNoticeBlock extends StatelessWidget {
  const _PinnedNoticeBlock({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final pinnedStream = FirebaseFirestore.instance
        .collection('posts')
        .where(PostFields.category, isEqualTo: '공지')
        .where(PostFields.isPinned, isEqualTo: true)
        .orderBy(PostFields.timestamp, descending: true)
        .limit(1)
        .snapshots();

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: pinnedStream,
      builder: (ctx, snap) {
        if (!snap.hasData || snap.data!.docs.isEmpty) {
          return const SizedBox.shrink();
        }
        final doc = snap.data!.docs.first;
        final data = doc.data();
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Card(
            color: Colors.yellow.shade100,
            elevation: 2,
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: const Icon(Icons.push_pin, color: Colors.orange),
              title: Text(
                data[PostFields.title] ?? '제목 없음',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 4),
                  ProfileWithCrown(
                    photoUrl: data['photoUrl'] as String? ?? '',
                    nickname: data['nickname'] as String? ?? '(알 수 없음)',
                    level: data['level'] as String? ?? '',
                    displayType: 'comment',
                    radius: 14,
                    crownSize: 16,
                    showNickname: true,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    (data[PostFields.content] as String? ?? '')
                        .substring(0, 40),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => PostDetailScreen(
                    postId: doc.id,
                    isAdmin: BoardScreen.isAdmin(),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _LatestNotices extends StatelessWidget {
  final int limit;
  const _LatestNotices({Key? key, this.limit = 1}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final stream = FirebaseFirestore.instance
        .collection('posts')
        .where(PostFields.category, isEqualTo: '공지')
        .orderBy(PostFields.timestamp, descending: true)
        .snapshots();

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: stream,
      builder: (ctx, snap) {
        if (!snap.hasData) return const SizedBox.shrink();
        final all = snap.data!.docs;
        final nonPinned = all
            .where((d) => (d.data()[PostFields.isPinned] as bool?) != true)
            .toList();
        final preview = nonPinned.take(limit).toList();

        if (preview.isEmpty) return const SizedBox.shrink();

        return Column(
          children: [
            for (var doc in preview)
              _PostListTileOptimized(
                docId: doc.id,
                data: doc.data(),
                category: '공지',
                isAdmin: BoardScreen.isAdmin(),
              ),
            if (nonPinned.length > limit)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  child: const Text('더보기 ›'),
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => CategoryPostsScreen(category: '공지'),
                    ),
                  ),
                ),
              ),
            const Divider(),
          ],
        );
      },
    );
  }
}

class _CategoryPreview extends StatelessWidget {
  final String category;
  final bool isAdmin;
  const _CategoryPreview({
    Key? key,
    required this.category,
    required this.isAdmin,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final stream = FirebaseFirestore.instance
        .collection('posts')
        .where(PostFields.category, isEqualTo: category)
        .orderBy(PostFields.timestamp, descending: true)
        .snapshots();

    const previewLimit = 3;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            category,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
        StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: stream,
          builder: (ctx, snap) {
            if (!snap.hasData) return const SizedBox.shrink();
            final all = snap.data!.docs;
            final nonPinned =
            all.where((d) => (d.data()[PostFields.isPinned] as bool?) != true);
            final preview = nonPinned.take(previewLimit).toList();

            if (preview.isEmpty) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: Text('아직 글이 없습니다.'),
              );
            }

            return Column(
              children: [
                for (var doc in preview)
                  _PostListTileOptimized(
                    docId: doc.id,
                    data: doc.data(),
                    category: category,
                    isAdmin: isAdmin,
                  ),
                if (nonPinned.length > previewLimit)
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      child: const Text('더보기 ›'),
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => CategoryPostsScreen(category: category),
                        ),
                      ),
                    ),
                  ),
                const Divider(),
              ],
            );
          },
        ),
      ],
    );
  }
}

/// 게시글 한 줄 미리보기 tile
class _PostListTileOptimized extends StatelessWidget {
  final String docId;
  final Map<String, dynamic> data;
  final String category;
  final bool isAdmin;

  const _PostListTileOptimized({
    Key? key,
    required this.docId,
    required this.data,
    required this.category,
    required this.isAdmin,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final ts = (data[PostFields.timestamp] as Timestamp?)
        ?.toDate()
        .toLocal();
    final timeString = ts != null
        ? '${ts.year}-${ts.month.toString().padLeft(2, '0')}-${ts.day.toString().padLeft(2, '0')} '
        '${ts.hour.toString().padLeft(2, '0')}:${ts.minute.toString().padLeft(2, '0')}'
        : '';
    final title = data[PostFields.title] as String? ?? '(제목 없음)';
    final nick = data['nickname'] as String? ?? '(알 수 없는 사용자)';
    final photoUrl = data['photoUrl'] as String? ?? '';
    final level = data['level'] as String? ?? '';
    final userId = data[PostFields.userId];
    final myUid = FirebaseAuth.instance.currentUser?.uid;
    final canEditOrDelete = isAdmin || (myUid != null && userId == myUid);

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      leading: _PostThumbnail(docId: docId, data: data),
      title: Text(title, style: const TextStyle(fontSize: 16)),
      subtitle: Row(
        children: [
          ProfileWithCrown(
            photoUrl: photoUrl,
            nickname: nick,
            level: level,
            displayType: 'comment',    // ← 'profile' → 'comment' 로 변경
            radius: 15,
            crownSize: 18,
            showNickname: true,        // 닉네임 노출 추가
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              '작성시간: $timeString',
              style: const TextStyle(fontSize: 13, color: Colors.grey),
              overflow: TextOverflow.ellipsis,
            ),
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
                builder: (_) => PostDetailScreen(
                  postId: docId,
                  isAdmin: isAdmin,
                ),
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
                await FirebaseFirestore.instance
                    .collection('posts')
                    .doc(docId)
                    .delete();
                ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('삭제되었습니다.')));
              }
            },
          ),
        ],
      )
          : null,
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => PostDetailScreen(
            postId: docId,
            isAdmin: isAdmin,
          ),
        ),
      ),
    );
  }
}

/// 썸네일 이미지
class _PostThumbnail extends StatelessWidget {
  final String docId;
  final Map<String, dynamic> data;

  const _PostThumbnail({
    Key? key,
    required this.docId,
    required this.data,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final rawImages = data[PostFields.images] as List<dynamic>?;
    final raw = (rawImages != null && rawImages.isNotEmpty)
        ? rawImages.first as String
        : '';

    if (raw.isEmpty) {
      return const Icon(Icons.article, color: Colors.grey, size: 40);
    }
    return FutureBuilder<String?>(
      future: getPostImageUrl(raw, docId),
      builder: (ctx, imgSnap) {
        if (imgSnap.connectionState != ConnectionState.done) {
          return Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            child: const CircularProgressIndicator(strokeWidth: 2),
          );
        }
        final url = imgSnap.data;
        if (url == null) {
          return Container(
            width: 48,
            height: 48,
            color: Colors.grey.shade300,
            child: const Icon(Icons.broken_image, size: 30, color: Colors.grey),
          );
        }
        return ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: Image.network(url, width: 48, height: 48, fit: BoxFit.cover),
        );
      },
    );
  }
}
