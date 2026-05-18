// lib/screens/image_editor_screen.dart

import 'dart:ui' as ui;
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:path_provider/path_provider.dart';

// --- Enum/데이터 클래스 구역 ---
enum ToolType { pencil, line, text, shape }
enum ShapeType { star, triangle, rectangle, circle, sCircle, tCircle, pCircle, xMark, xxMark }

class Stroke {
  final List<Offset> points;
  final Color color;
  final double width;
  Stroke(this.points, this.color, this.width);
}

class ShapeInfo {
  final ShapeType type;
  final Offset position;
  final double size;
  final Color color;
  ShapeInfo(this.type, this.position, this.size, this.color);
}

class TextInfo {
  final String text;
  final Offset position;
  final TextStyle style;
  TextInfo(this.text, this.position, this.style);
}

enum ActionType { stroke, shape, text }
class ActionItem {
  final ActionType type;
  final dynamic data;
  ActionItem(this.type, this.data);
}

// --- Painter 클래스 ---
class ImageEditorPainter extends CustomPainter {
  final ui.Image background;
  final List<Stroke> strokes;
  final List<ShapeInfo> shapes;
  final List<TextInfo> texts;
  final Stroke? previewStroke;
  final ShapeInfo? previewShape;
  final TextInfo? previewText;
  final double scale;
  final Offset offset;
  final Offset? touchIndicator;

  ImageEditorPainter({
    required this.background,
    required this.strokes,
    required this.shapes,
    required this.texts,
    this.previewStroke,
    this.previewShape,
    this.previewText,
    required this.scale,
    required this.offset,
    this.touchIndicator,
  });

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.translate(offset.dx, offset.dy);
    canvas.scale(scale);

    paintImage(
      canvas: canvas,
      rect: Rect.fromLTWH(0, 0, background.width.toDouble(), background.height.toDouble()),
      image: background,
      fit: BoxFit.contain,
    );

    for (var s in strokes) _drawStroke(canvas, s);
    if (previewStroke != null) _drawStroke(canvas, previewStroke!);
    for (var sh in shapes) _drawShape(canvas, sh, opacity: 1.0);
    if (previewShape != null) _drawShape(canvas, previewShape!, opacity: 0.7);
    for (var t in texts) _drawText(canvas, t);
    if (previewText != null) _drawText(canvas, previewText!);

    canvas.restore();

