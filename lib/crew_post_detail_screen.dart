//crew_post_detail_screen.dart

import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';

import 'crew_post_write_screen.dart';
import '../common/profile_with_crown.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';

class CrewPostDetailScreen extends StatefulWidget {
  final String crewId;
  final String postId;

  const CrewPostDetailScreen({
    required this.crewId,
    required this.postId,
    Key? key,
  }) : super(key: key);

  @override
  State<CrewPostDetailScreen> createState() => _CrewPostDetailScreenState();
}

class _CrewPostDetailScreenState extends State<CrewPostDetailScreen> {
  Map<String, dynamic>? post;
  List<String> imageUrls = [];
  String? myUid;
  bool isLoading = true;

  int _currentImgIndex = 0;
  late PageController _pageController;

  @override
  void initState() {
    super.initState();
    myUid = FirebaseAuth.instance.currentUser?.uid;
    _pageController = PageController();
    _fetch();
    _incrementView();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    setState(() => isLoading = true);

    final snap = await FirebaseFirestore.instance
        .collection('crews')
        .doc(widget.crewId)
        .collection('crewPosts')
        .doc(widget.postId)
        .get();

    post = snap.data();
    final images = post?['images'] as List<dynamic>? ?? [];
    // 순서 보존
    imageUrls = images.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();

    setState(() => isLoading = false);

    for (var url in imageUrls) {
      precacheImage(CachedNetworkImageProvider(url), context);
    }
  }

  Future<void> _incrementView() async {
    await FirebaseFirestore.instance
        .collection('crews')
        .doc(widget.crewId)
        .collection('crewPosts')
        .doc(widget.postId)
        .update({'views': FieldValue.increment(1)});
  }

  Future<void> _delete() async {
    await FirebaseFirestore.instance
        .collection('crews')
        .doc(widget.crewId)
        .collection('crewPosts')
        .doc(widget.postId)
        .delete();
    if (mounted) Navigator.pop(context, true);
  }

