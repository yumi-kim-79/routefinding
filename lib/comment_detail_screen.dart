import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:app_badger/app_badger.dart';
import 'constants/firestore_fields.dart';
import 'user_profile_screen.dart';
import '../common/profile_with_crown.dart';

class CommentDetailScreen extends StatefulWidget {
  final String parentPostId;
  final String commentId;

  const CommentDetailScreen({
    Key? key,
    required this.parentPostId,
    required this.commentId,
  }) : super(key: key);

  @override
  State<CommentDetailScreen> createState() => _CommentDetailScreenState();
}

class _CommentDetailScreenState extends State<CommentDetailScreen> {
  static const _adminEmail = 'yusung790926@gmail.com';

  // 이미 조회수 증가 처리된 대댓글 ID 저장
  final Set<String> _countedReplies = {};

  late final DocumentReference<Map<String, dynamic>> _commentRef;
  late final CollectionReference<Map<String, dynamic>> _commentLikesRef;
  late final String _uid;

  DocumentSnapshot<Map<String, dynamic>>? _commentSnap;
  bool _isLoading = true;
  bool _isEditing = false;
  final _editController = TextEditingController();
  final _replyController = TextEditingController();
  bool _isReplying = false;
  bool _isReplySending = false;

  @override
  void initState() {
    super.initState();

    // Firestore 레퍼런스 초기화
    _commentRef = FirebaseFirestore.instance
        .collection('posts')
        .doc(widget.parentPostId)
        .collection('comments')
        .doc(widget.commentId);
    _commentLikesRef = _commentRef.collection('likes');
    _uid = FirebaseAuth.instance.currentUser!.uid;

    // 댓글 조회수 1 증가
    _incrementCommentViewCount();

    // 댓글 데이터 로드
    _fetchComment();

    // 앱 배지 업데이트
    WidgetsBinding.instance.addPostFrameCallback((_) {
      updateAppBadge();
    });
  }

  @override
  void dispose() {
    _editController.dispose();
    _replyController.dispose();
    super.dispose();
  }

  // ─ 댓글 조회수 증가 ─
  Future<void> _incrementCommentViewCount() async {
    await FirebaseFirestore.instance.runTransaction((tx) async {
      final snap = await tx.get(_commentRef);
      final current = (snap.data()?['viewCount'] as int?) ?? 0;
      tx.update(_commentRef, {'viewCount': current + 1});
    });
  }

  // ─ 대댓글 조회수 증가 ─
  Future<void> _incrementReplyViewCount(DocumentReference<Map<String, dynamic>> replyRef) async {
    await FirebaseFirestore.instance.runTransaction((tx) async {
      final snap = await tx.get(replyRef);
      final current = (snap.data()?['viewCount'] as int?) ?? 0;
      tx.update(replyRef, {'viewCount': current + 1});
    });
  }

