import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';

import 'constants/firestore_fields.dart';
import 'utils/image_url_helper.dart';
import 'user_profile_screen.dart';
import 'comment_detail_screen.dart';
import '../common/profile_with_crown.dart';
import 'constants/level.dart'; // updateUserPointAndLevel 등
import '../widgets/fullscreen_photo_viewer.dart';

class _FullImageScreen extends StatelessWidget {
  final List<String> rawUrls;
  final String postId;
  final int initialIndex;

  const _FullImageScreen(
      this.rawUrls,
      this.postId, {
        this.initialIndex = 0,
        Key? key,
      }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final PageController _pageController =
    PageController(initialPage: initialIndex);
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: PageView.builder(
        controller: _pageController,
        itemCount: rawUrls.length,
        itemBuilder: (context, idx) {
          return FutureBuilder<String?>(
            future: getPostImageUrl(rawUrls[idx], postId),
            builder: (ctx, snap) {
              if (snap.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }


              final url = snap.data;
              if (url == null) {
                return const Center(
                  child: Icon(Icons.broken_image,
                      color: Colors.white, size: 80),
                );
              }
              return InteractiveViewer(
                child: CachedNetworkImage(
                  imageUrl: url,
                  fit: BoxFit.contain,
                  placeholder: (_, __) =>
                  const Center(child: CircularProgressIndicator()),
                  errorWidget: (_, __, ___) => const Icon(
                      Icons.broken_image, color: Colors.white, size: 80),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class PostDetailScreen extends StatefulWidget {
  final String postId;
  final bool isAdmin;

  const PostDetailScreen({
    Key? key,
    required this.postId,
    this.isAdmin = false,
  }) : super(key: key);

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  static const _adminEmail = 'yusung790926@gmail.com';
  static const int commentPreviewCount = 3;  // 미리볼 댓글 개수
  bool _showAllComments = false;             // 전체 보기 토글

  final ImagePicker _picker = ImagePicker();
  DocumentSnapshot<Map<String, dynamic>>? _doc;
  bool _isEditing = false;
  final TextEditingController _titleCtrl = TextEditingController();
  final TextEditingController _contentCtrl = TextEditingController();
  final TextEditingController _commentCtrl = TextEditingController();

  final List<String> _images = [];
  final List<XFile> _newImages = [];
  final Set<int> _deletedImages = {};
  int _currentImageIndex = 0;

  late final DocumentReference<Map<String, dynamic>> postRef;
  late final CollectionReference<Map<String, dynamic>> likesRef;
  late final String uid;

  @override
  void initState() {
    super.initState();
    // 레퍼런스 준비
    postRef =
        FirebaseFirestore.instance.collection('posts').doc(widget.postId);
    likesRef = postRef.collection('likes');
    uid = FirebaseAuth.instance.currentUser!.uid;

    // 조회수 증가
    _incrementViewCount();
    // 데이터 로드
    _loadPost();
  }

  Future<void> _incrementViewCount() async {
    await FirebaseFirestore.instance.runTransaction((tx) async {
      final snap = await tx.get(postRef);
      final current = (snap.data()?['viewCount'] as int?) ?? 0;
      tx.update(postRef, {'viewCount': current + 1});
    });
  }

  Future<void> _toggleLike(bool isCurrentlyLiked) async {
    await FirebaseFirestore.instance.runTransaction((tx) async {
      final postSnap = await tx.get(postRef);
      final currentCount = (postSnap.data()?['likeCount'] as int?) ?? 0;

      final likeDoc = likesRef.doc(uid);
      if (isCurrentlyLiked) {
        tx.delete(likeDoc);
        tx.update(postRef, {'likeCount': currentCount - 1});
      } else {
        // 빈 맵을 Map<String, dynamic>으로 명시
        tx.set(likeDoc, <String, dynamic>{});
        tx.update(postRef, {'likeCount': currentCount + 1});
      }
    });
  }


  Future<void> _loadPost() async {
    final snap =
    await FirebaseFirestore.instance
        .collection('posts')
        .doc(widget.postId)
        .get();
    final data = snap.data() ?? {};
    if (!mounted) return;
    setState(() {
      _doc = snap;
      _titleCtrl.text = data[PostFields.title] as String? ?? '';
      _contentCtrl.text = data[PostFields.content] as String? ?? '';
      final rawImages = data[PostFields.images];
      _images
        ..clear()
        ..addAll(
            (rawImages is List) ? rawImages.whereType<String>() : <String>[]);
      _newImages.clear();
      _deletedImages.clear();
    });
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _contentCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImages() async {
    final picked = await _picker.pickMultiImage(imageQuality: 85);
    if (picked != null && picked.isNotEmpty) {
      setState(() {
        _newImages
          ..clear()
          ..addAll(picked);
        _deletedImages.clear();
      });
    }
  }

  void _deleteNetworkImage(int idx) {
    setState(() => _deletedImages.add(idx));
  }

  void _deleteLocalImage(int idx) {
    setState(() => _newImages.removeAt(idx));
  }

  Future<List<String>> _uploadImages() async {
    if (_newImages.isEmpty) {
      return [
        for (int i = 0; i < _images.length; i++)
          if (!_deletedImages.contains(i)) _images[i]
      ];
    }
    final ref = FirebaseStorage.instance.ref();
    final futures = _newImages.map((img) async {
      final name = '${DateTime
          .now()
          .millisecondsSinceEpoch}_${img.name}';
      final upload =
      await ref.child('post_images/${widget.postId}/$name').putFile(
        File(img.path),
      );
      return await upload.ref.getDownloadURL();
    }).toList();
    return await Future.wait(futures);
  }

  Future<void> _saveChanges() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;
      final userSnap =
      await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
      final u = userSnap.data();
      final nickname = u?['nickname'] ?? '(알 수 없는 사용자)';
      final level = u?['level'];
      final photoUrl = u?['photoUrl'];

      final urls = await _uploadImages();

      await postRef.update({
        PostFields.title: _titleCtrl.text.trim(),
        PostFields.content: _contentCtrl.text.trim(),
        PostFields.images: urls,
        'nickname': nickname,
        'level': level,
        'photoUrl': photoUrl,
        PostFields.isPinned: _doc!.data()![PostFields.isPinned] ?? false,
      });

      if (!mounted) return;
      setState(() => _isEditing = false);
      await _loadPost();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('수정 실패: 권한 또는 서버 오류')),
      );
    }
  }

  Future<void> _deletePost() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) =>
          AlertDialog(
            title: const Text('게시글 삭제'),
            content: const Text('정말 삭제하시겠습니까?'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('취소')),
              TextButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('삭제')),
            ],
          ),
    );
    if (ok != true) return;

