// lib/widgets/fullscreen_photo_viewer.dart

import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';

class FullscreenPhotoViewer extends StatelessWidget {
  final List<String> urls;
  final int initialIndex;

  const FullscreenPhotoViewer({
    Key? key,
    required this.urls,
    this.initialIndex = 0,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: PhotoViewGallery.builder(
        itemCount: urls.length,
        pageController: PageController(initialPage: initialIndex),
        builder: (ctx, i) => PhotoViewGalleryPageOptions(
          imageProvider: CachedNetworkImageProvider(urls[i]),
          minScale: PhotoViewComputedScale.contained,
          maxScale: PhotoViewComputedScale.covered * 2,
        ),
        loadingBuilder: (ctx, event) =>
        const Center(child: CircularProgressIndicator()),
        backgroundDecoration: const BoxDecoration(color: Colors.black),
      ),
    );
  }
}