  // ─ 댓글 단일 로드 ─
  Future<void> _fetchComment() async {
    try {
      final snap = await _commentRef.get();
      if (!snap.exists) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('댓글을 찾을 수 없습니다.')));
          Navigator.of(context).pop();
        }
        return;
      }
      setState(() {
        _commentSnap = snap;
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('댓글 로드 오류: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('댓글 불러오기 중 오류가 발생했습니다.')));
        Navigator.of(context).pop();
      }
    }
  }

  // ─ 댓글 수정 ─
  Future<void> _editComment() async {
    if (_commentSnap == null) return;
    final data = _commentSnap!.data()!;
    _editController.text = data[CommentFields.text] as String? ?? '';
    setState(() => _isEditing = true);

    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('댓글 수정'),
        content: TextField(controller: _editController, maxLines: null, decoration: const InputDecoration(border: OutlineInputBorder())),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('취소')),
          TextButton(onPressed: () => Navigator.pop(context, true),  child: const Text('저장')),
        ],
      ),
    );
    if (ok == true && _editController.text.trim().isNotEmpty) {
      try {
        final user = FirebaseAuth.instance.currentUser!;
        final uSnap = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
        final u = uSnap.data() ?? {};
        await _commentRef.update({
          CommentFields.text: _editController.text.trim(),
          CommentFields.timestamp: FieldValue.serverTimestamp(),
          'nickname': u['nickname'] ?? '(알 수 없는 사용자)',
          'level':     u['level'],
          'photoUrl':  u['photoUrl'],
        });
        final updated = await _commentRef.get();
        setState(() => _commentSnap = updated);
      } catch (e) {
        debugPrint('댓글 수정 오류: $e');
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('댓글 수정에 실패했습니다.')));
      }
    } else if (ok == true) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('내용이 비어 있습니다.')));
    }
    setState(() => _isEditing = false);
  }

  // ─ 댓글 삭제 ─
  Future<void> _deleteComment() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('댓글 삭제'),
        content: const Text('정말 삭제하시겠습니까?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('취소')),
          TextButton(onPressed: () => Navigator.pop(context, true),  child: const Text('삭제')),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await _commentRef.delete();
        if (mounted) Navigator.of(context).pop();
      } catch (e) {
        debugPrint('댓글 삭제 오류: $e');
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('삭제에 실패했습니다.')));
      }
    }
  }

  // ─ 댓글 좋아요 토글 ─
  Future<void> _toggleLike(bool isLiked) async {
    await FirebaseFirestore.instance.runTransaction((tx) async {
      final cs = await tx.get(_commentRef);
      final curr = (cs.data()?['likes'] as int?) ?? 0;
      final likeDoc = _commentLikesRef.doc(_uid);
      if (isLiked) {
        tx.delete(likeDoc);
        tx.update(_commentRef, {'likes': curr - 1});
      } else {
        tx.set(likeDoc, <String, dynamic>{});
        tx.update(_commentRef, {'likes': curr + 1});
      }
    });
  }

  // ─ 대댓글 작성 ─
  Future<void> _sendReply() async {
    if (_isReplySending) return;
    final user = FirebaseAuth.instance.currentUser!;
    final text = _replyController.text.trim();
    if (text.isEmpty) return;
    setState(() => _isReplySending = true);

    try {
      final uSnap = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
      final u = uSnap.data() ?? {};
      final replyRef = await _commentRef.collection('replies').add({
        'userId':    user.uid,
        'nickname':  u['nickname'] ?? '(알 수 없는 사용자)',
        'level':     u['level'],
        'photoUrl':  u['photoUrl'],
        'text':      text,
        'timestamp': FieldValue.serverTimestamp(),
        'viewCount': 0,
        'likes':     0,
      });
      final commentOwner = _commentSnap!.data()?[CommentFields.userId] as String?;
      if (commentOwner != null && commentOwner != user.uid) {
        await FirebaseFirestore.instance.collection('notifications').add({
          'receiverId': commentOwner,
          'postId':     widget.parentPostId,
          'commentId':  widget.commentId,
          'replyId':    replyRef.id,
          'type':       'reply_to_comment',
          'message':    '${user.email ?? '사용자'}님이 댓글에 답글을 남겼습니다.',
          'timestamp':  FieldValue.serverTimestamp(),
          'checked':    false,
        });
        await updateAppBadge();
      }
      setState(() {
        _isReplySending = false;
        _isReplying = false;
        _replyController.clear();
      });
    } catch (e) {
      debugPrint('대댓글 오류: $e');
      setState(() => _isReplySending = false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('대댓글 생성에 실패했습니다.')));
    }
  }

  // ─ 대댓글 수정 ─
  Future<void> _editReply(QueryDocumentSnapshot<Map<String, dynamic>> doc) async {
    final ctrl = TextEditingController(text: doc.data()['text'] as String? ?? '');
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('대댓글 수정'),
        content: TextField(controller: ctrl, maxLines: null, decoration: const InputDecoration(border: OutlineInputBorder())),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('취소')),
          TextButton(onPressed: () => Navigator.pop(context, true),  child: const Text('저장')),
        ],
      ),
    );
    if (ok == true && ctrl.text.trim().isNotEmpty) {
      try {
        final user = FirebaseAuth.instance.currentUser!;
        final uSnap = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
        final u = uSnap.data() ?? {};
        await doc.reference.update({
          'text':      ctrl.text.trim(),
          'timestamp': FieldValue.serverTimestamp(),
          'nickname':  u['nickname'] ?? '(알 수 없는 사용자)',
          'level':     u['level'],
          'photoUrl':  u['photoUrl'],
        });
      } catch (e) {
        debugPrint('대댓글 수정 오류: $e');
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('대댓글 수정에 실패했습니다.')));
      }
    }
  }

  // ─ 대댓글 삭제 ─
  Future<void> _deleteReply(QueryDocumentSnapshot<Map<String, dynamic>> doc) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('대댓글 삭제'),
        content: const Text('정말 삭제하시겠습니까?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('취소')),
          TextButton(onPressed: () => Navigator.pop(context, true),  child: const Text('삭제')),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await doc.reference.delete();
      } catch (e) {
        debugPrint('삭제 오류: $e');
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('삭제에 실패했습니다.')));
      }
    }
  }

  // ─ 대댓글 좋아요 토글 ─
  Future<void> _toggleReplyLike(
      DocumentReference<Map<String, dynamic>> replyRef,
      bool isLiked,
      ) async {
    final uid = FirebaseAuth.instance.currentUser!.uid;
    final likeDoc = replyRef.collection('likes').doc(uid);
    await FirebaseFirestore.instance.runTransaction((tx) async {
      final snap = await tx.get(replyRef);
      final curr = (snap.data()?['likes'] as int?) ?? 0;
      if (isLiked) {
        tx.delete(likeDoc);
        tx.update(replyRef, {'likes': curr - 1});
      } else {
        tx.set(likeDoc, <String, dynamic>{});
        tx.update(replyRef, {'likes': curr + 1});
      }
    });
  }

  // ─ 앱 배지 업데이트 ─
  static Future<void> updateAppBadge() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    final snap = await FirebaseFirestore.instance
        .collection('notifications')
        .where('receiverId', isEqualTo: uid)
        .where('checked',     isEqualTo: false)
        .get();
    final count = snap.docs.length;
    if (count > 0) {
      await AppBadger.updateBadgeCount(count);
    } else {
      await AppBadger.removeBadge();
    }
  }

  // ─ 날짜 포맷 ─
  String _formatDate(DateTime dt) {
    final y  = dt.year.toString().padLeft(4, '0');
    final mo = dt.month.toString().padLeft(2, '0');
    final d  = dt.day.toString().padLeft(2, '0');
    final h  = dt.hour.toString().padLeft(2, '0');
    final mi = dt.minute.toString().padLeft(2, '0');
    return '$y-$mo-$d $h:$mi';
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('댓글 상세')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_commentSnap == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('댓글 상세')),
        body: const Center(child: Text('댓글을 찾을 수 없습니다.')),
      );
    }

    final data       = _commentSnap!.data()!;
    final authorUid  = data[CommentFields.userId]  as String? ?? '';
    final nickname   = data['nickname']            as String? ?? '(알 수 없는 사용자)';
    final photoUrl   = data['photoUrl']            as String? ?? '';
    final level      = data['level']               as String?;
    final rawText    = data[CommentFields.text]    as String? ?? '';
    final ts         = (data[CommentFields.timestamp] as Timestamp?)?.toDate().toLocal();
    final currentUid = FirebaseAuth.instance.currentUser?.uid;
    final isAdmin    = FirebaseAuth.instance.currentUser?.email == _adminEmail;
    final isAuthor   = currentUid != null && currentUid == authorUid;

    return Scaffold(
      appBar: AppBar(
        title: const Text('댓글 상세'),
        actions: [
          if (isAuthor || isAdmin) ...[
            IconButton(icon: const Icon(Icons.edit),   tooltip: '댓글 수정', onPressed: _isEditing ? null : _editComment),
            IconButton(icon: const Icon(Icons.delete), tooltip: '댓글 삭제', onPressed: _deleteComment),
          ],
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

          // ─ 댓글 상단 ─
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            GestureDetector(
              onTap: authorUid.isNotEmpty
                  ? () => Navigator.push(context, MaterialPageRoute(builder: (_) => UserProfileScreen(userId: authorUid)))
                  : null,
              child: ProfileWithCrown(
                photoUrl:     photoUrl,
                level:        level,
                nickname:     nickname,
                displayType:  'comment',
                radius:       16,
                crownSize:    16,
                showNickname: false,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Flexible(child: Text(nickname, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15))),
                Text(ts != null ? _formatDate(ts) : '', style: const TextStyle(fontSize: 13, color: Colors.grey)),
              ]),
              const SizedBox(height: 4),
              SelectableText(rawText, style: const TextStyle(fontSize: 16)),
            ])),
          ]),

          const SizedBox(height: 16),

          // ─ 댓글 조회수 + 좋아요 ─
          StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
            stream: _commentRef.snapshots(),
            builder: (ctx, snap) {
              if (!snap.hasData) return const SizedBox();
              final d  = snap.data!.data()!;
              final vc = (d['viewCount'] as int?) ?? 0;
              final lc = (d['likes']     as int?) ?? 0;
              return Row(children: [
                const Icon(Icons.remove_red_eye, size: 18, color: Colors.grey),
                const SizedBox(width: 4),
                Text('$vc'),
                const Spacer(),
                StreamBuilder<bool>(
                  stream: _commentLikesRef.doc(_uid).snapshots().map((ds) => ds.exists),
                  builder: (c2, ls) {
                    final liked = ls.data ?? false;
                    return Row(children: [
                      IconButton(
                        icon: Icon(liked ? Icons.favorite : Icons.favorite_border, color: liked ? Colors.red : Colors.grey),
                        onPressed: () => _toggleLike(liked),
                      ),
                      Text('$lc'),
                    ]);
                  },
                ),
              ]);
            },
          ),

          const SizedBox(height: 16),

          // ─ 답글 입력 토글 ─
          ElevatedButton.icon(
            icon: const Icon(Icons.reply, size: 18),
            label: const Text('답글 달기'),
            style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), minimumSize: const Size(0, 32)),
            onPressed: () => setState(() => _isReplying = !_isReplying),
          ),
          if (_isReplying) ...[
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _replyController,
                  minLines: 1,
                  maxLines: 3,
                  decoration: const InputDecoration(hintText: '대댓글을 입력하세요', border: OutlineInputBorder(), isDense: true),
                  enabled: !_isReplySending,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: _isReplySending
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.send, color: Colors.blue),
                onPressed: _isReplySending ? null : _sendReply,
              ),
            ]),
          ],

          const SizedBox(height: 18),
          const Text('답글', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),

          // ─ 대댓글 리스트 ─
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: _commentRef.collection('replies').orderBy('timestamp', descending: false).snapshots(),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text('답글 로드 중 오류: ${snapshot.error}', style: const TextStyle(color: Colors.red)),
                  );
                }
                if (!snapshot.hasData) {
                  return const Padding(
                    padding: EdgeInsets.all(12),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                final replies = snapshot.data!.docs;
                if (replies.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text('아직 답글이 없습니다.', style: TextStyle(color: Colors.black54)),
                  );
                }
                final currentUid = FirebaseAuth.instance.currentUser?.uid;
                final isAdmin    = FirebaseAuth.instance.currentUser?.email == _adminEmail;

                return ListView.separated(
                  shrinkWrap: true,
                  physics: const AlwaysScrollableScrollPhysics(),
                  itemCount: replies.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final replyDoc = replies[i];
                    final r        = replyDoc.data();
                    final userId   = r['userId'] as String?;
                    final nick     = r['nickname'] as String? ?? '(알 수 없는 사용자)';
                    final photo    = r['photoUrl'] as String? ?? '';
                    final lvl      = r['level'] as String?;
                    final txt      = r['text'] as String? ?? '';
                    final tsReply  = (r['timestamp'] as Timestamp?)?.toDate();
                    final timeStr  = tsReply != null ? _formatDate(tsReply) : '';
                    final replyRef = replyDoc.reference;

                    // 조회수 1회만 증가
                    if (!_countedReplies.contains(replyDoc.id)) {
                      _incrementReplyViewCount(replyRef);
                      _countedReplies.add(replyDoc.id);
                    }

                    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      // 프로필·본문
                      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Padding(
                          padding: const EdgeInsets.only(top: 4.0),
                          child: GestureDetector(
                            onTap: (userId?.isNotEmpty ?? false)
                                ? () => Navigator.push(context, MaterialPageRoute(builder: (_) => UserProfileScreen(userId: userId!)))
                                : null,
                            child: ProfileWithCrown(
                              photoUrl:     photo,
                              level:        lvl,
                              nickname:     nick,
                              displayType:  'reply',
                              radius:       16,
                              crownSize:    16,
                              showNickname: false,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                            Flexible(child: Text(nick, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15))),
                            Text(timeStr, style: const TextStyle(fontSize: 13, color: Colors.grey)),
                          ]),
                          const SizedBox(height: 4),
                          SelectableText(txt, style: const TextStyle(fontSize: 15)),
                        ])),
                        if ((userId == currentUid) || isAdmin)
                          PopupMenuButton<String>(
                            onSelected: (value) async {
                              if (value == 'edit') {
                                await _editReply(replyDoc);
                              } else {
                                await _deleteReply(replyDoc);
                              }
                            },
                            itemBuilder: (_) => const [
                              PopupMenuItem(value: 'edit',   child: Text('수정')),
                              PopupMenuItem(value: 'delete', child: Text('삭제')),
                            ],
                          ),
                      ]),

                      const SizedBox(height: 8),

                      // 조회수 + 좋아요
                      StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
                        stream: replyRef.snapshots(),
                        builder: (ctx3, snap3) {
                          if (!snap3.hasData) return const SizedBox();
                          final d3   = snap3.data!.data()!;
                          final vc3  = (d3['viewCount'] as int?) ?? 0;
                          final lc3  = (d3['likes']     as int?) ?? 0;
                          return Padding(
                            padding: const EdgeInsets.only(left: 40.0),
                            child: Row(children: [
                              const Icon(Icons.remove_red_eye, size: 16, color: Colors.grey),
                              const SizedBox(width: 4),
                              Text('$vc3', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                              const SizedBox(width: 16),
                              if (currentUid != null)
                                StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                                  stream: replyRef.collection('likes').snapshots(),
                                  builder: (ctx4, snap4) {
                                    if (!snap4.hasData) return const SizedBox();
                                    final liked = snap4.data!.docs.any((d) => d.id == currentUid);
                                    return GestureDetector(
                                      onTap: () => _toggleReplyLike(replyRef, liked),
                                      child: Row(children: [
                                        Icon(liked ? Icons.favorite : Icons.favorite_border, size: 16, color: liked ? Colors.red : Colors.grey),
                                        const SizedBox(width: 4),
                                        Text('$lc3', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                                      ]),
                                    );
                                  },
                                ),
                            ]),
                          );
                        },
                      ),

                      const SizedBox(height: 12),
                    ]);
                  },
                );
              },
            ),
          ),
        ]),
      ),
    );
  }
}
