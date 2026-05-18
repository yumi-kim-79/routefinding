// lib/crew_join_form_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class CrewJoinFormScreen extends StatefulWidget {
  final String crewId;
  const CrewJoinFormScreen({required this.crewId, Key? key}) : super(key: key);

  @override
  State<CrewJoinFormScreen> createState() => _CrewJoinFormScreenState();
}

class _CrewJoinFormScreenState extends State<CrewJoinFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _aboutMeController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _aboutMeController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception('로그인이 필요합니다.');

      // 1) 신청서 데이터 저장
      final joinRef = FirebaseFirestore.instance
          .collection('crews')
          .doc(widget.crewId)
          .collection('joinRequests')
          .doc(user.uid);

      await joinRef.set({
        'uid': user.uid,
        'nickname': user.displayName ?? user.email ?? '익명',
        'status': 'pending',
        'requestedAt': FieldValue.serverTimestamp(),
        'aboutMe': _aboutMeController.text.trim(),
      });

      // 2) 리더에게 알림 보내기
      final crewSnap = await FirebaseFirestore.instance
          .collection('crews')
          .doc(widget.crewId)
          .get();
      final leaderUid = crewSnap.data()?['leaderUid'] as String?;
      if (leaderUid != null) {
        await FirebaseFirestore.instance
            .collection('notifications')
            .add({
          'receiverId': leaderUid,
          'type': 'crew_join_request',
          'crewId': widget.crewId,
          'message':
          '${user.displayName ?? '익명'} 님이 크루 가입을 요청했습니다.',
          'timestamp': FieldValue.serverTimestamp(),
          'checked': false,
        });
      }

      // 3) 돌아가면서 true 반환
      if (mounted) {
        Navigator.pop(context, true);
      }
    } catch (e) {
      // 실패 처리
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('신청 실패: ${e.toString()}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('크루 가입 신청서')),
      body: Padding(
        padding: const EdgeInsets.all(18),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('자기소개/지원 동기',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _aboutMeController,
                minLines: 3,
                maxLines: 6,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: '간단한 자기소개 또는 지원 동기를 입력하세요',
                ),
                validator: (v) =>
                v == null || v.trim().isEmpty ? '내용을 입력하세요' : null,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _submit,
                style:
                ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(44)),
                child: _isLoading
                    ? const CircularProgressIndicator()
                    : const Text('신청하기'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
