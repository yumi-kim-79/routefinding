/**
 * 제보(리포트) 타입 — `route_reports`(자연암벽) / `bouldering_reports`(인공벽 등) 공용 최소판.
 * v1 mypage_screen.dart::_buildMyReportsTab 실측 필드 기반(전체 스키마는 Phase 2-5에서 확장).
 *
 * v1 실측: `timestamp`, `rejectionReason`(02_DATA_MODEL의 rejectReason ≠), `imageUrls[0]` 첫 이미지 사용.
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export type ReportStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type ReportCollection = 'route_reports' | 'bouldering_reports';

export interface Report {
  reportId: string;
  /** 머지 시 우리가 부여하는 컬렉션 태그(삭제/업데이트 분기용 — v1 휴리스틱 대체) */
  collection: ReportCollection;

  authorUid: string;
  mountain?: string;
  routeName?: string;
  imageUrls?: string[];

  status?: ReportStatus;
  /** ⚠️ v1 실측: `rejectionReason` (rejectReason 아님) */
  rejectionReason?: string;
  /**
   * 레거시/오기재 대비. 02_DATA_MODEL 초안과 일부 옛 문서가 `rejectReason`을 썼다.
   * 쓰기는 항상 `rejectionReason`으로 하고, **읽을 때만** 둘 다 본다.
   */
  rejectReason?: string;

  /** ⚠️ v1 실측: `timestamp` (createdAt 아님) */
  timestamp?: FirebaseFirestoreTypes.Timestamp;
}

/** v1 _statusToKorean 1:1 */
export function statusToKorean(s?: ReportStatus | string): string {
  switch (s) {
    case 'draft':
      return '임시 저장';
    case 'pending':
      return '승인 대기';
    case 'approved':
      return '승인 완료';
    case 'rejected':
      return '반려됨';
    default:
      return s ?? '';
  }
}
