import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class CrewChatRoomScreen extends StatefulWidget {
  final String crewId;
  const CrewChatRoomScreen({required this.crewId, Key? key}) : super(key: key);

  @override
  State<CrewChatRoomScreen> createState() => _CrewChatRoomScreenState();
}

class _CrewChatRoomScreenState extends State<CrewChatRoomScreen> {
  final _ctrl = TextEditingController();
  bool _sending = false;

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;

    setState(() => _sending = true);
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('로그인이 필요합니다')),
      );
      setState(() => _sending = false);
      return;
    }

    try {
      final profileDoc = await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .get();
      final profile = profileDoc.data() ?? {};
      final nickname = (profile['nickname'] ?? user.email ?? '익명').toString();
      final photoUrl = (profile['photoUrl'] ?? '').toString();
      final level = (profile['level'] ?? '').toString();

      final msgData = {
        'text': text,
        'senderUid': user.uid,
        'nickname': nickname,
        'photoUrl': photoUrl,
        'level': level,
        'createdAt': FieldValue.serverTimestamp(),
      };

      debugPrint('✅ 전송되는 메시지: $msgData');

      await FirebaseFirestore.instance
          .collection('crews')
          .doc(widget.crewId)
          .collection('chatMessages')
          .add(msgData);
    } catch (err) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('메시지 전송 실패: $err')),
      );
      debugPrint('💥 채팅 전송 에러: $err');
    } finally {
      _ctrl.clear();
      setState(() => _sending = false);
    }
  }


  @override
  Widget build(BuildContext context) {
    final ref = FirebaseFirestore.instance
        .collection('crews')
        .doc(widget.crewId)
        .collection('chatMessages')
        .orderBy('createdAt', descending: true);

    return Scaffold(
      appBar: AppBar(title: const Text('크루 채팅방')),
      body: Column(
        children: [
          Expanded(
            child: StreamBuilder<QuerySnapshot>(
              stream: ref.snapshots(),
              builder: (ctx, snap) {
                debugPrint(
                  '🔄 snapshot state=${snap.connectionState} '
                      'hasData=${snap.hasData} '
                      'docs=${snap.data?.docs.length}',
                );

                if (snap.hasError) {
                  return Center(
                    child: Text(
                      '채팅 로드 중 오류 발생:\n${snap.error}',
                      textAlign: TextAlign.center,
                    ),
                  );
                }
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                final docs = snap.data?.docs ?? [];
                if (docs.isEmpty) {
                  return const Center(child: Text('아직 채팅이 없습니다'));
                }

                return ListView.builder(
                  reverse: true,
                  itemCount: docs.length,
                  itemBuilder: (ctx, i) {
                    final msg = docs[i].data() as Map<String, dynamic>;
                    final isMine = msg['senderUid'] ==
                        FirebaseAuth.instance.currentUser?.uid;

                    return Align(
                      alignment:
                      isMine ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.symmetric(
                            vertical: 4, horizontal: 10),
                        padding: const EdgeInsets.symmetric(
                            vertical: 8, horizontal: 12),
                        decoration: BoxDecoration(
                          color: isMine ? Colors.blue[100] : Colors.grey[200],
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: isMine
                              ? CrossAxisAlignment.end
                              : CrossAxisAlignment.start,
                          children: [
                            Text(
                              msg['nickname'] ?? '익명',
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              msg['text'] ?? '',
                              style: const TextStyle(fontSize: 15),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          const Divider(height: 1),
          SafeArea(
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _ctrl,
                    decoration: const InputDecoration(
                      hintText: '메시지 입력',
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(horizontal: 12),
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                IconButton(
                  icon: _sending
                      ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                      : const Icon(Icons.send),
                  onPressed: _sending ? null : _send,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
