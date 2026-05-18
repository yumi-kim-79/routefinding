// crew_post_form_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class CrewPostFormScreen extends StatefulWidget {
  final String crewId;
  const CrewPostFormScreen({required this.crewId, Key? key}) : super(key: key);

  @override
  State<CrewPostFormScreen> createState() => _CrewPostFormScreenState();
}

class _CrewPostFormScreenState extends State<CrewPostFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final user = FirebaseAuth.instance.currentUser;
      // ✅ [핵심] 프로필 정보 불러오기
      final userDoc = await FirebaseFirestore.instance.collection('users').doc(user?.uid).get();
      final photoUrl = userDoc.data()?['photoUrl'] ?? '';
      final level = userDoc.data()?['level'] ?? '';

      await FirebaseFirestore.instance
          .collection('crews')
          .doc(widget.crewId)
          .collection('crewPosts')
          .add({
        'title': _titleController.text.trim(),
        'content': _contentController.text.trim(),
        'uid': user?.uid ?? '',
        'nickname': user?.displayName ?? user?.email ?? '익명',
        'photoUrl': photoUrl,    // 추가
        'level': level,          // 추가
        'createdAt': FieldValue.serverTimestamp(),
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('작성 실패: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('게시글 작성')),
      body: Padding(
        padding: EdgeInsets.all(18),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _titleController,
                decoration: InputDecoration(labelText: '제목'),
                validator: (v) => v == null || v.trim().isEmpty ? '제목을 입력하세요' : null,
              ),
              SizedBox(height: 16),
              TextFormField(
                controller: _contentController,
                decoration: InputDecoration(labelText: '내용'),
                minLines: 5,
                maxLines: 10,
                validator: (v) => v == null || v.trim().isEmpty ? '내용을 입력하세요' : null,
              ),
              SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _submit,
                child: _isLoading ? CircularProgressIndicator() : Text('등록하기'),
                style: ElevatedButton.styleFrom(minimumSize: Size.fromHeight(44)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
