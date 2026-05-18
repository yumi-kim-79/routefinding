// crew_post_write_screen.dart

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'dart:io';
import 'package:reorderables/reorderables.dart';

class CrewPostWriteScreen extends StatefulWidget {
  final String crewId;
  final String? editPostId;
  final Map<String, dynamic>? initial; // 수정 시 기존 값

  const CrewPostWriteScreen({
    required this.crewId,
    this.editPostId,
    this.initial,
    Key? key,
  }) : super(key: key);

  @override
  State<CrewPostWriteScreen> createState() => _CrewPostWriteScreenState();
}

// 이미지 데이터 구조
class _ImageItem {
  final String? url; // 기존 이미지
  final XFile? file; // 새로 추가된 이미지

  _ImageItem.network(this.url) : file = null;
  _ImageItem.file(this.file) : url = null;

  bool get isNetwork => url != null;
  bool get isFile => file != null;
}

class _CrewPostWriteScreenState extends State<CrewPostWriteScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();
  final List<_ImageItem> _images = []; // 순서/타입 혼합 관리
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.initial != null) {
      _titleController.text = widget.initial?['title'] ?? '';
      _contentController.text = widget.initial?['content'] ?? '';
      final imgs = (widget.initial?['images'] as List<dynamic>? ?? []);
      _images.addAll(imgs
          .map((e) => e?.toString() ?? '')
          .where((e) => e.isNotEmpty)
          .map((url) => _ImageItem.network(url)));
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  // 여러 장 이미지 선택(최대 8장, 전체 기준)
  Future<void> _pickImages() async {
    final picker = ImagePicker();
    final remain = 8 - _images.length;
    if (remain <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('이미 최대 8장까지 선택하셨습니다.')),
      );
      return;
    }
    final picked = await picker.pickMultiImage(imageQuality: 85);
    if (picked != null && picked.isNotEmpty) {
      setState(() {
        _images.addAll(
          picked.take(remain).map((x) => _ImageItem.file(x)),
        );
      });
    }
  }

  // 이미지 업로드(새로 추가된 것만)
  Future<List<String>> _uploadImages(String postId) async {
    final ref = FirebaseStorage.instance.ref();
    final List<String> result = [];
    for (final img in _images) {
      if (img.isNetwork) {
        // 기존 이미지
        result.add(img.url!);
      } else if (img.isFile && img.file != null) {
        final filename = '${DateTime.now().millisecondsSinceEpoch}_${img.file!.name}';
        final upload = await ref
            .child('crews/${widget.crewId}/crewPosts/$postId/$filename')
            .putData(await img.file!.readAsBytes());
        final url = await upload.ref.getDownloadURL();
        result.add(url);
      }
    }
    return result;
  }

  // 이미지 썸네일 순서 드래그
  void _onReorder(int oldIdx, int newIdx) {
    setState(() {
      if (oldIdx < newIdx) newIdx -= 1;
      final item = _images.removeAt(oldIdx);
      _images.insert(newIdx, item);
    });
  }

  // 등록/수정
  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('로그인 필요')));
      setState(() => _isLoading = false);
      return;
    }

    // Firestore에서 photoUrl, level 동기화
    final userDoc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
    final userProfile = userDoc.data() ?? {};
    final photoUrl = userProfile['photoUrl'] ?? '';
    final level = userProfile['level']?.toString() ?? '';

    final posts = FirebaseFirestore.instance
        .collection('crews').doc(widget.crewId)
        .collection('crewPosts');
    final postId = widget.editPostId ?? posts.doc().id;

    // 1) 새글 등록
    if (widget.editPostId == null) {
      final data = {
        'title': _titleController.text.trim(),
        'content': _contentController.text.trim(),
        'authorUid': user.uid,
        'nickname': user.displayName ?? user.email ?? '익명',
        'photoUrl': photoUrl,
        'level': level,
        'createdAt': FieldValue.serverTimestamp(),
        'images': [],
        'views': 0,
      };
      await posts.doc(postId).set(data);
    } else {
      // 2) [수정] 제목/내용/프로필 동기화
      await posts.doc(postId).update({
        'title': _titleController.text.trim(),
        'content': _contentController.text.trim(),
        'nickname': user.displayName ?? user.email ?? '익명',
        'photoUrl': photoUrl,
        'level': level,
      });
    }

    // 3) 이미지 업로드(순서대로) 및 URL 업데이트
    final urls = await _uploadImages(postId);
    await posts.doc(postId).update({'images': urls});

    // 4) **새 글일 때만** 알림 보내기 (작성자 본인 제외)
    if (widget.editPostId == null) {
      final membersSnap = await FirebaseFirestore.instance
          .collection('crews')
          .doc(widget.crewId)
          .collection('members')
          .get();
      for (final mem in membersSnap.docs) {
        final memberUid = mem.id;
        if (memberUid == user.uid) continue;
        await FirebaseFirestore.instance
            .collection('notifications')
            .add({
          'receiverId': memberUid,
          'type': 'crew_new_post',
          'crewId': widget.crewId,
          'postId': postId,
          'message': '${user.displayName ?? '익명'} 님이 새 글을 작성했습니다.',
          'timestamp': FieldValue.serverTimestamp(),
          'checked': false,
        });
      }
    }

    // 5) 완료 후 화면 닫기
    if (mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.editPostId == null ? '크루 글쓰기' : '글 수정')),
      body: Padding(
        padding: const EdgeInsets.all(18),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              TextFormField(
                controller: _titleController,
                decoration: const InputDecoration(labelText: '제목'),
                validator: (v) => v == null || v.trim().isEmpty ? '제목을 입력하세요' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _contentController,
                decoration: const InputDecoration(labelText: '내용'),
                maxLines: 8,
                validator: (v) => v == null || v.trim().isEmpty ? '내용을 입력하세요' : null,
              ),
              const SizedBox(height: 14),
              // 드래그 정렬되는 이미지 썸네일 리스트
              ReorderableWrap(
                spacing: 6,
                runSpacing: 6,
                maxMainAxisCount: 4,
                needsLongPressDraggable: true,
                onReorder: _onReorder,
                children: [
                  for (int i = 0; i < _images.length; i++)
                    Stack(
                      key: ValueKey('img_$i'),
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: _images[i].isNetwork
                              ? Image.network(_images[i].url!, height: 70, width: 70, fit: BoxFit.cover)
                              : Image.file(File(_images[i].file!.path), height: 70, width: 70, fit: BoxFit.cover),
                        ),
                        Positioned(
                          right: 2, top: 2,
                          child: GestureDetector(
                            onTap: () {
                              setState(() => _images.removeAt(i));
                            },
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.black45,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.close, size: 18, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  OutlinedButton.icon(
                    icon: const Icon(Icons.photo),
                    label: const Text('사진 첨부'),
                    onPressed: _pickImages,
                  ),
                  const Spacer(),
                  ElevatedButton(
                    onPressed: _isLoading ? null : _submit,
                    child: _isLoading
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(widget.editPostId == null ? '등록' : '수정'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// [ReorderableWrap] 패키지 필요.
/// pubspec.yaml dependencies에 추가:
/// reorderables: ^0.6.0
