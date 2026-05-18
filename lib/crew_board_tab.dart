import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import 'crew_post_write_screen.dart';
import 'crew_post_detail_screen.dart';
import 'common/profile_with_crown.dart';

class CrewBoardTab extends StatefulWidget {
  final String crewId;
  final bool isMember;

  const CrewBoardTab({required this.crewId, required this.isMember, Key? key}) : super(key: key);

  @override
  State<CrewBoardTab> createState() => _CrewBoardTabState();
}

class _CrewBoardTabState extends State<CrewBoardTab> {
  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    return Scaffold(
      appBar: AppBar(title: Text('크루 게시판')),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('crews')
            .doc(widget.crewId)
            .collection('crewPosts')
            .orderBy('createdAt', descending: true)
            .snapshots(),
        builder: (context, snap) {
          if (!snap.hasData) return Center(child: CircularProgressIndicator());
          final docs = snap.data!.docs;
          if (docs.isEmpty) return Center(child: Text('게시글이 없습니다.'));
          return ListView.builder(
            padding: EdgeInsets.all(14),
            itemCount: docs.length,
            itemBuilder: (context, idx) {
              final post = docs[idx].data() as Map<String, dynamic>;
              final postId = docs[idx].id;
              final images = (post['images'] as List<dynamic>? ?? []).cast<String>();
              final imgUrl = images.isNotEmpty ? images[0] : null;

              // 프로필 정보
              final nickname = post['nickname'] ?? '익명';
              final photoUrl = post['photoUrl'] ?? '';
              final level = post['level']?.toString() ?? '';

              return Card(
                margin: EdgeInsets.only(bottom: 14),
                child: InkWell(
                  onTap: () async {
                    final result = await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => CrewPostDetailScreen(
                          crewId: widget.crewId,
                          postId: postId,
                        ),
                      ),
                    );
                    if (result == true) setState(() {});
                  },
                  borderRadius: BorderRadius.circular(10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 대표 이미지 (좌측)
                      Container(
                        margin: EdgeInsets.all(10),
                        child: imgUrl != null && imgUrl.isNotEmpty
                            ? ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(
                            imgUrl,
                            width: 64, height: 64, fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Icon(Icons.image_not_supported, size: 40),
                          ),
                        )
                            : Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: Colors.grey[300],
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(Icons.image, color: Colors.grey[400], size: 38),
                        ),
                      ),

                      // 우측: 프로필+글 정보
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12.0, horizontal: 4),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // 프로필+닉네임+날짜 한 줄
                              Row(
                                children: [
                                  ProfileWithCrown(
                                    photoUrl: photoUrl,
                                    level: level,
                                    displayType: 'comment',
                                    radius: 15,    // 리스트용 최적 크기
                                    crownSize: 15,
                                    showNickname: false,
                                  ),
                                  SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      nickname,
                                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  SizedBox(width: 8),
                                  Text(
                                    (post['createdAt'] is Timestamp)
                                        ? _formatDate(post['createdAt'])
                                        : '',
                                    style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              // 제목
                              Text(
                                post['title'] ?? '',
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
                                maxLines: 1, overflow: TextOverflow.ellipsis,
                              ),
                              // 간단히 내용 한줄 요약
                              if ((post['content'] ?? '').toString().isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: Text(
                                    (post['content'] ?? '').toString(),
                                    style: TextStyle(fontSize: 12, color: Colors.black54),
                                    maxLines: 1, overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                      // 수정(본인) 버튼
                      if (uid != null && uid == post['authorUid'])
                        Padding(
                          padding: const EdgeInsets.only(right: 4, top: 6),
                          child: IconButton(
                            icon: Icon(Icons.edit, size: 18, color: Colors.grey[600]),
                            onPressed: () async {
                              final result = await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => CrewPostWriteScreen(
                                    crewId: widget.crewId,
                                    editPostId: postId,
                                    initial: post,
                                  ),
                                ),
                              );
                              if (result == true) setState(() {});
                            },
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: (widget.isMember && uid != null)
          ? FloatingActionButton.extended(
        icon: Icon(Icons.edit),
        label: Text('글쓰기'),
        onPressed: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CrewPostWriteScreen(
                crewId: widget.crewId,
              ),
            ),
          );
          if (result == true) setState(() {});
        },
      )
          : null,
    );
  }

  /// 날짜 YYYY-MM-DD HH:mm 형식
  String _formatDate(dynamic ts) {
    if (ts is Timestamp) {
      final dt = ts.toDate();
      final y = dt.year.toString().padLeft(4, '0');
      final m = dt.month.toString().padLeft(2, '0');
      final d = dt.day.toString().padLeft(2, '0');
      final h = dt.hour.toString().padLeft(2, '0');
      final min = dt.minute.toString().padLeft(2, '0');
      return "$y-$m-$d $h:$min";
    }
    return '';
  }
}
