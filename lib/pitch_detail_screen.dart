import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:routefinding/widgets/watermarked_image.dart';
import 'package:routefinding/widgets/full_image_screen.dart';
import 'package:routefinding/screens/image_editor_screen.dart';
import 'constants/firestore_fields.dart'; // PitchFields 정의
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

/// 피치 상세 화면 (이미지 워터마크, 편집)
class PitchDetailScreen extends StatelessWidget {
  final Map<String, dynamic> pitchData;
  final int pitchIndex;

  const PitchDetailScreen({
    Key? key,
    required this.pitchData,
    required this.pitchIndex,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final name       = pitchData[PitchFields.name]       as String? ?? '';
    final length     = pitchData[PitchFields.length]     as String? ?? '';
    final difficulty = pitchData[PitchFields.difficulty] as String? ?? '';
    final style      = pitchData[PitchFields.style]      as String? ?? '';
    final gear       = pitchData[PitchFields.gear]       as String? ?? '';
    final imageUrl   = pitchData[PitchFields.imageUrl]   as String?;

    return Scaffold(
      appBar: AppBar(
        title: Text('피치 $pitchIndex 상세'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // — 이미지 (워터마크 적용 + 편집 버튼)
          if (imageUrl != null && imageUrl.isNotEmpty) ...[
            Stack(
              alignment: Alignment.topRight,
              children: [
                GestureDetector(
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => FullImageScreen(imageUrl: imageUrl),
                    ),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: WatermarkedImage(
                      imageProvider: NetworkImage(imageUrl),
                      width: double.infinity,
                      height: 300,
                      watermarkText: '© RouteFinding 2025',
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
                // 편집 아이콘 (우상단)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.black38,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.edit, color: Colors.white, size: 28),
                      onPressed: () async {
                        final file = await _downloadToTempFile(imageUrl);
                        if (file != null) {
                          final editedFile = await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ImageEditorScreen(imageFile: file),
                            ),
                          );
                          // TODO: 편집 완료 후 editedFile 저장/업로드 처리 필요
                        }
                      },
                    ),
                  ),
                ),
              ],
            ),
          ] else ...[
            Container(
              height: 200,
              color: Colors.grey.shade200,
              child: const Center(
                child: Icon(Icons.image, size: 48, color: Colors.grey),
              ),
            ),
          ],
          const SizedBox(height: 16),
          // — 피치 정보
          Text(
            '피치 $pitchIndex',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          _infoRow('이름', name),
          _infoRow('길이', length),
          _infoRow('난이도', difficulty),
          _infoRow('형태', style),
          _infoRow('소요장비', gear),
        ],
      ),
    );
  }

  /// 한 줄 정보 (오버플로우: 말줄임)
  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(
            '$label: ',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 16),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

/// 풀스크린 이미지 (워터마크, 확대/이동 지원)
class FullImageScreen extends StatelessWidget {
  final String imageUrl;
  const FullImageScreen({Key? key, required this.imageUrl}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Center(
        child: InteractiveViewer(
          panEnabled: true,
          minScale: 1.0,
          maxScale: 4.0,
          child: WatermarkedImage(
            imageProvider: NetworkImage(imageUrl),
            width: size.width,
            height: size.height,
            watermarkText: 'RouteFinding',
            fit: BoxFit.contain,
          ),
        ),
      ),
    );
  }
}

/// 네트워크 이미지를 임시파일로 저장
Future<File?> _downloadToTempFile(String url) async {
  try {
    final response = await http.get(Uri.parse(url));
    if (response.statusCode == 200) {
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/${DateTime.now().millisecondsSinceEpoch}.png');
      await file.writeAsBytes(response.bodyBytes);
      return file;
    }
  } catch (_) {}
  return null;
}
