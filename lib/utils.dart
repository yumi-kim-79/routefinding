import 'package:firebase_auth/firebase_auth.dart';

bool isAdmin() {
  final u = FirebaseAuth.instance.currentUser;
  return u != null && u.email == 'yusung790926@gmail.com';
}