    if (touchIndicator != null) {
      final paint = Paint()
        ..color = Colors.blue.withOpacity(0.3)
        ..style = PaintingStyle.fill;
      final border = Paint()
        ..color = Colors.blue.withOpacity(0.6)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2;
      canvas.drawCircle(touchIndicator!, 8, paint);
      canvas.drawCircle(touchIndicator!, 8, border);
    }
  }

  void _drawStroke(Canvas canvas, Stroke s) {
    if (s.points.length < 2) return;
    final paint = Paint()
      ..strokeWidth = s.width
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..color = s.color;
    final path = Path()..moveTo(s.points.first.dx, s.points.first.dy);
    for (var p in s.points.skip(1)) {
      path.lineTo(p.dx, p.dy);
    }
    canvas.drawPath(path, paint);
  }

  void _drawShape(Canvas canvas, ShapeInfo sh, {required double opacity}) {
    final paint = Paint()
      ..color = sh.color.withOpacity(opacity)
      ..style = PaintingStyle.stroke
      ..strokeWidth = max(1.0, sh.size * 0.20);
    final p = sh.position;
    final s = sh.size;
    switch (sh.type) {
      case ShapeType.rectangle:
        canvas.drawRect(Rect.fromCenter(center: p, width: s, height: s), paint);
        break;
      case ShapeType.circle:
        canvas.drawCircle(p, s / 2, paint);
        break;
      case ShapeType.pCircle:
        canvas.drawCircle(p, s / 2, paint);
        _drawShapeText(canvas, p, 'P', sh.color, s * 0.8);
        break;
      case ShapeType.sCircle:
      case ShapeType.tCircle:
        canvas.drawCircle(p, s / 2, paint);
        final txt = sh.type == ShapeType.sCircle ? 'S' : 'T';
        _drawShapeText(canvas, p, txt, sh.color, s * 0.7);
        break;
      case ShapeType.triangle:
        final path = Path()
          ..moveTo(p.dx, p.dy - s / 2)
          ..lineTo(p.dx - s / 2, p.dy + s / 2)
          ..lineTo(p.dx + s / 2, p.dy + s / 2)
          ..close();
        canvas.drawPath(path, paint);
        break;
      case ShapeType.star:
        final path = Path();
        for (int i = 0; i < 5; i++) {
          final theta = (18 + i * 72) * pi / 180;
          final x = p.dx + cos(theta) * s / 2;
          final y = p.dy - sin(theta) * s / 2;
          if (i == 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        }
        path.close();
        canvas.drawPath(path, paint);
        break;
      case ShapeType.xMark:
        canvas.drawLine(p - Offset(s / 2, s / 2), p + Offset(s / 2, s / 2), paint);
        canvas.drawLine(p + Offset(s / 2, -s / 2), p - Offset(s / 2, -s / 2), paint);
        break;
      case ShapeType.xxMark:
        final gap = s * 0.8;
        final center1 = p - Offset(gap / 2, 0);
        final center2 = p + Offset(gap / 2, 0);
        for (final center in [center1, center2]) {
          canvas.drawLine(center - Offset(s / 2, s / 2), center + Offset(s / 2, s / 2), paint);
          canvas.drawLine(center + Offset(s / 2, -s / 2), center - Offset(s / 2, -s / 2), paint);
        }
        break;
    }
  }

  void _drawShapeText(Canvas canvas, Offset center, String txt, Color color, double size) {
    final tp = TextPainter(
      text: TextSpan(
        text: txt,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: size,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, center - Offset(tp.width / 2, tp.height / 2));
  }

  void _drawText(Canvas canvas, TextInfo t) {
    final tp = TextPainter(
      text: TextSpan(text: t.text, style: t.style),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, t.position);
  }

  @override
  bool shouldRepaint(covariant ImageEditorPainter old) => true;
}

// --- 메인 화면 위젯 ---
class ImageEditorScreen extends StatefulWidget {
  final File imageFile;
  const ImageEditorScreen({required this.imageFile, Key? key}) : super(key: key);

  @override
  State<ImageEditorScreen> createState() => _ImageEditorScreenState();
}

class _ImageEditorScreenState extends State<ImageEditorScreen> {
  late ui.Image _image;
  bool _isLoaded = false;

  ToolType _tool = ToolType.pencil;
  ShapeType _selectedShape = ShapeType.rectangle;
  Color _color = Colors.red;
  double _strokeWidth = 4.0;
  double _shapeSize = 50.0;
  double _textSize = 20.0;

  final List<Stroke> _strokes = [];
  final List<ShapeInfo> _shapes = [];
  final List<TextInfo> _texts = [];

  List<Offset> _currentStroke = [];
  Offset? _lineStart;
  Stroke? _previewStroke;
  ShapeInfo? _previewShape;
  TextInfo? _previewText;

  final List<ActionItem> _undoStack = [];
  final List<ActionItem> _redoStack = [];

  final TextEditingController _textCtrl = TextEditingController();
  bool _isEditingText = false;
  Offset _textPosition = Offset.zero;

  bool _isEditingShape = false;
  double _scale = 1.0;
  Offset _offset = Offset.zero;
  final GlobalKey _canvasKey = GlobalKey();

  Offset? _lastFocalPoint;
  Offset? _touchIndicator;

  @override
  void initState() {
    super.initState();
    _loadUiImage();
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadUiImage() async {
    final data = await widget.imageFile.readAsBytes();
    final codec = await ui.instantiateImageCodec(data);
    final frame = await codec.getNextFrame();
    setState(() {
      _image = frame.image;
      _isLoaded = true;
    });
  }

  Offset _screenToImage(Offset localPosition) => (localPosition - _offset) / _scale;
  Offset _imageToScreen(Offset imagePosition) => imagePosition * _scale + _offset;

  void _addHistory(ActionItem item) {
    _undoStack.add(item);
    _redoStack.clear();
  }

  void _undo() {
    if (_isEditingShape) {
      setState(() {
        _previewShape = null;
        _isEditingShape = false;
      });
      return;
    }
    if (_undoStack.isEmpty) return;
    final last = _undoStack.removeLast();
    switch (last.type) {
      case ActionType.stroke:
        _strokes.remove(last.data as Stroke);
        break;
      case ActionType.shape:
        _shapes.remove(last.data as ShapeInfo);
        break;
      case ActionType.text:
        _texts.remove(last.data as TextInfo);
        break;
    }
    _redoStack.add(last);
    setState(() {});
  }

  void _redo() {
    if (_redoStack.isEmpty) return;
    final item = _redoStack.removeLast();
    switch (item.type) {
      case ActionType.stroke:
        _strokes.add(item.data as Stroke);
        break;
      case ActionType.shape:
        _shapes.add(item.data as ShapeInfo);
        break;
      case ActionType.text:
        _texts.add(item.data as TextInfo);
        break;
    }
    _undoStack.add(item);
    setState(() {});
  }

  void _onTapDown(TapDownDetails d) {
    if (!_isLoaded) return;
    final box = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null) return;
    final local = box.globalToLocal(d.globalPosition);
    final imgPos = _screenToImage(local);

    setState(() {
      _touchIndicator = local;
    });
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _touchIndicator = null);
    });

    if (_tool == ToolType.text) {
      _isEditingText = true;
      _textPosition = imgPos;
      _previewText = TextInfo('', imgPos, TextStyle(color: _color, fontSize: _textSize));
      _textCtrl.text = '';
      setState(() {});
      return;
    }
    if (_tool == ToolType.shape) {
      if (!_isEditingShape) {
        _previewShape = ShapeInfo(_selectedShape, imgPos, _shapeSize, _color);
        _isEditingShape = true;
        setState(() {});
        return;
      }
      if (_previewShape != null && _isEditingShape) {
        _shapes.add(_previewShape!);
        _addHistory(ActionItem(ActionType.shape, _previewShape!));
        _previewShape = null;
        _isEditingShape = false;
        setState(() {});
        return;
      }
    }
    if (_tool == ToolType.pencil) {
      _currentStroke = [imgPos];
      setState(() {});
      return;
    }
    if (_tool == ToolType.line) {
      _lineStart = imgPos;
      _previewStroke = Stroke([imgPos, imgPos], _color, _strokeWidth);
      setState(() {});
      return;
    }
  }

  void _onTapUp(TapUpDetails d) {
    if (!_isLoaded) return;
    if (_tool == ToolType.shape && _isEditingShape) return;
    if (_tool == ToolType.pencil && _currentStroke.isNotEmpty) {
      _finishStroke();
      setState(() {});
      return;
    }
  }

  void _onScaleStart(ScaleStartDetails d) {
    _lastFocalPoint = d.focalPoint;
  }

  void _onScaleUpdate(ScaleUpdateDetails d) {
    if (!_isLoaded) return;
    final box = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null) return;
    final local = box.globalToLocal(d.focalPoint);
    _lastFocalPoint = d.focalPoint;
    final imgPos = _screenToImage(local);

    if (_tool == ToolType.pencil) {
      _currentStroke.add(imgPos);
      setState(() {});
      return;
    }
    if (_tool == ToolType.line && _previewStroke != null) {
      _previewStroke!.points[1] = imgPos;
      setState(() {});
      return;
    }
    if (_tool == ToolType.shape && _previewShape != null && _isEditingShape) {
      if (d.pointerCount == 1) {
        _previewShape = ShapeInfo(_previewShape!.type, imgPos, _previewShape!.size, _previewShape!.color);
      } else if (d.pointerCount > 1) {
        final newSize = (_previewShape!.size * d.scale).clamp(15.0, 300.0).toDouble();
        _previewShape = ShapeInfo(_previewShape!.type, _previewShape!.position, newSize, _previewShape!.color);
      }
      setState(() {});
      return;
    }
  }

  void _onScaleEnd(ScaleEndDetails d) {
    if (_tool == ToolType.line && _previewStroke != null) {
      _strokes.add(_previewStroke!);
      _addHistory(ActionItem(ActionType.stroke, _previewStroke!));
      _previewStroke = null;
      _lineStart = null;
      setState(() {});
      return;
    }
    if (_tool == ToolType.shape && _isEditingShape) return;
    _onTapUp(TapUpDetails(
      kind: PointerDeviceKind.touch,
      globalPosition: _lastFocalPoint ?? Offset.zero,
    ));
  }

  void _onTextChanged(String txt) {
    _previewText = TextInfo(txt, _textPosition, TextStyle(color: _color, fontSize: _textSize));
    setState(() {});
  }

  void _finishText() {
    if (_previewText != null && _previewText!.text.isNotEmpty) {
      _texts.add(_previewText!);
      _addHistory(ActionItem(ActionType.text, _previewText!));
    }
    _isEditingText = false;
    _previewText = null;
    _textCtrl.text = '';
    setState(() {});
  }

  void _finishStroke() {
    final stroke = Stroke(List.of(_currentStroke), _color, _strokeWidth);
    _strokes.add(stroke);
    _addHistory(ActionItem(ActionType.stroke, stroke));
    _currentStroke = [];
    _lineStart = null;
  }

  Future<void> _saveAndReturn() async {
    if (_isEditingShape && _previewShape != null) {
      _shapes.add(_previewShape!);
      _addHistory(ActionItem(ActionType.shape, _previewShape!));
      _previewShape = null;
      _isEditingShape = false;
    }
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final painter = ImageEditorPainter(
      background: _image,
      strokes: _strokes,
      shapes: _shapes,
      texts: _texts,
      previewStroke: null,
      previewShape: null,
      previewText: null,
      scale: 1.0,
      offset: Offset.zero,
      touchIndicator: null,
    );
    painter.paint(canvas, Size(_image.width.toDouble(), _image.height.toDouble()));
    final picture = recorder.endRecording();
    final img = await picture.toImage(_image.width, _image.height);
    final data = await img.toByteData(format: ui.ImageByteFormat.png);
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/edited_${DateTime.now().millisecondsSinceEpoch}.png');
    await file.writeAsBytes(data!.buffer.asUint8List());
    if (!mounted) return;
    Navigator.pop(context, file);
  }

  Widget _buildToolBar() {
    return Container(
      color: Colors.grey[200]!.withOpacity(0.7),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            IconButton(icon: const Icon(Icons.undo), onPressed: _undo),
            IconButton(icon: const Icon(Icons.redo), onPressed: _redo),
            IconButton(
              icon: const Icon(Icons.brush),
              color: _tool == ToolType.pencil ? Colors.blue : null,
              onPressed: () => setState(() {
                _tool = ToolType.pencil;
                _isEditingText = false;
                _isEditingShape = false;
                _previewShape = null;
              }),
            ),
            IconButton(
              icon: const Icon(Icons.show_chart),
              color: _tool == ToolType.line ? Colors.blue : null,
              onPressed: () => setState(() {
                _tool = ToolType.line;
                _isEditingText = false;
                _isEditingShape = false;
                _previewShape = null;
              }),
            ),
            DropdownButton<ShapeType>(
              value: _tool == ToolType.shape ? _selectedShape : null,
              hint: const Icon(Icons.crop_square),
              underline: const SizedBox(),
              onChanged: (s) {
                if (s != null) {
                  setState(() {
                    _tool = ToolType.shape;
                    _isEditingText = false;
                    _selectedShape = s;
                    _previewShape = null;
                    _isEditingShape = false;
                  });
                }
              },
              items: [
                DropdownMenuItem(value: ShapeType.rectangle, child: Icon(Icons.crop_square)),
                DropdownMenuItem(value: ShapeType.circle, child: Icon(Icons.circle_outlined)),
                DropdownMenuItem(value: ShapeType.triangle, child: Icon(Icons.change_history)),
                DropdownMenuItem(value: ShapeType.star, child: Icon(Icons.star_border)),
                DropdownMenuItem(
                  value: ShapeType.sCircle,
                  child: Stack(alignment: Alignment.center, children: [Icon(Icons.circle_outlined), Text('S', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900))]),
                ),
                DropdownMenuItem(
                  value: ShapeType.tCircle,
                  child: Stack(alignment: Alignment.center, children: [Icon(Icons.circle_outlined), Text('T', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900))]),
                ),
                DropdownMenuItem(
                  value: ShapeType.pCircle,
                  child: Stack(alignment: Alignment.center, children: [Icon(Icons.circle_outlined), Text('P', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900))]),
                ),
                DropdownMenuItem(value: ShapeType.xMark, child: Icon(Icons.close)),
                DropdownMenuItem(
                  value: ShapeType.xxMark,
                  child: Row(children: [Icon(Icons.close), SizedBox(width: 4), Icon(Icons.close)]),
                ),
              ],
            ),
            IconButton(
              icon: const Icon(Icons.text_fields),
              color: _tool == ToolType.text ? Colors.blue : null,
              onPressed: () => setState(() {
                _tool = ToolType.text;
                _isEditingShape = false;
                _previewShape = null;
              }),
            ),
            DropdownButton<Color>(
              value: _color,
              underline: const SizedBox(),
              onChanged: (c) => setState(() => _color = c!),
              items: [
                Colors.red,
                Colors.orange,
                Colors.green,
                Colors.blue,
                Colors.purple,
                Colors.black,
              ]
                  .map((c) => DropdownMenuItem(
                value: c,
                child: Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(color: c, shape: BoxShape.circle),
                ),
              ))
                  .toList(),
            ),
            if (_isEditingShape)
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.check),
                  label: const Text('확정'),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
                  onPressed: () {
                    if (_previewShape != null) {
                      setState(() {
                        _shapes.add(_previewShape!);
                        _addHistory(ActionItem(ActionType.shape, _previewShape!));
                        _previewShape = null;
                        _isEditingShape = false;
                      });
                    }
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSizeSlider() {
    Widget slider = const SizedBox.shrink();
    if (_tool == ToolType.pencil || _tool == ToolType.line) {
      slider = Slider(
        min: 1.0, max: 40.0, value: _strokeWidth,
        onChanged: (v) => setState(() => _strokeWidth = v),
      );
    }
    if (_tool == ToolType.shape && !_isEditingShape) {
      slider = Slider(
        min: 30.0, max: 300.0, value: _shapeSize,
        onChanged: (v) => setState(() => _shapeSize = v),
      );
    }
    if (_tool == ToolType.text) {
      slider = Slider(
        min: 10.0, max: 200.0, value: _textSize,
        onChanged: (v) => setState(() => _textSize = v),
      );
    }
    return Container(
      color: Colors.grey[200]!.withOpacity(0.7),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: slider,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_isLoaded) return const Center(child: CircularProgressIndicator());

    final media = MediaQuery.of(context);
    final toolbarHeight = 56.0;
    final sliderHeight = 56.0;

    double imgW = _image.width.toDouble();
    double imgH = _image.height.toDouble();
    double availableWidth = media.size.width;
    double availableHeight = media.size.height - media.padding.top - toolbarHeight - sliderHeight;
    double scale = min(availableWidth / imgW, availableHeight / imgH);

    _scale = scale;
    _offset = Offset.zero; // 중앙정렬

    return Scaffold(
      appBar: AppBar(
        title: const Text('이미지 편집'),
        actions: [
          IconButton(icon: const Icon(Icons.check), onPressed: _saveAndReturn)
        ],
      ),
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Column(
            children: [
              _buildToolBar(),
              Expanded(
                child: Center(
                  child: GestureDetector(
                    key: _canvasKey,
                    behavior: HitTestBehavior.opaque,
                    onTapDown: _onTapDown,
                    onTapUp: _onTapUp,
                    onScaleStart: _onScaleStart,
                    onScaleUpdate: _onScaleUpdate,
                    onScaleEnd: _onScaleEnd,
                    child: CustomPaint(
                      size: Size(imgW * scale, imgH * scale),
                      painter: ImageEditorPainter(
                        background: _image,
                        strokes: [
                          ..._strokes,
                          if (_tool == ToolType.pencil && _currentStroke.isNotEmpty)
                            Stroke(List.of(_currentStroke), _color, _strokeWidth),
                        ],
                        shapes: _shapes,
                        texts: _texts,
                        previewStroke: _previewStroke,
                        previewShape: _previewShape,
                        previewText: _previewText,
                        scale: _scale,
                        offset: _offset,
                        touchIndicator: _touchIndicator,
                      ),
                    ),
                  ),
                ),
              ),
              _buildSizeSlider(),
            ],
          ),
          if (_isEditingText && _tool == ToolType.text)
            Positioned(
              left: _imageToScreen(_textPosition).dx,
              top: _imageToScreen(_textPosition).dy,
              child: Container(
                width: 200 * _scale,
                decoration: BoxDecoration(
                  color: Colors.white70,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: TextField(
                  controller: _textCtrl,
                  autofocus: true,
                  style: TextStyle(color: _color, fontSize: _textSize * _scale),
                  decoration: const InputDecoration(
                    filled: true,
                    fillColor: Colors.white54,
                    border: InputBorder.none,
                  ),
                  onChanged: _onTextChanged,
                  onSubmitted: (_) => _finishText(),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
