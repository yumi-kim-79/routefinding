/**
 * 루트제보 **작성 폼** 모델 (웹 `views/ReportView.vue` 1:1).
 *
 * 저장되는 Firestore 문서 필드는 웹과 완전히 동일하다 — 기존 스키마 변경 금지(CLAUDE.md).
 * 읽기 전용 모델은 `types/concept.ts`(개념도) / `types/report.ts`(내 제보 관리)를 쓴다.
 */
import type { ConceptType } from './concept';

/** 폼에서 고른 로컬 이미지 1장 */
export interface LocalImage {
  /** 목록 key + 순서 변경용 고유 id */
  uid: string;
  /** image-picker가 준 로컬 uri (file:// 또는 content://) */
  uri: string;
  /** 이미 업로드된 이미지를 다시 보여줄 때(수정 모드) — 있으면 재업로드하지 않는다 */
  remoteUrl?: string;
}

/** 피치 1개 (리드 전용). 웹 pitches[] 원소와 필드명 동일 */
export interface PitchInput {
  uid: string;
  name: string;
  length: string;
  difficulty: string;
  style: string;
  gear: string;
  images: LocalImage[];
}

/** 폼 전체 상태 */
export interface ReportForm {
  typeRoot: ConceptType;

  /** 등반지 — 목록에서 고르거나 직접 입력 */
  mountain: string;
  zone: string;

  routeName: string;
  latitude: string;
  longitude: string;

  images: LocalImage[];

  /** 리드 전용 */
  overview: string;
  type: string;
  equipment: string;
  avgDifficulty: string;
  pioneer: string;
  pitches: PitchInput[];

  /** 볼더링 전용 */
  directions: string;
  no: string;
  difficulty: string;

  /** GPX 파일 (선택) */
  gpxUri: string | null;
  gpxName: string | null;
}

/** 사진 최대 장수 — 웹과 동일 */
export const MAX_ROOT_IMAGES = 8;
export const MAX_PITCH_IMAGES = 4;

/** 목록·순서 관리를 위한 고유 id (웹 genUid 대응) */
export function genUid(): string {
  return `${Math.random().toString(36).slice(2, 10)}${Date.now()}`;
}

export function emptyPitch(): PitchInput {
  return { uid: genUid(), name: '', length: '', difficulty: '', style: '', gear: '', images: [] };
}

export function emptyReportForm(typeRoot: ConceptType = '리드'): ReportForm {
  return {
    typeRoot,
    mountain: '',
    zone: '',
    routeName: '',
    latitude: '',
    longitude: '',
    images: [],
    overview: '',
    type: '',
    equipment: '',
    avgDifficulty: '',
    pioneer: '',
    pitches: [],
    directions: '',
    no: '',
    difficulty: '',
    gpxUri: null,
    gpxName: null,
  };
}