  Future<void> _edit() async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => CrewPostWriteScreen(
          crewId: widget.crewId,
          editPostId: widget.postId,
          initial: post,
        ),
      ),
    );
    if (changed == true) {
      await _fetch();
    }
  }

  Future<void> _addComment(String comment) async {
    final user = FirebaseAuth.instance.currentUser;
    final txt = comment.trim();
    if (user == null || txt.isEmpty) return;

    final profileDoc = await FirebaseFirestore.instance
        .collection('users').doc(user.uid).get();
    final profile = profileDoc.data() ?? {};

    await FirebaseFirestore.instance
        .collection('crews')
        .doc(widget.crewId)
        .collection('crewPosts')
        .doc(widget.postId)
        .collection('comments')
        .add({
      'text': txt,
      'nickname': profile['displayName'] ?? user.displayName ?? user.email ?? '익명',
      'uid': user.uid,
      'photoUrl': profile['photoUrl'] ?? '',
      'level': profile['level'] ?? '',
      'createdAt': FieldValue.serverTimestamp(),
    });

    setState(() {});
  }

  Future<void> _addReply(String commentId, String replyText) async {
    final user = FirebaseAuth.instance.currentUser;
    final txt = replyText.trim();
    if (user == null || txt.isEmpty) return;

    final profileDoc = await FirebaseFirestore.instance
        .collection('users').doc(user.uid).get();
    final profile = profileDoc.data() ?? {};

    await FirebaseFirestore.instance
        .collection('crews')
        .doc(widget.crewId)
        .collection('crewPosts')
        .doc(widget.postId)
        .collection('comments')
        .doc(commentId)
        .collection('replies')
        .add({
      'text': txt,
      'nickname': profile['displayName'] ?? user.displayName ?? user.email ?? '익명',
      'uid': user.uid,
      'photoUrl': profile['photoUrl'] ?? '',
      'level': profile['level'] ?? '',
      'createdAt': FieldValue.serverTimestamp(),
    });

    setState(() {});
  }

  Future<void> _deleteComment(String commentId) async {
    await FirebaseFirestore.instance
        .collection('crews')
        .doc(widget.crewId)
        .collection('crewPosts')
        .doc(widget.postId)
        .collection('comments')
        .doc(commentId)
        .delete();
    setState(() {});
  }

  Future<void> _deleteReply(String commentId, String replyId) async {
    await FirebaseFirestore.instance
        .collection('crews')
        .doc(widget.crewId)
        .collection('crewPosts')
        .doc(widget.postId)
        .collection('comments')
        .doc(commentId)
        .collection('replies')
        .doc(replyId)
        .delete();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading || post == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final isMine = myUid == (post!['authorUid'] ?? post!['uid']);

    return Scaffold(
      appBar: AppBar(
        title: Text(post!['title'] ?? '', overflow: TextOverflow.ellipsis),
        actions: [
          if (isMine) ...[
            IconButton(icon: const Icon(Icons.edit), onPressed: _edit),
            IconButton(icon: const Icon(Icons.delete), onPressed: _delete),
          ]
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          // 이미지 슬라이드 + dot indicator + 풀스크린
          if (imageUrls.isNotEmpty)
            Column(
              children: [
                SizedBox(
                  height: 220,
                  child: PageView.builder(
                    controller: _pageController,
                    itemCount: imageUrls.length,
                    onPageChanged: (idx) => setState(() => _currentImgIndex = idx),
                    itemBuilder: (ctx, idx) {
                      final url = imageUrls[idx];
                      return GestureDetector(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => _FullscreenPhotoViewer(
                                urls: imageUrls,
                                initialIndex: idx,
                              ),
                            ),
                          );
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: CachedNetworkImage(
                              imageUrl: url,
                              fit: BoxFit.cover,
                              placeholder: (_, __) =>
                              const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                              errorWidget: (_, __, ___) => const Icon(Icons.error),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 8),
                SmoothPageIndicator(
                  controller: _pageController,
                  count: imageUrls.length,
                  effect: WormEffect(
                    dotHeight: 8,
                    dotWidth: 8,
                    activeDotColor: Theme.of(context).primaryColor,
                    dotColor: Colors.grey.shade300,
                  ),
                ),
                const SizedBox(height: 8),
              ],
            ),

          // 프로필 아바타 + 닉네임 + 날짜
          Row(
            children: [
              ProfileWithCrown(
                photoUrl: post?['photoUrl'] ?? '',
                level: post?['level'] ?? '',
                nickname: post?['nickname'] ?? '',
                displayType: 'profile',
                radius: 24,
                showNickname: false,
                crownSize: 20,
                crownTopOffset: -22,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(post!['nickname'] ?? '익명',
                        style: TextStyle(color: Colors.grey[800], fontWeight: FontWeight.bold)),
                    Text(
                      post!['createdAt'] == null
                          ? ''
                          : (post!['createdAt'] as Timestamp).toDate().toLocal().toString().substring(0, 16),
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // 본문
          Text(post!['content'] ?? '', style: const TextStyle(fontSize: 16)),
          const SizedBox(height: 8),

          // 조회수
          Text('조회수: ${post!['views'] ?? 0}', style: const TextStyle(fontSize: 12)),
          const Divider(height: 32),

          // 댓글 + 대댓글 리스트
          _CommentList(
            crewId: widget.crewId,
            postId: widget.postId,
            myUid: myUid!,
            onDelete: _deleteComment,
            onAddReply: _addReply,
            onDeleteReply: _deleteReply,
          ),

          const Divider(),

          // 댓글 입력
          _CommentInput(onSubmit: _addComment),
        ],
      ),
    );
  }
}

// 댓글 입력 위젯
class _CommentInput extends StatefulWidget {
  final Future<void> Function(String) onSubmit;
  const _CommentInput({required this.onSubmit});

  @override
  State<_CommentInput> createState() => _CommentInputState();
}

class _CommentInputState extends State<_CommentInput> {
  final TextEditingController _ctrl = TextEditingController();
  bool _sending = false;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _ctrl,
            decoration: const InputDecoration(hintText: '댓글을 입력하세요'),
            onSubmitted: _send,
          ),
        ),
        IconButton(
          icon: _sending
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.send),
          onPressed: _sending ? null : () => _send(_ctrl.text),
        ),
      ],
    );
  }

  Future<void> _send(String txt) async {
    final trimmed = txt.trim();
    if (trimmed.isEmpty) return;

    setState(() => _sending = true);
    try {
      await widget.onSubmit(trimmed);
      _ctrl.clear();
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }
}

// 댓글/대댓글 리스트
class _CommentList extends StatelessWidget {
  final String crewId, postId, myUid;
  final Future<void> Function(String) onDelete;
  final Future<void> Function(String, String) onAddReply;
  final Future<void> Function(String, String) onDeleteReply;

  const _CommentList({
    required this.crewId,
    required this.postId,
    required this.myUid,
    required this.onDelete,
    required this.onAddReply,
    required this.onDeleteReply,
  });

