// lib/constants/firestore_fields.dart

/// ------------------------------------------------
/// Firestore 필드명 상수 모음
/// ------------------------------------------------

class RouteFields {
  static const mountain        = 'mountain';       // 산 이름
  static const zone            = 'zone';           // 구역
  static const overview        = 'overview';       // 개요
  static const type            = 'type';           // 형태
  static const equipment       = 'equipment';      // 장비
  static const avgDifficulty   = 'avgDifficulty';  // 평균 난이도
  static const pioneer         = 'pioneer';        // 개척자
  static const latitude        = 'latitude';       // 위도
  static const longitude       = 'longitude';      // 경도
  static const imageName       = 'imageName';      // 이미지 파일명
  static const imageUrl        = 'imageUrl';       // 이미지 URL
  static const routeName       = 'routeName';      // 루트 이름 (문서 ID)
  static const status          = 'status';         // 상태 (draft/pending/approved/rejected 등)
  static const rejectionReason = 'rejectionReason';// 거절 사유
  static const authorUid       = 'authorUid';      // 제보자 UID
  static const timestamp       = 'timestamp';      // 생성/수정 시각
  static const authorName      = 'authorName';     // 작성자


  // ↓ 새롭게 추가된 필드
  static const trackingPath    = 'trackingPath';   // 트래킹 경로 (List<GeoPoint>)
  static const difficulty = 'difficulty';  // 볼더링
}

class PitchFields {
  static const name        = 'name';        // 피치 이름
  static const length      = 'length';      // 피치 길이
  static const difficulty  = 'difficulty';  // 피치 난이도
  static const style       = 'style';       // 피치 형태
  static const gear        = 'gear';        // 피치 장비
  static const imageName   = 'imageName';   // 피치 이미지 파일명
  static const imageUrl    = 'imageUrl';    // 피치 이미지 URL
  static const timestamp   = 'timestamp';   // 피치 생성 시각
}

class PostFields {
  static const category  = 'category';
  static const title     = 'title';
  static const content   = 'content';
  static const imageUrl  = 'imageUrl';
  static const images    = 'images';
  static const userId    = 'userId';
  static const timestamp = 'timestamp';
  static const authorUid   = 'authorUid';
  static const String isPinned = 'isPinned';

}

class CommentFields {
  static const text      = 'text';
  static const userId    = 'userId';
  static const timestamp = 'timestamp';
}
