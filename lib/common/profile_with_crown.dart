// common/profile_with_crown.dart

import 'package:flutter/material.dart';

class ProfileWithCrown extends StatelessWidget {
  final String? photoUrl;
  final String? level;
  final String? nickname;
  final double? radius;
  final double? crownSize;
  final double? crownTopOffset;
  final String displayType;
  final VoidCallback? onEdit;
  final double? levelFontSize;
  final double? levelBorderWidth;
  final bool showNickname;   // 닉네임 한 줄로 같이 출력할지

  /// 닉네임 스타일(한 줄 적용)
  final TextStyle? textStyle;

  const ProfileWithCrown({
    Key? key,
    this.photoUrl,
    this.level,
    this.nickname,
    this.radius,
    this.crownSize,
    this.crownTopOffset,
    this.displayType = 'profile',
    this.onEdit,
    this.levelFontSize,
    this.levelBorderWidth,
    this.showNickname = false,
    this.textStyle,
  }) : super(key: key);

  Color _levelBorderColor(String? level) {
    switch (level) {
      case '5.15': return const Color(0xFFFFD700);
      case '5.14': return const Color(0xFFC0C0C0);
      case '5.13': return const Color(0xFFcd7f32);
      case '5.12': return Colors.purple;
      case '5.11': return Colors.brown;
      case '5.10': return Colors.red;
      case '5.9':  return Colors.pink;
      case '5.8':  return Colors.yellow;
      case '5.7':  return Colors.blue;
      default:     return Colors.lightBlueAccent;
    }
  }

  String? _crownAsset(String? level) {
    switch (level) {
      case '5.15': return 'assets/crown_full.png';
      case '5.14': return 'assets/crown_min.png';
      case '5.13': return 'assets/crown_low.png';
      default:     return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    // 타입별 스타일 분기 (프로필, 댓글, 대댓글)
    double _radius, _crownSize, _levelFont, _levelBottom, _crownTop;

    switch (displayType) {
      case 'profile':
        _radius = radius ?? 44;
        _crownSize = crownSize ?? 44;
        _crownTop = crownTopOffset ?? -_radius * 0.65;
        _levelFont = levelFontSize ?? 8;
        _levelBottom = -_radius * 0.63;
        _crownTop = -_radius * 0.65;
        break;
      case 'comment':
        _radius = radius ?? 14;
        _crownSize = crownSize ?? 14;
        _levelFont = levelFontSize ?? 7;
        _levelBottom = -_radius * 0.68;
        _crownTop = -_radius * 0.85;
        break;
      case 'reply':
        _radius = radius ?? 12;
        _crownSize = crownSize ?? 12;
        _levelFont = levelFontSize ?? 6;
        _levelBottom = -_radius * 0.66;
        _crownTop = -_radius * 0.75;
        break;
      default:
        _radius = radius ?? 44;
        _crownSize = crownSize ?? 36;
        _levelFont = levelFontSize ?? 16;
        _levelBottom = -_radius * 0.33;
        _crownTop = -_radius * 0.65;
        break;
    }

    final borderColor = _levelBorderColor(level);
    final crownAsset = _crownAsset(level);
    final double _levelBorder = levelBorderWidth ?? (_radius * 0.15);

    /// 아바타(프로필+왕관+등급)만 출력
    Widget avatarStack = Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        // 프로필(테두리)
        CircleAvatar(
          radius: _radius + 2,
          backgroundColor: borderColor,
          child: CircleAvatar(
            radius: _radius,
            backgroundColor: Colors.grey.shade300,
            backgroundImage: (photoUrl != null && photoUrl!.isNotEmpty) ? NetworkImage(photoUrl!) : null,
            child: (photoUrl == null || photoUrl!.isEmpty)
                ? Icon(Icons.person, size: _radius, color: Colors.white70)
                : null,
          ),
        ),
        // 왕관
        if (crownAsset != null)
          Positioned(
            top: _crownTop,
            child: Image.asset(
              crownAsset,
              width: _crownSize,
              height: _crownSize,
              fit: BoxFit.contain,
            ),
          ),
        // 레벨 (등급)
        if (level != null)
          Positioned(
            bottom: _levelBottom,
            child: Container(
              padding: EdgeInsets.symmetric(
                horizontal: _radius * 0.26,
                vertical: _radius * 0.09,
              ),
              decoration: BoxDecoration(
                color: borderColor,
                borderRadius: BorderRadius.circular(_radius * 0.7),
                border: Border.all(color: Colors.white, width: _levelBorder),
                boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 2)],
              ),
              child: Stack(
                children: [
                  // 검정색 테두리 효과용 Text
                  Text(
                    level!,
                    style: TextStyle(
                      fontSize: _levelFont,
                      fontWeight: FontWeight.bold,
                      foreground: Paint()
                        ..style = PaintingStyle.stroke
                        ..strokeWidth = 3
                        ..color = Colors.black,
                    ),
                  ),
                  // 흰색 본문 Text (위에 겹침)
                  Text(
                    level!,
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: _levelFont,
                      shadows: [Shadow(color: Colors.black26, blurRadius: 1)],
                    ),
                  ),
                ],
              ),
            ),
          ),
        // 프로필 수정(연필) 아이콘: 4시 방향
        if (onEdit != null)
          Positioned(
            right: -8,
            bottom: -16,
            child: Material(
              color: Colors.white,
              shape: const CircleBorder(),
              elevation: 2,
              child: InkWell(
                onTap: onEdit,
                customBorder: const CircleBorder(),
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: const Icon(Icons.edit, size: 20, color: Colors.black87),
                ),
              ),
            ),
          ),
      ],
    );

    /// 닉네임+아바타+등급을 한 줄로 정렬(길어져도 안전)
    if (showNickname) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          avatarStack,
          const SizedBox(width: 6),
          // 닉네임(길어져도 안전, 오버플로우 ellipsis)
          Flexible(
            child: Text(
              nickname ?? '(닉네임 없음)',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: textStyle ??
                  const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w400,
                    color: Colors.black87,
                  ),
            ),
          ),
        ],
      );
    } else {
      // 아바타+왕관+등급만 출력 (닉네임 없음)
      return avatarStack;
    }
  }
}
