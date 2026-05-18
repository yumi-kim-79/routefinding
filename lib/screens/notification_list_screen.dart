// lib/screens/notification_list_screen.dart
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'package:routefinding/post_detail_screen.dart';
import 'package:routefinding/comment_detail_screen.dart';
import 'package:routefinding/generic_route_detail_screen.dart';

class NotificationListScreen extends StatefulWidget {
  const NotificationListScreen({Key? key}) : super(key: key);

  @override
  State<NotificationListScreen> createState() => _NotificationListScreenState();
}

class _NotificationListScreenState extends State<NotificationListScreen> {
  bool _isSelectionMode = false;
  final Set<String> _selectedIds = {};
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _latestDocs = [];

  @override
  void initState() {
    super.initState();
    _markAllAsRead();
  }

  Future<void> _markAllAsRead() async {
    final uid = FirebaseAuth.instance.currentUser!.uid;
    final batch = FirebaseFirestore.instance.batch();
    final snap = await FirebaseFirestore.instance
        .collection('notifications')
        .where('receiverId', isEqualTo: uid)
        .where('checked', isEqualTo: false)
        .get();
    for (var doc in snap.docs) {
      batch.update(doc.reference, {'checked': true});
    }
    await batch.commit();
  }

  void _handleNotificationTap(Map<String, dynamic> d) {
    final type = d['type'] as String? ?? '';

    if ((type == 'post' || type == 'reply_to_post') && d['postId'] != null) {
      Navigator.push(context, MaterialPageRoute(
        builder: (_) => PostDetailScreen(postId: d['postId']),
      ));
      return;
    }
    if ((type == 'comment' || type == 'reply_to_comment') &&
        d['postId'] != null && d['commentId'] != null) {
      Navigator.push(context, MaterialPageRoute(
        builder: (_) => CommentDetailScreen(
          parentPostId: d['postId'],
          commentId: d['commentId'],
        ),
      ));
      return;
    }
    if (type == 'route_rejected' && d['reportId'] != null) {
      Navigator.push(context, MaterialPageRoute(
        builder: (_) => GenericRouteDetailScreen(
          routeRef: FirebaseFirestore.instance.collection('route_reports').doc(d['reportId']),
          title: '제보 상세',
        ),
      ));
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('연결된 문서가 없거나 이동할 수 없습니다.')),
    );
  }

  void _onLongPress(String id) {
    if (!_isSelectionMode) {
      setState(() {
        _isSelectionMode = true;
        _selectedIds.add(id);
      });
    }
  }

  void _onSelect(String id, bool selected) {
    setState(() {
      if (selected) {
        _selectedIds.add(id);
      } else {
        _selectedIds.remove(id);
      }
      if (_selectedIds.isEmpty) _isSelectionMode = false;
    });
  }

  void _exitSelectionMode() {
    setState(() {
      _isSelectionMode = false;
      _selectedIds.clear();
    });
  }

  void _toggleSelectAll() {
    setState(() {
      if (_selectedIds.length == _latestDocs.length) {
        _selectedIds.clear();
      } else {
        _selectedIds
          ..clear()
          ..addAll(_latestDocs.map((d) => d.id));
      }
    });
  }

  Future<void> _deleteSelected(List<QueryDocumentSnapshot<Map<String, dynamic>>> docs) async {
    if (_selectedIds.isEmpty) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('알림 삭제'),
        content: Text('${_selectedIds.length}개의 알림을 삭제하시겠습니까?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('취소')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('삭제')),
        ],
      ),
    );
    if (confirm != true) return;

    final batch = FirebaseFirestore.instance.batch();
    for (var doc in docs) {
      if (_selectedIds.contains(doc.id)) {
        batch.delete(doc.reference);
      }
    }
    await batch.commit();
    _exitSelectionMode();
  }

  Widget _buildNotificationTile(QueryDocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data();
    final isNew = d['checked'] == false;
    final ts = d['timestamp'] as Timestamp?;
    final time = ts != null
        ? ts.toDate().toLocal().toString().substring(0, 16)
        : '';
    final isSelected = _selectedIds.contains(doc.id);

    return GestureDetector(
      onLongPress: () => _onLongPress(doc.id),
      child: ListTile(
        leading: _isSelectionMode
            ? Checkbox(
          value: isSelected,
          onChanged: (v) => _onSelect(doc.id, v ?? false),
        )
            : Icon(
          Icons.notifications,
          color: isNew ? Colors.red : Colors.grey,
        ),
        title: Text(d['message'] as String? ?? ''),
        subtitle: Text(d['type'] as String? ?? ''),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              time,
              style: const TextStyle(fontSize: 12, color: Colors.black54),
            ),
            if (!_isSelectionMode)
              IconButton(
                icon: const Icon(Icons.check_box_outlined, size: 22),
                color: Colors.black26,
                tooltip: '선택모드',
                onPressed: () => _onLongPress(doc.id),
              ),
          ],
        ),
        selected: isSelected,
        selectedTileColor: Colors.yellow.shade50,
        onTap: () {
          if (_isSelectionMode) {
            _onSelect(doc.id, !isSelected);
          } else {
            _handleNotificationTap(d);
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser!.uid;
    return Scaffold(
      appBar: AppBar(
        title: Text(_isSelectionMode
            ? '알림 선택 (${_selectedIds.length})'
            : '알림 리스트'),
        leading: _isSelectionMode
            ? IconButton(
          icon: const Icon(Icons.close),
          onPressed: _exitSelectionMode,
        )
            : null,
        actions: [
          if (_isSelectionMode)
            IconButton(
              icon: Icon(
                _selectedIds.length == _latestDocs.length && _latestDocs.isNotEmpty
                    ? Icons.select_all
                    : Icons.library_add_check_outlined,
                color: Colors.blue,
              ),
              tooltip: _selectedIds.length == _latestDocs.length && _latestDocs.isNotEmpty
                  ? '전체 선택 해제'
                  : '전체 선택',
              onPressed: _latestDocs.isEmpty ? null : _toggleSelectAll,
            ),
        ],
      ),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance
            .collection('notifications')
            .where('receiverId', isEqualTo: uid)
            .orderBy('timestamp', descending: true)
            .snapshots(),
        builder: (context, snap) {
          if (snap.hasError) {
            return Center(child: Text('에러: ${snap.error}'));
          }
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final docs = snap.data!.docs;
          _latestDocs = docs;

          if (docs.isEmpty) {
            return const Center(child: Text('알림이 없습니다.'));
          }

          return Column(
            children: [
              if (_isSelectionMode)
                Container(
                  color: Colors.yellow.shade50,
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Center(
                    child: Text(
                      '삭제할 알림을 선택하세요.',
                      style: TextStyle(color: Colors.orange.shade800),
                    ),
                  ),
                ),
              Expanded(
                child: ListView.separated(
                  itemCount: docs.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) => _buildNotificationTile(docs[i]),
                ),
              ),
              if (_isSelectionMode)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.delete),
                          label: const Text('선택 삭제'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.red.shade700),
                          onPressed: () => _deleteSelected(_latestDocs),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
