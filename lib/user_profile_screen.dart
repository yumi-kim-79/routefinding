import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:url_launcher/url_launcher.dart'; // 이메일 보내기
import '../common/profile_with_crown.dart';      // ← 왕관+등급 아바타
import 'post_detail_screen.dart'; // 작성글 보기

class UserProfileScreen extends StatelessWidget {
  final String userId;

  const UserProfileScreen({
    Key? key,
    required this.userId,
  }) : super(key: key);

  Future<void> _sendEmail(BuildContext context, String? email) async {
    if (email == null || email.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('이메일 정보가 없습니다.')),
      );
      return;
    }

    final Uri emailUri = Uri(
      scheme: 'mailto',
      path: email.trim(),
    );

    try {
      await launchUrl(emailUri, mode: LaunchMode.platformDefault);
    } catch (e) {
      debugPrint('이메일 앱 실행 실패: $e');

      final install = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('이메일 앱이 필요합니다'),
          content: const Text('이메일 앱을 실행할 수 없습니다. Gmail 앱을 설치하시겠습니까?'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('취소')),
            TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('설치')),
          ],
        ),
      );

      if (install == true) {
        final playStoreUrl = Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.gm");
        if (await canLaunchUrl(playStoreUrl)) {
          await launchUrl(playStoreUrl, mode: LaunchMode.externalApplication);
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        future: FirebaseFirestore.instance.collection('users').doc(userId).get(),
        builder: (ctx, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (!snap.hasData || !snap.data!.exists) {
            return const Center(child: Text('사용자를 찾을 수 없습니다.'));
          }
          final data = snap.data!.data()!;
          final nickname = data['nickname'] as String? ?? '(닉네임 없음)';
          final photoUrl = (data['photoUrl'] as String?)?.trim() ?? '';
          final intro = data['intro'] as String? ?? '소개가 없습니다.';
          final email = (data['email'] as String?)?.trim() ?? '';
          final level = data['level'] as String? ?? '5.6';
          final point = (data['point'] is int)
              ? data['point'] as int
              : int.tryParse(data['point']?.toString() ?? '0') ?? 0;

          return Stack(
            children: [
              Container(color: const Color(0xFF22232D)),
              Column(
                children: [
                  const SizedBox(height: 48),
                  // 👑 아바타+왕관+등급 표시 (ProfileWithCrown)
                  Center(
                    child: ProfileWithCrown(
                      photoUrl: photoUrl,
                      level: level,
                      nickname: nickname,
                      radius: 48,
                      levelFontSize: 18,   // 등급 글자 크기
                      levelBorderWidth: 6, // 등급 뱃지 테두리 두께
                    ),
                  ),
                  const SizedBox(height: 18),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 18.0),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(32),
                        child: Container(
                          color: Colors.white10,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const SizedBox(height: 16),
                              // [닉네임]
                              Center(
                                child: Text(
                                  nickname,
                                  style: const TextStyle(
                                    fontSize: 28,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(height: 10),
                              // [등급+포인트]
                              Center(
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                      decoration: BoxDecoration(
                                        color: Colors.black.withOpacity(0.18),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        '등급: $level',
                                        style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 15,
                                            fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                      decoration: BoxDecoration(
                                        color: Colors.black.withOpacity(0.18),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        '포인트: $point',
                                        style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 15),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 14),
                              // [소개글]
                              Center(
                                child: Text(
                                  intro,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    color: Colors.white70,
                                  ),
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                  textAlign: TextAlign.center,
                                ),
                              ),
                              const SizedBox(height: 18),
                              // [이메일]
                              if (email.isNotEmpty)
                                Center(
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(Icons.email,
                                          color: Colors.white54, size: 20),
                                      const SizedBox(width: 6),
                                      Text(
                                        email,
                                        style: const TextStyle(
                                            color: Colors.white70,
                                            fontSize: 14),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                              const Spacer(),
                              // [이메일 보내기/작성글 보기 버튼 영역]
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                                  children: [
                                    InkWell(
                                      onTap: email.isNotEmpty
                                          ? () => _sendEmail(context, email)
                                          : null,
                                      borderRadius: BorderRadius.circular(8),
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: const [
                                          Icon(Icons.mail_outline,
                                              color: Colors.white, size: 28),
                                          SizedBox(height: 5),
                                          Text('이메일 보내기',
                                              style: TextStyle(
                                                  color: Colors.white, fontSize: 13)),
                                        ],
                                      ),
                                    ),
                                    InkWell(
                                      onTap: () {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (_) => UserPostsScreen(
                                              userId: userId,
                                              nickname: nickname,
                                            ),
                                          ),
                                        );
                                      },
                                      borderRadius: BorderRadius.circular(8),
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: const [
                                          Icon(Icons.article_outlined,
                                              color: Colors.white, size: 28),
                                          SizedBox(height: 5),
                                          Text('작성글 보기',
                                              style: TextStyle(
                                                  color: Colors.white, fontSize: 13)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 20),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              // [뒤로가기]
              Positioned(
                top: 32,
                left: 14,
                child: SafeArea(
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back,
                        color: Colors.white, size: 34),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class UserPostsScreen extends StatelessWidget {
  final String userId;
  final String nickname;

  const UserPostsScreen({
    Key? key,
    required this.userId,
    required this.nickname,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final postsQuery = FirebaseFirestore.instance
        .collection('posts')
        .where('userId', isEqualTo: userId)
        .orderBy('timestamp', descending: true);

    return Scaffold(
      appBar: AppBar(
        title: Text('$nickname님의 작성글'),
      ),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: postsQuery.snapshots(),
        builder: (ctx, snap) {
          if (snap.hasError) {
            return Center(child: Text('에러 발생: ${snap.error}'));
          }
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final docs = snap.data!.docs;
          if (docs.isEmpty) {
            return const Center(child: Text('작성된 글이 없습니다.'));
          }
          return ListView.builder(
            itemCount: docs.length,
            itemBuilder: (_, i) {
              final d = docs[i].data();
              final postId = docs[i].id;
              final title = d['title'] as String? ?? '(제목 없음)';
              final content = d['content'] as String? ?? '';
              final snippet = content.length > 30
                  ? content.substring(0, 30) + '...'
                  : content;
              final ts = (d['timestamp'] as Timestamp?)?.toDate();

              return ListTile(
                title:
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: ts != null
                    ? Text(
                  '${_formatDate(ts)} · $snippet',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                )
                    : Text(snippet, maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => PostDetailScreen(postId: postId),
                    ),
                  );
                },
              );
            },
          );
        },
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