  @override
  Widget build(BuildContext context) {
    final ref = FirebaseFirestore.instance
        .collection('crews')
        .doc(crewId)
        .collection('crewPosts')
        .doc(postId)
        .collection('comments')
        .orderBy('createdAt');

    return StreamBuilder<QuerySnapshot>(
      stream: ref.snapshots(),
      builder: (context, snap) {
        if (!snap.hasData) return const SizedBox();
        final docs = snap.data!.docs;
        return Column(
          children: docs.map((d) {
            final data = d.data()! as Map<String, dynamic>;
            final isMine = data['uid'] == myUid;
            final commentId = d.id;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ListTile(
                  dense: true,
                  leading: ProfileWithCrown(
                    photoUrl: data['photoUrl'] ?? '',
                    level: data['level'] ?? '',
                    nickname: data['nickname'] ?? '',
                    displayType: 'comment',
                    radius: 14,
                  ),
                  title: Text(data['text'] ?? ''),
                  subtitle: Text(data['nickname'] ?? '익명'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _ReplyButton(
                        onPressed: () {
                          showDialog(
                            context: context,
                            builder: (ctx) => _ReplyDialog(
                              onSubmit: (reply) => onAddReply(commentId, reply),
                            ),
                          );
                        },
                      ),
                      if (isMine)
                        IconButton(
                          icon: const Icon(Icons.delete, size: 18),
                          onPressed: () => onDelete(commentId),
                        ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 32),
                  child: _ReplyList(
                    crewId: crewId,
                    postId: postId,
                    commentId: commentId,
                    myUid: myUid,
                    onDelete: (replyId) => onDeleteReply(commentId, replyId),
                  ),
                ),
              ],
            );
          }).toList(),
        );
      },
    );
  }
}

// 대댓글(리플) 리스트
class _ReplyList extends StatelessWidget {
  final String crewId, postId, commentId, myUid;
  final Future<void> Function(String) onDelete;

  const _ReplyList({
    required this.crewId,
    required this.postId,
    required this.commentId,
    required this.myUid,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final ref = FirebaseFirestore.instance
        .collection('crews')
        .doc(crewId)
        .collection('crewPosts')
        .doc(postId)
        .collection('comments')
        .doc(commentId)
        .collection('replies')
        .orderBy('createdAt');

    return StreamBuilder<QuerySnapshot>(
      stream: ref.snapshots(),
      builder: (context, snap) {
        if (!snap.hasData) return const SizedBox();
        final docs = snap.data!.docs;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: docs.map((d) {
            final data = d.data()! as Map<String, dynamic>;
            final isMine = data['uid'] == myUid;
            return ListTile(
              dense: true,
              leading: ProfileWithCrown(
                photoUrl: data['photoUrl'] ?? '',
                level: data['level'] ?? '',
                nickname: data['nickname'] ?? '',
                displayType: 'reply',
                radius: 12,
              ),
              title: Text(data['text'] ?? '', style: const TextStyle(fontSize: 14)),
              subtitle: Text(data['nickname'] ?? '익명'),
              trailing: isMine
                  ? IconButton(
                icon: const Icon(Icons.delete, size: 16),
                onPressed: () => onDelete(d.id),
              )
                  : null,
            );
          }).toList(),
        );
      },
    );
  }
}

// 대댓글 입력 버튼
class _ReplyButton extends StatelessWidget {
  final VoidCallback onPressed;
  const _ReplyButton({required this.onPressed});
  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      child: const Text('답글', style: TextStyle(fontSize: 13)),
    );
  }
}

// 대댓글 입력 다이얼로그
class _ReplyDialog extends StatefulWidget {
  final Future<void> Function(String) onSubmit;
  const _ReplyDialog({required this.onSubmit});

  @override
  State<_ReplyDialog> createState() => _ReplyDialogState();
}

class _ReplyDialogState extends State<_ReplyDialog> {
  final _ctrl = TextEditingController();
  bool _sending = false;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('답글 작성'),
      content: TextField(
        controller: _ctrl,
        decoration: const InputDecoration(hintText: '답글을 입력하세요'),
        autofocus: true,
        onSubmitted: _send,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('취소'),
        ),
        TextButton(
          onPressed: _sending ? null : () => _send(_ctrl.text),
          child: _sending
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('작성'),
        ),
      ],
    );
  }

  Future<void> _send(String txt) async {
    final trimmed = txt.trim();
    if (trimmed.isEmpty) return;

    setState(() => _sending = true);
    try {
      await widget.onSubmit(trimmed);
      Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }
}

// 풀스크린 사진 뷰어
class _FullscreenPhotoViewer extends StatelessWidget {
  final List<String> urls;
  final int initialIndex;

  const _FullscreenPhotoViewer({
    required this.urls,
    this.initialIndex = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: PhotoViewGallery.builder(
        itemCount: urls.length,
        pageController: PageController(initialPage: initialIndex),
        builder: (ctx, i) => PhotoViewGalleryPageOptions(
          imageProvider: CachedNetworkImageProvider(urls[i]),
          minScale: PhotoViewComputedScale.contained,
          maxScale: PhotoViewComputedScale.covered * 2,
        ),
        loadingBuilder: (_, __) => const Center(child: CircularProgressIndicator()),
        backgroundDecoration: const BoxDecoration(color: Colors.black),
      ),
    );
  }
}
