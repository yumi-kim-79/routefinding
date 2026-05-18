import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

Future<void> checkForUpdate(BuildContext context) async {
  final packageInfo = await PackageInfo.fromPlatform();
  final currentVersion = packageInfo.version;
  const packageName = 'com.example.routefinding'; // ★ 실제 앱 패키지명으로 수정

  final url = 'https://play.google.com/store/apps/details?id=$packageName&hl=ko';
  final response = await http.get(Uri.parse(url));

  if (response.statusCode == 200) {
    final latestVersion = _extractLatestVersion(response.body);
    if (_isNewerVersion(latestVersion, currentVersion)) {
      _showUpdateDialog(context);
    }
  } else {
    print("업데이트 확인 실패: ${response.statusCode}");
  }
}

String _extractLatestVersion(String html) {
  final regex = RegExp(r'현재 버전</div><span[^>]*>([\d.]+)</span>');
  final match = regex.firstMatch(html);
  return match?.group(1) ?? '';
}

bool _isNewerVersion(String latest, String current) {
  final latestParts = latest.split('.').map(int.parse).toList();
  final currentParts = current.split('.').map(int.parse).toList();

  for (int i = 0; i < latestParts.length; i++) {
    if (i >= currentParts.length || latestParts[i] > currentParts[i]) return true;
    if (latestParts[i] < currentParts[i]) return false;
  }
  return false;
}

void _showUpdateDialog(BuildContext context) {
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (_) => AlertDialog(
      title: const Text('업데이트 필요'),
      content: const Text('새로운 버전이 출시되었습니다. 앱을 업데이트 해주세요.'),
      actions: [
        TextButton(
          onPressed: () async {
            const url = 'https://play.google.com/store/apps/details?id=com.example.routefinding'; // ★ 패키지명 확인
            if (await canLaunchUrl(Uri.parse(url))) {
              await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
            }
          },
          child: const Text('업데이트 하기'),
        ),
      ],
    ),
  );
}
