// lib/crew_main_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'crew_detail_screen.dart';
import 'crew_create_screen.dart'; // 실제 경로로 맞춰주세요

class CrewMainScreen extends StatefulWidget {
  const CrewMainScreen({Key? key}) : super(key: key);

  @override
  State<CrewMainScreen> createState() => _CrewMainScreenState();
}

class _CrewMainScreenState extends State<CrewMainScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _goToCreateCrew() async {
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => CrewCreateScreen()),
    );
    if (created == true) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('크루'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: '내 크루'),
            Tab(text: '전체 크루'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          MyCrewsTab(),
          AllCrewsTab(),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('크루 개설'),
        onPressed: _goToCreateCrew,
      ),
    );
  }
}

/// 내가 속한 크루 탭
class MyCrewsTab extends StatelessWidget {
  const MyCrewsTab({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return const Center(child: Text('로그인 필요'));

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance.collection('crews').snapshots(),
      builder: (ctx, snap) {
        if (!snap.hasData) return const Center(child: CircularProgressIndicator());
        final docs = snap.data!.docs;

        return FutureBuilder<List<QueryDocumentSnapshot>>(
          future: Future.wait(docs.map((doc) async {
            final memberDoc = await doc.reference.collection('members').doc(uid).get();
            return memberDoc.exists ? doc : null;
          }))
              .then((list) => list.whereType<QueryDocumentSnapshot>().toList()),
          builder: (ctx2, memSnap) {
            if (!memSnap.hasData) return const Center(child: CircularProgressIndicator());
            final myDocs = memSnap.data!;
            if (myDocs.isEmpty) return const Center(child: Text('가입된 크루가 없습니다.'));

            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: myDocs.length,
              itemBuilder: (c, i) {
                final data = myDocs[i].data() as Map<String, dynamic>;
                return CrewCard(
                  crew: data,
                  crewId: myDocs[i].id,
                  showAllTabs: true,
                );
              },
            );
          },
        );
      },
    );
  }
}

/// 전체 크루 탭
class AllCrewsTab extends StatelessWidget {
  const AllCrewsTab({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('crews')
          .orderBy('createdAt', descending: true)
          .snapshots(),
      builder: (ctx, snap) {
        if (!snap.hasData) return const Center(child: CircularProgressIndicator());
        final docs = snap.data!.docs;
        if (docs.isEmpty) return const Center(child: Text('등록된 크루가 없습니다.'));

        return ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: docs.length,
          itemBuilder: (c, i) {
            final data = docs[i].data() as Map<String, dynamic>;
            final crewId = docs[i].id;
            return FutureBuilder<DocumentSnapshot>(
              future: FirebaseFirestore.instance
                  .collection('crews')
                  .doc(crewId)
                  .collection('members')
                  .doc(uid)
                  .get(),
              builder: (c2, memSnap) {
                final isMember = memSnap.data?.exists ?? false;
                return CrewCard(
                  crew: data,
                  crewId: crewId,
                  showAllTabs: isMember,
                );
              },
            );
          },
        );
      },
    );
  }
}

/// 크루 카드 위젯 (공통)
class CrewCard extends StatelessWidget {
  final Map<String, dynamic> crew;
  final String crewId;
  final bool showAllTabs;

  const CrewCard({
    required this.crew,
    required this.crewId,
    required this.showAllTabs,
    Key? key,
  }) : super(key: key);

  String? _getThumbnail() {
    final imgs = crew['images'] as List<dynamic>? ?? [];
    if (imgs.isNotEmpty) return imgs.first as String;
    final url = crew['imageUrl'] as String?;
    return (url?.isNotEmpty ?? false) ? url : null;
  }

  @override
  Widget build(BuildContext context) {
    final thumb = _getThumbnail();
    final name = crew['name'] as String? ?? '크루명 없음';
    final intro = crew['intro'] as String? ?? '';
    final leader = crew['leaderNickname'] as String? ?? '-';

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      elevation: 2,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => CrewDetailScreen(
              crewId: crewId,
              showAllTabs: showAllTabs,
            ),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 썸네일
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: thumb != null
                    ? Image.network(thumb, width: 54, height: 54, fit: BoxFit.cover)
                    : Container(
                  width: 54,
                  height: 54,
                  color: Colors.grey[300],
                  child: const Icon(Icons.groups, color: Colors.white54, size: 30),
                ),
              ),
              const SizedBox(width: 14),
              // 텍스트 영역
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 크루 이름
                    Text(name,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 4),
                    // 리더·멤버 수 - 실제 subcollection 개수를 가져오도록 FutureBuilder 로 변경
                    FutureBuilder<QuerySnapshot>(
                      future: FirebaseFirestore.instance
                          .collection('crews')
                          .doc(crewId)
                          .collection('members')
                          .get(),
                      builder: (ctx, snap) {
                        if (!snap.hasData) {
                          return Text('리더: $leader  ·  멤버: ...명',
                              style: TextStyle(fontSize: 13, color: Colors.grey[800]));
                        }
                        final count = snap.data!.docs.length;
                        return Text('리더: $leader  ·  멤버: ${count}명',
                            style: TextStyle(fontSize: 13, color: Colors.grey[800]));
                      },
                    ),
                    const SizedBox(height: 6),
                    // 소개글
                    Text(intro,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13, color: Colors.black87)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
