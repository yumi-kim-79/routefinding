import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';

class GpxActionButtons extends StatelessWidget {
  final String? gpxString;
  final void Function(String)? onPasteGpx;

  const GpxActionButtons({
    Key? key,
    required this.gpxString,
    this.onPasteGpx,
  }) : super(key: key);

  Future<void> _downloadGpx(BuildContext context) async {
    if (gpxString == null) return;
    final directory = await getApplicationDocumentsDirectory();
    final file = File('${directory.path}/approach.gpx');
    await file.writeAsString(gpxString!);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('GPX 파일이 다운로드 되었습니다.')),
    );
  }

  Future<void> _shareGpx(BuildContext context) async {
    if (gpxString == null) return;
    final directory = await getTemporaryDirectory();
    final file = File('${directory.path}/approach.gpx');
    await file.writeAsString(gpxString!);
    await Share.shareXFiles([XFile(file.path)], text: '어프로치 GPX 파일입니다.');
  }

  @override
  Widget build(BuildContext context) {
    final hasGpx = (gpxString ?? '').isNotEmpty;

    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        IconButton(
          icon: const Icon(Icons.paste),
          tooltip: 'GPX 붙여넣기',
          onPressed: onPasteGpx == null
              ? null
              : () async {
            final clipboard = await Clipboard.getData('text/plain');
            final text = clipboard?.text ?? '';
            if (text.isNotEmpty) onPasteGpx!(text);
          },
        ),
        IconButton(
          icon: const Icon(Icons.copy),
          tooltip: 'GPX 복사',
          onPressed: hasGpx
              ? () async {
            await Clipboard.setData(ClipboardData(text: gpxString!));
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('GPX가 복사되었습니다.')),
            );
          }
              : null,
        ),
        IconButton(
          icon: const Icon(Icons.download),
          tooltip: 'GPX 다운로드',
          onPressed: hasGpx
              ? () => _downloadGpx(context)
              : null,
        ),
        IconButton(
          icon: const Icon(Icons.share),
          tooltip: 'GPX 공유',
          onPressed: hasGpx
              ? () => _shareGpx(context)
              : null,
        ),
      ],
    );
  }
}
