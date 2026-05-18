import 'dart:io';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:image_picker/image_picker.dart';

import 'constants/firestore_fields.dart';

class EditPostScreen extends StatefulWidget {
  final String postId;
  final String initialTitle;
  final String initialContent;
  final List<String>? initialImages;

  const EditPostScreen({
    Key? key,
    required this.postId,
    required this.initialTitle,
    required this.initialContent,
    this.initialImages,
  }) : super(key: key);

  @override
  State<EditPostScreen> createState() => _EditPostScreenState();
}

class _EditPostScreenState extends State<EditPostScreen> {
  late TextEditingController titleController;
  late TextEditingController contentController;

  final List<File> _selectedFiles = [];
  List<String> _existingImages = [];
  bool _isUploadingImage = false;
  bool _isSaving = false;

  bool _isCheckingPermission = true;
  bool _hasPermission = false;
  String? _postAuthorUid;

  int _currentImageIndex = 0;

  static const _adminEmail = 'yusung790926@gmail.com';
  bool _isPinned = false;

  @override
  void initState() {
    super.initState();
    titleController = TextEditingController(text: widget.initialTitle);
    contentController = TextEditingController(text: widget.initialContent);
    _existingImages = widget.initialImages ?? [];
    _checkPermission();
    _loadPostIsPinned();
  }

  @override
  void dispose() {
    titleController.dispose();
    contentController.dispose();
    super.dispose();
  }