    final batch = FirebaseFirestore.instance.batch();
    final commentsSnap = await postRef.collection('comments').get();
    for (var c in commentsSnap.docs) {
      batch.delete(c.reference);
    }
    batch.delete(postRef);
    await batch.commit();
    Navigator.pop(context);
  }

  Future<void> _addComment(String text) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final userSnap =
    await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
    final u = userSnap.data();
    final nickname = u?['nickname'] ?? '(알 수 없는 사용자)';
    final level = u?['level'];
    final photoUrl = u?['photoUrl'];

    final commentRef = await postRef.collection('comments').add({
      CommentFields.text: text,
      CommentFields.userId: user.uid,
      CommentFields.timestamp: FieldValue.serverTimestamp(),
      'postId': widget.postId,
      'nickname': nickname,
      'level': level,
      'photoUrl': photoUrl,
    });

    final postDoc = await postRef.get();
    final postOwnerId = postDoc.data()?['userId'];
    if (postOwnerId != null && postOwnerId != user.uid) {
      await FirebaseFirestore.instance.collection('notifications').add({
        'receiverId': postOwnerId,
        'postId': widget.postId,
        'commentId': commentRef.id,
        'type': 'reply_to_post',
        'message':
        '${user.email ?? "사용자"}님이 회원님의 게시글에 댓글을 남겼습니다.',
        'timestamp': FieldValue.serverTimestamp(),
        'checked': false,
      });
    }

    _commentCtrl.clear();
    await updateUserPointAndLevel(addPoint: 0.5);
  }

  Future<void> _editComment(String cid, String currentText) async {
    final ctrl = TextEditingController(text: currentText);
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) =>
          AlertDialog(
            title: const Text('댓글 수정'),
            content: TextField(controller: ctrl, maxLines: null),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('취소')),
              TextButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('저장')),
            ],
          ),
    );
    if (ok != true) return;

    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    final userSnap =
    await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
    final u = userSnap.data();
    final nickname = u?['nickname'] ?? '(알 수 없는 사용자)';
    final level = u?['level'];
    final photoUrl = u?['photoUrl'];

    await postRef.collection('comments').doc(cid).update({
      CommentFields.text: ctrl.text.trim(),
      'nickname': nickname,
      'level': level,
      'photoUrl': photoUrl,
    });
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = FirebaseAuth.instance.currentUser;
    final currentUid = currentUser?.uid;
    final isAdmin =
        widget.isAdmin || (currentUser?.email == _adminEmail);

    if (_doc == null) {
      return const Scaffold(
          body: Center(child: CircularProgressIndicator()));
    }
    final data = _doc!.data()!;
    final title = data[PostFields.title] as String? ?? '';
    final ts = (data[PostFields.timestamp] as Timestamp?)
        ?.toDate()
        .toLocal();
    final ownerId = data[PostFields.userId] as String?;
    final canEditPost =
        isAdmin || (currentUid != null && ownerId == currentUid);

    return WillPopScope(
      onWillPop: () async {
        Navigator.of(context).pop();
        return false;
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            _isEditing ? '게시글 수정' : title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          actions: [
            if (canEditPost && !_isEditing) ...[
              IconButton(
                icon: const Icon(Icons.edit),
                onPressed: () => setState(() => _isEditing = true),
              ),
              IconButton(
                icon: const Icon(Icons.delete),
                onPressed: _deletePost,
              ),
            ],
            if (isAdmin && !_isEditing) // 관리자만 고정버튼 보임
              IconButton(
                icon: Icon(
                  (_doc?.data()?[PostFields.isPinned] ?? false)
                      ? Icons.push_pin
                      : Icons.push_pin_outlined,
                ),
                tooltip: '고정/해제',
                onPressed: () async {
                  final current = _doc!.data()?[PostFields.isPinned] as bool? ?? false;
                  await postRef.update({PostFields.isPinned: !current});
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(!current ? '고정 공지로 설정됨' : '고정 공지가 해제됨'),
                    ),
                  );
                  await _loadPost(); // 다시 로드해서 상태 반영
                },
              ),
          ],
        ),

        body: _isEditing
            ? _buildEditView()
            : Column(
          children: [
            Expanded(flex: 3,
                child:
                _buildReadView(data, ts, ownerId)),
            const Divider(height: 1),
            Expanded(
                flex: 2,
                child: _buildCommentList(
                    isAdmin, currentUid)),
          ],
        ),
        bottomNavigationBar:
        !_isEditing ? _buildCommentInput() : null,
      ),
    );
  }

  Widget _buildReadView(Map<String, dynamic> data, DateTime? ts,
      String? ownerId) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // … 기존 프로필/타임스탬프/이미지/텍스트 …
        if (ts != null)
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              ownerId == null || ownerId.isEmpty
                  ? const CircleAvatar(
                radius: 18,
                backgroundColor: Colors.grey,
                child: Icon(Icons.person,
                    size: 21, color: Colors.white),
              )
                  : GestureDetector(
                onTap: () =>
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) =>
                            UserProfileScreen(userId: ownerId),
                      ),
                    ),
                child: ProfileWithCrown(
                  photoUrl: data['photoUrl'],
                  level: data['level'],
                  displayType: 'profile',
                  radius: 18,
                  crownSize: 18,
                  showNickname: false,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment:
                  CrossAxisAlignment.start,
                  children: [
                    Text(
                      (data['nickname'] as String?)
                          ?.isNotEmpty ==
                          true
                          ? data['nickname']
                          : '(알 수 없는 사용자)',
                      style: const TextStyle(
                          fontWeight: FontWeight.w500,
                          fontSize: 15),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '작성시간: ${_formatDate(ts)}',
                      style: const TextStyle(
                          fontSize: 12,
                          color: Colors.black54),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),

        const SizedBox(height: 16),

        // 이미지 슬라이드 표시 (추가)
        if (_images.isNotEmpty)
          SizedBox(
            height: 220,
            child: PageView.builder(
              itemCount: _images.length,
              onPageChanged: (idx) {
                setState(() => _currentImageIndex = idx);
              },
              itemBuilder: (_, idx) {
                return GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => FullscreenPhotoViewer(
                          urls: _images,
                          initialIndex: idx, // ← URL 직접 전달
                        ),
                      ),
                    );
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8.0),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: CachedNetworkImage(
                        imageUrl: _images[idx], // downloadURL일 경우 바로 표시됨
                        fit: BoxFit.cover,
                        placeholder: (_, __) => const Center(child: CircularProgressIndicator()),
                        errorWidget: (_, __, ___) => const Icon(Icons.broken_image),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),



        if (_images.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                _images.length,
                    (index) =>
                    Container(
                      width: 8,
                      height: 8,
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _currentImageIndex == index
                            ? Colors.black
                            : Colors.grey[300],
                      ),
                    ),
              ),
            ),
          ),

        const SizedBox(height: 16),

        SelectableText(
          data[PostFields.content] as String? ?? '',
          style: const TextStyle(fontSize: 16),
        ),

        // ──────────────────────────────────────────
        // 조회수 + 좋아요 영역
        // 기존에 FutureBuilder로 하던 부분을 다음과 같이 교체

        StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: postRef.snapshots(), // ← 실시간 스트림으로 변경!
          builder: (ctx, snap) {
            if (!snap.hasData) return const SizedBox();
            final data = snap.data!.data()!;
            final viewCount = (data['viewCount'] as int?) ?? 0;
            final likeCount = (data['likeCount'] as int?) ?? 0;

            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
              child: Row(
                children: [
                  // 조회수
                  const Icon(
                      Icons.remove_red_eye, size: 18, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text('$viewCount'),

                  const Spacer(),

                  // 좋아요
                  StreamBuilder<bool>(
                    stream: likesRef
                        .doc(uid)
                        .snapshots()
                        .map((doc) => doc.exists),
                    builder: (ctx2, likeSnap) {
                      final isLiked = likeSnap.data ?? false;
                      return Row(
                        children: [
                          IconButton(
                            icon: Icon(
                              isLiked
                                  ? Icons.favorite
                                  : Icons.favorite_border,
                              color: isLiked ? Colors.red : Colors.grey,
                            ),
                            onPressed: () => _toggleLike(isLiked),
                          ),
                          Text('$likeCount'),
                        ],
                      );
                    },
                  ),
                ],
              ),
            );
          },
        ),


      ],
    );
  }

  Widget _buildCommentList(bool isAdmin, String? currentUid) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: postRef
          .collection('comments')
          .orderBy(CommentFields.timestamp)
          .snapshots(),
      builder: (ctx, snap) {
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final allDocs = snap.data!.docs;
        // 🔥 미리보기 vs 전체
        final displayDocs = _showAllComments
            ? allDocs
            : allDocs.take(commentPreviewCount).toList();

        if (displayDocs.isEmpty) {
          return const Center(child: Text('등록된 댓글이 없습니다.'));
        }

        return ListView.separated(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: displayDocs.length +
              (_showAllComments || allDocs.length <= commentPreviewCount ? 0 : 1),
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            // — 댓글 아이템
            if (index < displayDocs.length) {
              final doc = displayDocs[index];
              final cd = doc.data();
              final cid = doc.id;
              final authorId = cd[CommentFields.userId] as String?;
              final canEdit = isAdmin || (authorId == currentUid);
              final tsRaw = cd[CommentFields.timestamp] as Timestamp?;
              final ts = tsRaw?.toDate().toLocal();
              final timeStr = ts != null ? _formatDate(ts) : '';

              return _buildCommentTile(
                commentId: cid,
                data: cd,
                timeLabel: timeStr,
                canEdit: canEdit,
              );
            }

            // — 더보기 버튼
            return Center(
              child: TextButton(
                onPressed: () => setState(() => _showAllComments = true),
                child: const Text('더보기'),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildCommentTile({
    required String commentId,
    required Map<String, dynamic> data,
    required String timeLabel,
    required bool canEdit,
  }) {
    final authorId = data[CommentFields.userId] as String?;
    return Column(
      children: [
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 12),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(10),
          ),
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => CommentDetailScreen(
                  parentPostId: widget.postId,
                  commentId: commentId,
                ),
              ),
            ),
            title: Row(
              children: [
                authorId == null || authorId.isEmpty
                    ? const CircleAvatar(
                  radius: 12,
                  backgroundColor: Colors.grey,
                  child: Icon(Icons.person,
                      size: 15, color: Colors.white),
                )
                    : GestureDetector(
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) =>
                          UserProfileScreen(userId: authorId),
                    ),
                  ),
                  child: ProfileWithCrown(
                    photoUrl: data['photoUrl'],
                    level: data['level'],
                    displayType: 'comment',
                    radius: 12,
                    crownSize: 12,
                    showNickname: false,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${data['nickname'] ?? '(알 수 없는 사용자)'} · $timeLabel',
                    style: const TextStyle(
                        fontSize: 13, color: Colors.black87),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                data[CommentFields.text] as String? ?? '',
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 15),
              ),
            ),
            trailing: canEdit
                ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.edit, size: 20),
                  onPressed: () => _editComment(
                    commentId,
                    data[CommentFields.text] as String? ?? '',
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.delete, size: 20),
                  onPressed: () async {
                    final confirmed = await showDialog<bool>(
                      context: context,
                      builder: (_) => AlertDialog(
                        title: const Text('댓글 삭제'),
                        content: const Text('정말 삭제하시겠습니까?'),
                        actions: [
                          TextButton(
                              onPressed: () =>
                                  Navigator.pop(context, false),
                              child: const Text('취소')),
                          TextButton(
                              onPressed: () =>
                                  Navigator.pop(context, true),
                              child: const Text('삭제')),
                        ],
                      ),
                    );
                    if (confirmed == true) {
                      await postRef
                          .collection('comments')
                          .doc(commentId)
                          .delete();
                      // 댓글이 줄었을 때 _showAllComments 초기화
                      setState(() {
                        _showAllComments = false;
                      });
                    }
                  },
                ),
              ],
            )
                : null,
          ),
        ),
        const SizedBox(height: 12),
      ],
    );
  }


  Widget _buildCommentInput() =>
      SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery
                .of(context)
                .viewInsets
                .bottom,
            left: 8,
            right: 8,
            top: 4,
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _commentCtrl,
                  decoration: const InputDecoration(
                    hintText: '댓글을 입력하세요',
                    border: OutlineInputBorder(),
                  ),
                  onSubmitted: (t) =>
                  t
                      .trim()
                      .isNotEmpty ? _addComment(t) : null,
                  maxLines: 1,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.send),
                onPressed: () {
                  final t = _commentCtrl.text.trim();
                  if (t.isNotEmpty) _addComment(t);
                },
              ),
            ],
          ),
        ),
      );

  String _formatDate(DateTime dt) {
    final y = dt.year.toString().padLeft(4, '0');
    final mo = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final h = dt.hour.toString().padLeft(2, '0');
    final mi = dt.minute.toString().padLeft(2, '0');
    return '$y-$mo-$d $h:$mi';
  }

  Widget _buildEditView() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: _titleCtrl,
          decoration: const InputDecoration(labelText: '제목'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _contentCtrl,
          decoration: const InputDecoration(labelText: '내용'),
          maxLines: 8,
        ),
        const SizedBox(height: 12),

        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            ElevatedButton.icon(
              onPressed: _pickImages,
              icon: const Icon(Icons.photo),
              label: const Text('사진 선택'),
            ),
            ElevatedButton.icon(
              onPressed: _saveChanges,
              icon: const Icon(Icons.save),
              label: const Text('저장'),
            ),
          ],
        ),

        const SizedBox(height: 16),

        if (_newImages.isNotEmpty)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: List.generate(
              _newImages.length,
                  (i) =>
                  Stack(
                    children: [
                      Image.file(
                        File(_newImages[i].path),
                        width: 100,
                        height: 100,
                        fit: BoxFit.cover,
                      ),
                      Positioned(
                        right: 0,
                        top: 0,
                        child: GestureDetector(
                          onTap: () => _deleteLocalImage(i),
                          child: const CircleAvatar(
                            radius: 12,
                            backgroundColor: Colors.black54,
                            child: Icon(
                                Icons.close, size: 16, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
            ),
          )
        else
          if (_images.isNotEmpty)
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: List.generate(
                _images.length,
                    (i) =>
                _deletedImages.contains(i)
                    ? const SizedBox()
                    : Stack(
                  children: [
                    CachedNetworkImage(
                      imageUrl: _images[i],
                      width: 100,
                      height: 100,
                      fit: BoxFit.cover,
                    ),
                    Positioned(
                      right: 0,
                      top: 0,
                      child: GestureDetector(
                        onTap: () => _deleteNetworkImage(i),
                        child: const CircleAvatar(
                          radius: 12,
                          backgroundColor: Colors.black54,
                          child: Icon(Icons.close, size: 16, color: Colors
                              .white),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}
