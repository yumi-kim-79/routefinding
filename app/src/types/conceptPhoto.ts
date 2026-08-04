/**
 * 개념도 사진(라인/텍스트 오버레이) 모델 — 웹 `ConceptPhotoOverlay.vue` / `ConceptPhotoEditor.vue`와 동일 규약.
 *
 * ⚠️ 좌표 규약을 웹과 반드시 동일하게 유지할 것 (docs/03 실측 주의사항):
 *   · 선·글자 위치는 **0~1 정규화 좌표**로 저장한다 (사진 원본 크기와 무관)
 *   · 선 굵기 = 컨테이너 가로의 **0.6%**
 *   · 글자 크기 = 컨테이너 세로의 **4%**, 글자 외곽선 = 글자 크기의 **18%**
 *   → 썸네일이든 전체화면이든 같은 데이터로 정확히 겹쳐 그려진다.
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { ConceptSource } from './concept';

export interface NormPoint {
  x: number;
  y: number;
}

/** 한 획 */
export interface PhotoLine {
  points: NormPoint[];
  color: string;
}

/** 글자 하나 */
export interface PhotoText {
  x: number;
  y: number;
  text: string;
  color: string;
}

/** `concept_photos` 문서 (웹이 쓰는 필드 그대로) */
export interface ConceptPhoto {
  id: string;
  conceptId: string;
  conceptSource: ConceptSource;
  conceptTitle: string;
  authorUid: string;
  authorEmail: string;
  /** 원본 */
  imageUrl: string;
  storagePath: string;
  /** 라인 합성본 (선이 없으면 빈 문자열) */
  flatUrl: string;
  flatPath: string;
  lines: PhotoLine[];
  texts: PhotoText[];
  status: 'pending' | 'approved' | 'rejected';
  /** 반려 사유 (관리자가 남긴 값) */
  rejectionReason?: string;
  createdAt?: FirebaseFirestoreTypes.Timestamp;
}

/** 그리기 기본색 6종 — 웹 COLORS와 동일 순서 */
export const PHOTO_COLORS = [
  '#ff2d2d',
  '#ffe14d',
  '#31d158',
  '#3d8bff',
  '#ffffff',
  '#000000',
] as const;

export const STROKE_RATIO = 0.006;
export const FONT_RATIO = 0.04;
/** 글자 외곽선 = 글자 크기의 18% */
export const TEXT_STROKE_RATIO = 0.18;

/**
 * 정규화 좌표 → 부드러운 SVG path (웹 `toPath`와 동일 알고리즘).
 *
 * 점을 그대로 이으면 손 떨림만큼 각져 보인다.
 * 각 점을 제어점으로 쓰고 **이웃한 두 점의 중점**을 지나는 2차 베지어로 이으면
 * 점이 적어도 매끄럽다.
 */
export function toPath(points: NormPoint[], w: number, h: number): string {
  if (!Array.isArray(points) || points.length === 0) {
    return '';
  }
  const P = points.map((p) => ({ x: p.x * w, y: p.y * h }));
  if (P.length === 1) {
    return `M ${P[0].x} ${P[0].y} L ${P[0].x} ${P[0].y}`;
  }
  if (P.length === 2) {
    return `M ${P[0].x} ${P[0].y} L ${P[1].x} ${P[1].y}`;
  }
  let d = `M ${P[0].x} ${P[0].y}`;
  for (let i = 1; i < P.length - 1; i += 1) {
    const mx = (P[i].x + P[i + 1].x) / 2;
    const my = (P[i].y + P[i + 1].y) / 2;
    d += ` Q ${P[i].x} ${P[i].y} ${mx} ${my}`;
  }
  const last = P[P.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}
