// lib/widgets/watermarked_image.dart

import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';

/// WatermarkedImage
/// - 이미지를 그린 후, 중앙에 반투명 워터마크 텍스트를 크게 표시
/// - BoxFit 옵션에 따라 이미지를 fit, 워터마크는 항상 중앙
class WatermarkedImage extends StatefulWidget {
  final ImageProvider imageProvider;
  final double width, height;
  final String watermarkText;
  final BoxFit fit;

  const WatermarkedImage({
    Key? key,
    required this.imageProvider,
    required this.watermarkText,
    required this.width,
    required this.height,
    this.fit = BoxFit.cover,
  }) : super(key: key);

  @override
  State<WatermarkedImage> createState() => _WatermarkedImageState();
}

class _WatermarkedImageState extends State<WatermarkedImage> {
  ui.Image? _image;

  @override
  void initState() {
    super.initState();
    _resolveImage();
  }

  Future<void> _resolveImage() async {
    final c = Completer<ui.Image>();
    final stream = widget.imageProvider.resolve(const ImageConfiguration());
    final listener = ImageStreamListener((info, _) {
      if (!c.isCompleted) c.complete(info.image);
    });
    stream.addListener(listener);
    final img = await c.future;
    stream.removeListener(listener);
    if (mounted) setState(() => _image = img);
  }

  @override
  Widget build(BuildContext context) {
    if (_image == null) {
      return SizedBox(
        width: widget.width,
        height: widget.height,
        child: const Center(child: CircularProgressIndicator()),
      );
    }
    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: CustomPaint(
        painter: _WatermarkPainter(
          image: _image!,
          watermarkText: widget.watermarkText,
          fit: widget.fit,
        ),
      ),
    );
  }
}

class _WatermarkPainter extends CustomPainter {
  final ui.Image image;
  final String watermarkText;
  final BoxFit fit;

  _WatermarkPainter({
    required this.image,
    required this.watermarkText,
    required this.fit,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final inputSize = Size(image.width.toDouble(), image.height.toDouble());
    final fitted = applyBoxFit(fit, inputSize, size);
    final src = Alignment.center.inscribe(fitted.source, Offset.zero & inputSize);
    final dst = Alignment.center.inscribe(fitted.destination, Offset.zero & size);

    // 이미지 그리기
    canvas.drawImageRect(image, src, dst, Paint());

    // 워터마크 폰트 크기(이미지 표시 영역의 짧은 쪽의 16%)
    final base = dst.width < dst.height ? dst.width : dst.height;
    final fontSize = base * 0.16;
    final textPainter = TextPainter(
      text: TextSpan(
        text: watermarkText,
        style: TextStyle(
          color: Colors.white.withOpacity(0.3),
          fontSize: fontSize,
          fontWeight: FontWeight.bold,
        ),
      ),
      textDirection: TextDirection.ltr,
      textAlign: TextAlign.center,
    )..layout();

    // 중앙 정렬
    final dx = (size.width - textPainter.width) / 2;
    final dy = (size.height - textPainter.height) / 2;
    textPainter.paint(canvas, Offset(dx, dy));
  }

  @override
  bool shouldRepaint(_WatermarkPainter old) =>
      old.image != image ||
          old.watermarkText != watermarkText ||
          old.fit != fit;
}
