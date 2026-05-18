// lib/write_post_screen.dart
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'constants/level.dart';

class WritePostScreen extends StatefulWidget {
  final String initialCategory;
  const WritePostScreen({Key? key, required this.initialCategory}) : super(key: key);

  @override
  State<WritePostScreen> createState() => _WritePostScreenState();
}

class _WritePostScreenState extends State<WritePostScreen> {
  static const _adminEmail = 'yusung790926@gmail.com';

  final _titleCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  String _selectedCategory = '';
  bool _saving = false;

  final List<XFile> _pickedFiles = [];
  final ImagePicker _picker = ImagePicker();
  late final bool _isAdmin;
  bool _isPinned = false;

  @override
  void initState() {
    super.initState();
    final user = FirebaseAuth.instance.currentUser;
    _isAdmin = (user?.email ?? '') == _adminEmail;
    _selectedCategory = (!_isAdmin && widget.initialCategory == '공지')
        ? '자유'
        : widget.initialCategory;
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _contentCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImages() async {
    final remain = 8 - _pickedFiles.length;
    if (remain <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('이미 최대 8장까지 선택하셨습니다.')),
      );
      return;
    }
    try {
      final pickedList = await _picker.pickMultiImage(imageQuality: 85);
      if (pickedList.isEmpty) return;
      setState(() {
        _pickedFiles.addAll(pickedList.take(remain));
      });
    } catch (e) {
      debugPrint('이미지 선택 실패: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('이미지 선택 중 오류가 발생했습니다.')),
      );
    }
  }

  Future<List<String>> _uploadImages(String postId) async {
    if (_pickedFiles.isEmpty) return [];
    final ref = FirebaseStorage.instance.ref();
    final tasks = _pickedFiles.map((f) async {
      final filename = '${DateTime.now().millisecondsSinceEpoch}_${f.name}';
      final upload = await ref.child('post_images/$postId/$filename').putFile(File(f.path));
      return await upload.ref.getDownloadURL();
    }).toList();
    return await Future.wait(tasks);
  }

  Future<void> _save() async {
    final title = _titleCtrl.text.trim();
    final content = _contentCtrl.text.trim();

    if (title.isEmpty || content.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('제목과 내용을 입력하세요.')),
      );
      return;
    }

    if (!_isAdmin && _selectedCategory == '공지') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('공지 게시판은 관리자만 작성 가능합니다.')),
      );
      return;
    }

    setState(() => _saving = true);

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception('로그인 필요');
      final uid = user.uid;

      final userSnap = await FirebaseFirestore.instance.collection('users').doc(uid).get();
      final u = userSnap.data() ?? {};
      final nickname = u['nickname'] ?? '(알 수 없는 사용자)';
      final level = u['level'];
      final photoUrl = u['photoUrl'];

      final posts = FirebaseFirestore.instance.collection('posts');
      final newDoc = posts.doc();
      final postId = newDoc.id;

      // 🔹 기존 고정 공지 해제
      if (_isAdmin && _selectedCategory == '공지' && _isPinned) {
        final pinnedQuery = await posts
            .where('category', isEqualTo: '공지')
            .where('isPinned', isEqualTo: true)
            .get();
        for (final doc in pinnedQuery.docs) {
          await doc.reference.update({'isPinned': false});
        }
      }

      final Map<String, dynamic> postData = {
        'category': _selectedCategory,
        'title': title,
        'content': content,
        'userId': uid,
        'timestamp': FieldValue.serverTimestamp(),
        'nickname': nickname,
        'level': level,
        'photoUrl': photoUrl,
        'isPinned': _isPinned,
      };

      // 🔹 isPinned 필드 추가
      if (_isAdmin && _selectedCategory == '공지') {
        postData['isPinned'] = _isPinned;
      }

      await newDoc.set(postData);

      // 🔹 공지 알림 전체 발송
      if (_selectedCategory == '공지') {
        final usersSnap = await FirebaseFirestore.instance.collection('users').get();
        final batch = FirebaseFirestore.instance.batch();
        for (var u in usersSnap.docs) {
          final notifRef = FirebaseFirestore.instance.collection('notifications').doc();
          batch.set(notifRef, {
            'receiverId': u.id,
            'type': 'admin_notice',
            'message': title,
            'postId': postId,
            'timestamp': FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
      }

      // 🔹 이미지 업로드
      List<String> uploadedUrls = [];
      if (_pickedFiles.isNotEmpty) {
        uploadedUrls = await _uploadImages(postId);
        await newDoc.update({'images': uploadedUrls});
      }

      // 🔹 포인트 반영
      await updateUserPointAndLevel(addPoint: 1);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('글이 등록되었습니다.')),
      );
      Navigator.of(context).pop();
    } catch (e) {
      debugPrint('저장 실패: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('저장 중 오류가 발생했습니다.')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final allCats = ['공지', '자유', '크루', '중고마켓'];
    final dropdownItems = allCats
        .where((c) => _isAdmin || c != '공지')
        .map((c) => DropdownMenuItem(value: c, child: Text(c)))
        .toList();

    return Scaffold(
      appBar: AppBar(title: const Text('글쓰기')),
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Text('카테고리'),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _selectedCategory,
                decoration: const InputDecoration(border: UnderlineInputBorder()),
                items: dropdownItems,
                onChanged: (v) => setState(() => _selectedCategory = v ?? _selectedCategory),
              ),
              if (_isAdmin && _selectedCategory == '공지') ...[
                const SizedBox(height: 16),
                CheckboxListTile(
                  title: const Text('고정공지로 설정'),
                  value: _isPinned,
                  onChanged: (v) => setState(() => _isPinned = v ?? false),
                ),
              ],
              const SizedBox(height: 24),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (int i = 0; i < _pickedFiles.length; i++)
                    Stack(children: [
                      Image.file(File(_pickedFiles[i].path), width: 80, height: 80, fit: BoxFit.cover),
                      Positioned(
                        right: 0,
                        top: 0,
                        child: InkWell(
                          onTap: () => setState(() => _pickedFiles.removeAt(i)),
                          child: const Icon(Icons.close, size: 18, color: Colors.red),
                        ),
                      ),
                    ]),
                  if (_pickedFiles.length < 8)
                    GestureDetector(
                      onTap: _pickImages,
                      child: Container(
                        width: 80,
                        height: 80,
                        color: Colors.grey.shade200,
                        child: const Icon(Icons.add_a_photo, color: Colors.grey),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _titleCtrl,
                decoration: const InputDecoration(labelText: '제목'),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _contentCtrl,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  hintText: '내용',
                  border: OutlineInputBorder(),
                ),
                maxLines: 6,
              ),
              const SizedBox(height: 24),
              const Text('미리보기', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              SelectableText(
                _contentCtrl.text,
                style: const TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _saving ? null : _save,
                  child: Text(_saving ? '저장 중...' : '저장'),
                ),
              ),
            ],
          ),
          if (_saving)
            Container(
              color: Colors.black26,
              child: const Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
    );
  }
}
