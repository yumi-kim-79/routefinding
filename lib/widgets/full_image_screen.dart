import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:routefinding/widgets/watermarked_image.dart';

class FullImageScreen extends StatefulWidget {
  final String imageUrl;
  final String watermarkText;

  const FullImageScreen({
    Key? key,
    required this.imageUrl,
    this.watermarkText = 'RouteFinding',
  }) : super(key: key);

  @override
  State<FullImageScreen> createState() => _FullImageScreenState();
}

class _FullImageScreenState extends State<FullImageScreen> {
  static const platform = MethodChannel('com.routefinding/screen_protect');
  Size? _imageSize;

  @override
  void initState() {
    super.initState();
    _resolveImageSize();
    _enableSecure(); // 진입 시 캡처방지 ON
  }

  @override
  void dispose() {
    _disableSecure(); // 화면 종료 시 캡처방지 OFF
    super.dispose();
  }

  Future<void> _enableSecure() async {
    try {
      await platform.invokeMethod('enableSecure');
    } catch (e) {
      debugPrint('화면 보호 활성화 실패: $e');
    }
  }

  Future<void> _disableSecure() async {
    try {
      await platform.invokeMethod('disableSecure');
    } catch (e) {
      debugPrint('화면 보호 해제 실패: $e');
    }
  }

  Future<void> _resolveImageSize() async {
    final completer = Completer<Size>();
    final img = Image.network(widget.imageUrl);

    img.image.resolve(const ImageConfiguration()).addListener(
      ImageStreamListener((info, _) {
        if (!completer.isCompleted) {
          completer.complete(Size(
            info.image.width.toDouble(),
            info.image.height.toDouble(),
          ));
        }
      }),
    );

    final size = await completer.future;
    if (!mounted) return;
    setState(() => _imageSize = size);
  }

  @override
  Widget build(BuildContext context) {
    if (_imageSize == null) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final media = MediaQuery.of(context).size;
    final scaleW = media.width / _imageSize!.width;
    final scaleH = media.height / _imageSize!.height;
    final minScale = scaleW < scaleH ? scaleW : scaleH;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Center(
        child: InteractiveViewer(
          minScale: minScale,
          maxScale: 5.0,
          child: WatermarkedImage(
            imageProvider: NetworkImage(widget.imageUrl),
            watermarkText: widget.watermarkText,
            fit: BoxFit.contain,
            width: _imageSize!.width,
            height: _imageSize!.height,
          ),
        ),
      ),
    );
  }
}