  Future<void> _checkPermission() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() {
        _hasPermission = false;
        _isCheckingPermission = false;
      });
      return;
    }

    try {
      final doc = await FirebaseFirestore.instance
          .collection('posts')
          .doc(widget.postId)
          .get();

      if (!doc.exists) {
        setState(() {
          _hasPermission = false;
          _isCheckingPermission = false;
        });
        return;
      }

      final data = doc.data();
      _postAuthorUid = data?[PostFields.userId] as String?;
      final isAuthor = user.uid == _postAuthorUid;
      final isAdmin = user.email == _adminEmail;

      setState(() {
        _hasPermission = isAuthor || isAdmin;
        _isCheckingPermission = false;
      });
    } catch (e) {
      setState(() {
        _hasPermission = false;
        _isCheckingPermission = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('권한 확인 중 오류: $e')),
        );
      }
    }
  }

  Future<void> _loadPostIsPinned() async {
    final doc = await FirebaseFirestore.instance
        .collection('posts')
        .doc(widget.postId)
        .get();
    if (doc.exists) {
      final data = doc.data();
      setState(() {
        _isPinned = data?[PostFields.isPinned] ?? false;
      });
    }
  }

  Future<void> _togglePinned() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user?.email != _adminEmail) return;

    final newValue = !_isPinned;

    await FirebaseFirestore.instance
        .collection('posts')
        .doc(widget.postId)
        .update({PostFields.isPinned: newValue});

    setState(() {
      _isPinned = newValue;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(newValue ? '고정 공지로 설정됨' : '고정 공지 해제됨')),
    );
  }

  Future<void> _pickAndUploadImages() async {
    if (_isUploadingImage || _isSaving) return;

    final picker = ImagePicker();
    final pickedList = await picker.pickMultiImage();
    if (pickedList.isEmpty) return;

    setState(() => _isUploadingImage = true);

    try {
      List<String> urls = [];
      for (final picked in pickedList) {
        final file = File(picked.path);
        final storageRef = FirebaseStorage.instance
            .ref('post_images/${widget.postId}/${DateTime.now().millisecondsSinceEpoch}_${picked.name}');
        final uploadTask = storageRef.putFile(file);
        final snapshot = await uploadTask.whenComplete(() => null);
        final downloadUrl = await snapshot.ref.getDownloadURL();
        urls.add(downloadUrl);
      }

      _existingImages.addAll(urls);

      await FirebaseFirestore.instance
          .collection('posts')
          .doc(widget.postId)
          .update({PostFields.images: _existingImages});

      if (!mounted) return;
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('이미지 변경이 완료되었습니다.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('이미지 업로드 실패: $e')),
      );
    } finally {
      if (!mounted) return;
      setState(() {
        _isUploadingImage = false;
      });
    }
  }

  Future<void> _deleteImage(int idx) async {
    if (_isSaving || _isUploadingImage) return;
    if (_existingImages.length <= 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('최소 1장은 남아있어야 합니다.')),
      );
      return;
    }
    setState(() {
      _existingImages.removeAt(idx);
      if (_currentImageIndex >= _existingImages.length) _currentImageIndex = 0;
    });

    await FirebaseFirestore.instance
        .collection('posts')
        .doc(widget.postId)
        .update({PostFields.images: _existingImages});
  }

  Future<void> _updatePost() async {
    if (titleController.text.trim().isEmpty || contentController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('제목과 내용을 모두 입력해 주세요.')),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      final updateData = {
        PostFields.title: titleController.text.trim(),
        PostFields.content: contentController.text.trim(),
        PostFields.timestamp: FieldValue.serverTimestamp(),
        PostFields.images: _existingImages,
        PostFields.isPinned: _isPinned,
      };

      await FirebaseFirestore.instance
          .collection('posts')
          .doc(widget.postId)
          .update(updateData);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('게시글이 저장되었습니다.')),
      );
      Navigator.pop(context);
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('수정 실패: $e')),
      );
    } finally {
      if (!mounted) return;
      setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isCheckingPermission) {
      return Scaffold(
        appBar: AppBar(title: const Text('글 수정')),
        body: const Center(child: CircularProgressIndicator()),
      );

    }
    if (!_hasPermission) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('수정 권한이 없습니다.')),
        );
        Navigator.pop(context);
      });
      return Scaffold(
        appBar: AppBar(title: const Text('글 수정')),
        body: const SizedBox.shrink(),
      );

    }

    final isAdmin = FirebaseAuth.instance.currentUser?.email == _adminEmail;

    return Scaffold(
      appBar: AppBar(
        title: const Text('글 수정'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: (_isSaving || _isUploadingImage) ? null : () => Navigator.pop(context),
        ),
        actions: isAdmin
            ? [
          TextButton(
            onPressed: _togglePinned,
            child: Text(
              _isPinned ? '고정 해제' : '공지 고정',
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ]
            : null,
      ),
      body: Stack(
        children: [
          GestureDetector(
            onTap: () => FocusScope.of(context).unfocus(),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: titleController,
                    enabled: !_isSaving && !_isUploadingImage,
                    decoration: const InputDecoration(
                      labelText: '제목',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: contentController,
                    enabled: !_isSaving && !_isUploadingImage,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      labelText: '내용',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 5,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    '미리보기',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  SelectableText(
                    contentController.text,
                    style: const TextStyle(fontSize: 14),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    '대표 이미지',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: Colors.grey.shade700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _existingImages.isEmpty
                      ? Container(
                    height: 180,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.grey.shade400),
                    ),
                    child: const Center(
                      child: Icon(Icons.photo, size: 48, color: Colors.grey),
                    ),
                  )
                      : Stack(
                    children: [
                      SizedBox(
                        height: 180,
                        child: PageView.builder(
                          itemCount: _existingImages.length,
                          controller: PageController(initialPage: _currentImageIndex),
                          onPageChanged: (i) => setState(() => _currentImageIndex = i),
                          itemBuilder: (ctx, idx) => ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(
                              _existingImages[idx],
                              fit: BoxFit.cover,
                              width: double.infinity,
                              height: double.infinity,
                              loadingBuilder: (context, child, progress) {
                                if (progress == null) return child;
                                return const Center(child: CircularProgressIndicator());
                              },
                              errorBuilder: (context, error, stackTrace) {
                                return const Center(
                                  child: Icon(Icons.error, size: 48),
                                );
                              },
                            ),
                          ),
                        ),
                      ),
                      // 이미지 삭제 버튼
                      if (_existingImages.length > 1)
                        Positioned(
                          top: 8,
                          right: 8,
                          child: InkWell(
                            onTap: () => _deleteImage(_currentImageIndex),
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.black45,
                                shape: BoxShape.circle,
                              ),
                              padding: const EdgeInsets.all(6),
                              child: const Icon(Icons.delete, color: Colors.white),
                            ),
                          ),
                        ),
                      // 슬라이드 인디케이터
                      Positioned(
                        bottom: 12,
                        left: 0,
                        right: 0,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(
                            _existingImages.length,
                                (i) => Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.symmetric(horizontal: 4),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: _currentImageIndex == i ? Colors.black : Colors.grey,
                              ),
                            ),
                          ),
                        ),
                      ),
                      // 업로드 중
                      if (_isUploadingImage)
                        Positioned.fill(
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.black.withOpacity(0.4),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  SizedBox(
                                    width: 40,
                                    height: 40,
                                    child: CircularProgressIndicator(
                                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                      strokeWidth: 3.5,
                                    ),
                                  ),
                                  SizedBox(height: 12),
                                  Text(
                                    '이미지 변경 중...',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      ElevatedButton.icon(
                        onPressed: (_isSaving || _isUploadingImage) ? null : _pickAndUploadImages,
                        icon: const Icon(Icons.add_a_photo, size: 18),
                        label: const Text('이미지 추가'),
                        style: ElevatedButton.styleFrom(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(6),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 36),
                  ElevatedButton(
                    onPressed: (_isSaving || _isUploadingImage) ? null : _updatePost,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: _isSaving
                        ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                        : const Text('수정 완료'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
