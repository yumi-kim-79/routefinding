import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'dart:io';

class CrewCreateScreen extends StatefulWidget {
  const CrewCreateScreen({Key? key}) : super(key: key);

  @override
  State<CrewCreateScreen> createState() => _CrewCreateScreenState();
}

class _CrewCreateScreenState extends State<CrewCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _introController = TextEditingController();

  bool _isLoading = false;
  XFile? _imageFile;

  /// 이미지 선택
  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery);
    if (picked != null) setState(() => _imageFile = picked);
  }

  /// 이미지 업로드 & URL 반환
  Future<String?> _uploadImage(String crewDocId) async {
    if (_imageFile == null) return null;
    final ref = FirebaseStorage.instance.ref('crew_images/$crewDocId/cover.jpg');
    await ref.putFile(File(_imageFile!.path));
    return await ref.getDownloadURL();
  }

  /// 크루 개설 처리
  Future<void> _createCrew() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception('로그인 필요');

      final name = _nameController.text.trim();
      final intro = _introController.text.trim();

      // 중복 이름 체크
      final query = await FirebaseFirestore.instance
          .collection('crews')
          .where('name', isEqualTo: name)
          .get();
      if (query.docs.isNotEmpty) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('이미 존재하는 크루명입니다!')),
        );
        return;
      }

      // 우선 크루 데이터 저장(이미지 제외)
      final crewDoc = await FirebaseFirestore.instance.collection('crews').add({
        'name': name,
        'leaderUid': user.uid,
        'leaderNickname': user.displayName ?? user.email ?? '익명',
        'intro': intro,
        'memberCount': 1,
        'createdAt': FieldValue.serverTimestamp(),
        'imageUrl': null,
      });

      // 이미지 있으면 업로드
      String? imageUrl;
      if (_imageFile != null) {
        imageUrl = await _uploadImage(crewDoc.id);
        await crewDoc.update({'imageUrl': imageUrl});
      }

      // 리더 멤버 등록
      await crewDoc.collection('members').doc(user.uid).set({
        'uid': user.uid,
        'nickname': user.displayName ?? user.email ?? '익명',
        'role': 'leader',
        'joinedAt': FieldValue.serverTimestamp(),
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('크루가 성공적으로 개설되었습니다!')),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('오류: ${e.toString()}')),
      );
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _introController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('크루 개설')),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(18),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('대표 이미지', style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              Center(
                child: GestureDetector(
                  onTap: _isLoading ? null : _pickImage,
                  child: _imageFile != null
                      ? ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Image.file(
                      File(_imageFile!.path),
                      width: 130,
                      height: 130,
                      fit: BoxFit.cover,
                    ),
                  )
                      : Container(
                    width: 130,
                    height: 130,
                    decoration: BoxDecoration(
                      color: Colors.grey[300],
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(Icons.add_a_photo, size: 40, color: Colors.grey[700]),
                  ),
                ),
              ),
              SizedBox(height: 20),
              Text('크루 이름', style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              TextFormField(
                controller: _nameController,
                enabled: !_isLoading,
                decoration: InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: '크루 이름을 입력하세요',
                ),
                validator: (value) =>
                value == null || value.trim().isEmpty ? '크루명을 입력하세요' : null,
              ),
              SizedBox(height: 20),
              Text('크루 소개', style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              TextFormField(
                controller: _introController,
                enabled: !_isLoading,
                decoration: InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: '크루 간단 소개',
                ),
                minLines: 2,
                maxLines: 5,
                validator: (value) =>
                value == null || value.trim().isEmpty ? '소개를 입력하세요' : null,
              ),
              SizedBox(height: 28),
              ElevatedButton.icon(
                icon: _isLoading
                    ? SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
                    : Icon(Icons.add),
                label: Text(_isLoading ? '생성중...' : '크루 개설'),
                style: ElevatedButton.styleFrom(
                  minimumSize: Size.fromHeight(48),
                ),
                onPressed: _isLoading ? null : _createCrew,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
