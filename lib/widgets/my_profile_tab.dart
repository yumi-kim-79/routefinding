import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../services/profile_service.dart';
import '../common/profile_with_crown.dart'; // 왕관+등급+아바타 위젯
import '../constants/level.dart'; // ← 반드시 추가!! (등급 유틸 함수)

class MyProfileTab extends StatefulWidget {
  final VoidCallback? onProfileChanged;
  const MyProfileTab({Key? key, this.onProfileChanged}) : super(key: key);

  @override
  State<MyProfileTab> createState() => _MyProfileTabState();
}

class _MyProfileTabState extends State<MyProfileTab> {
  final _service = ProfileService();
  final _introController = TextEditingController();

  bool _isUploadingPhoto = false;
  bool _isSavingIntro = false;

  @override
  void dispose() {
    _introController.dispose();
    super.dispose();
  }

  /// 프로필 사진 변경
  Future<void> _onChangePhotoPressed(String? currentPhotoUrl) async {
    if (_isUploadingPhoto) return;

    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery);
    if (picked == null) return;

    setState(() => _isUploadingPhoto = true);
    try {
      // 1) 사진 업로드
      await _service.uploadProfilePhoto(File(picked.path));

      // 2) 업로드 성공 시 부모 콜백 호출
      widget.onProfileChanged?.call();

      // 3) 유저 피드백
      _showSnack('프로필 사진이 변경되었습니다.');
    } catch (e) {
      _showSnack('사진 업로드 실패: $e');
    } finally {
      if (mounted) setState(() => _isUploadingPhoto = false);
    }
  }

  /// 한 줄 소개 저장
  Future<void> _onSaveIntroPressed(String uid) async {
    if (_isSavingIntro) return;
    final newIntro = _introController.text.trim();

    setState(() => _isSavingIntro = true);
    try {
      // 1) Firestore 업데이트
      await FirebaseFirestore.instance
          .collection('users')
          .doc(uid)
          .update({'intro': newIntro});

      // 2) 저장 성공 시 부모 콜백 호출
      widget.onProfileChanged?.call();

      // 3) 유저 피드백
      _showSnack('소개글이 저장되었습니다.');
    } catch (e) {
      _showSnack('소개글 저장 실패: $e');
    } finally {
      if (mounted) setState(() => _isSavingIntro = false);
    }
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  /// 프로필 사진+왕관+등급 (편집 버튼/업로드 오버레이 포함)
  Widget _buildProfileAvatar(String? photoUrl, String? level, String? nickname) {
    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        ProfileWithCrown(
          photoUrl: photoUrl,
          level: level,
          nickname: nickname ?? '',
          radius: 50,
          levelFontSize: 16,
          levelBorderWidth: 5,
        ),
        if (_isUploadingPhoto)
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.4),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              ),
            ),
          ),
        Positioned(
          bottom: -6,
          right: -12,
          child: InkWell(
            onTap: _isUploadingPhoto
                ? null
                : () => _onChangePhotoPressed(photoUrl),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.15),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  )
                ],
              ),
              padding: const EdgeInsets.all(6),
              child: const Icon(Icons.edit, size: 20, color: Colors.black87),
            ),
          ),
        ),
      ],
    );
  }

  /// 등급 + 다음 등급까지 안내(반투명)
  Widget _buildLevelField(String level, int point) {
    final remain = getRemainToNextLevel(level, point);
    final next = getNextLevel(level);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text('등급(Level)', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.black87)),
            const SizedBox(width: 6),
            if (remain != null && next != null)
              Text(
                '(${next}까지 $remain점 남음)',
                style: TextStyle(fontSize: 13, color: Colors.black.withOpacity(0.40)),
              )
            else
              Text(
                '(최고 등급!)',
                style: TextStyle(fontSize: 13, color: Colors.black.withOpacity(0.40)),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: Text(level, style: const TextStyle(fontSize: 16)),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance.collection('users').doc(user.uid).snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final data = snapshot.data!.data() ?? {};
        final nickname = data['nickname'] as String? ?? '';
        final photoUrl = data['photoUrl'] as String?;
        final email = data['email'] as String? ?? user.email ?? '';
        final intro = data['intro'] as String? ?? '';
        final level = data['level'] as String? ?? '5.6';
        final pointRaw = data['point'];
        final point = pointRaw is int
            ? pointRaw
            : (pointRaw is double
            ? pointRaw.toInt()
            : int.tryParse(pointRaw?.toString() ?? '0') ?? 0);

        // 프로필 데이터가 바뀌었을 때만 컨트롤러 동기화
        if (_introController.text != intro) {
          _introController.text = intro;
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Center(child: _buildProfileAvatar(photoUrl, level, nickname)),
              const SizedBox(height: 24),
              _buildReadOnlyField('닉네임', nickname),
              const SizedBox(height: 16),
              _buildReadOnlyField('이메일', email),
              const SizedBox(height: 16),
              _buildLevelField(level, point),
              _buildReadOnlyField('포인트(Point)', point.toString()),
              const SizedBox(height: 24),
              Align(
                alignment: Alignment.centerLeft,
                child: Text('한 줄 소개', style: _labelStyle(context)),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _introController,
                decoration: const InputDecoration(
                  hintText: '나를 간단히 소개해 보세요.',
                  border: OutlineInputBorder(),
                ),
                maxLines: 2,
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSavingIntro
                      ? null
                      : () => _onSaveIntroPressed(user.uid),
                  child: _isSavingIntro
                      ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                      : const Text('소개글 저장'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildReadOnlyField(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Text(label, style: _labelStyle(context)),
        ),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: Text(value, style: const TextStyle(fontSize: 16)),
        ),
      ],
    );
  }

  TextStyle _labelStyle(BuildContext context) => TextStyle(
    fontWeight: FontWeight.w600,
    color: Colors.grey.shade700,
  );
}
