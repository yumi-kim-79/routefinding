/**
 * GPX 트랙 읽기 — 첨부된 접근로 파일을 지도에 그리기 위한 파싱·조회.
 *
 * 왜 필요한가 (2026-08-05):
 *   v2에서 **어프로치 실시간 기록(GPS 따라가기)을 없앴다.** 대신 GPX 파일을 첨부하는데,
 *   앱에는 그 파일을 **보는 기능이 없었다** (개념도 상세에 '등록됨' 글자만 떴다).
 *   웹도 GPX 자체는 그리지 않고 옛 `trackingPath` 배열만 그린다 → 앱이 먼저 제대로 만든다.
 *
 * 파서를 라이브러리로 넣지 않는 이유:
 *   GPX에서 우리가 쓰는 건 `<trkpt lat lon>` 좌표뿐이다. XML 파서를 통째로 넣는 것보다
 *   정규식 한 줄이 가볍고, 깨진 파일에도 관대하다(산에서 만든 파일은 종종 불완전하다).
 */

import { resolveImageUrl } from './imageUrlService';

export interface TrackPoint {
  latitude: number;
  longitude: number;
}

/** 여러 번 열어도 다시 내려받지 않도록 (앱 수명 캐시) */
const cache = new Map<string, TrackPoint[]>();

/**
 * GPX 문자열 → 좌표 배열.
 *
 * `<trkpt>`(트랙)를 우선 쓰고, 없으면 `<rtept>`(경로), 그것도 없으면 `<wpt>`(지점)를 본다.
 * 속성 순서(lat/lon)가 바뀐 파일도 있어 각각 따로 찾는다.
 */
export function parseGpx(xml: string): TrackPoint[] {
  const collect = (tag: string): TrackPoint[] => {
    const out: TrackPoint[] = [];
    const re = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    const matches = xml.match(re);
    if (!matches) {
      return out;
    }
    matches.forEach((tagStr) => {
      const lat = /\blat\s*=\s*["']([-\d.]+)["']/i.exec(tagStr);
      const lon = /\blon\s*=\s*["']([-\d.]+)["']/i.exec(tagStr);
      if (!lat || !lon) {
        return;
      }
      const la = Number(lat[1]);
      const lo = Number(lon[1]);
      if (Number.isFinite(la) && Number.isFinite(lo) && (la !== 0 || lo !== 0)) {
        out.push({ latitude: la, longitude: lo });
      }
    });
    return out;
  };

  const trk = collect('trkpt');
  if (trk.length > 0) {
    return trk;
  }
  const rte = collect('rtept');
  if (rte.length > 0) {
    return rte;
  }
  return collect('wpt');
}

/**
 * URL에서 GPX를 받아 좌표 배열로 (실패 시 예외).
 *
 * ⚠️ 이미지와 **같은 문제**가 GPX에도 있다. DB에 `https://storage.googleapis.com/...`
 *    원본 주소로 저장된 문서가 있는데, 그건 Storage 규칙이 아니라 GCS IAM을 타므로 403이 난다.
 *    `resolveImageUrl`이 다운로드 URL로 바꿔준다(이미 정상 주소면 그대로 통과).
 */
export async function fetchGpxTrack(rawUrl: string): Promise<TrackPoint[]> {
  const hit = cache.get(rawUrl);
  if (hit) {
    return hit;
  }
  const url = await resolveImageUrl(rawUrl);
  if (!url) {
    throw new Error('GPX 주소를 확인하지 못했습니다.');
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GPX를 내려받지 못했습니다 (HTTP ${res.status})`);
  }
  const xml = await res.text();
  const points = parseGpx(xml);
  if (points.length === 0) {
    throw new Error('GPX에서 좌표를 찾지 못했습니다. 파일 형식을 확인해 주세요.');
  }
  cache.set(rawUrl, points);
  return points;
}

/** 두 점 사이 거리(m) — 하버사인 */
function distanceM(a: TrackPoint, b: TrackPoint): number {
  const R = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 트랙 총 길이(m) */
export function trackLengthM(points: TrackPoint[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i += 1) {
    sum += distanceM(points[i - 1], points[i]);
  }
  return sum;
}

/** 사람이 읽는 길이 표기 */
export function trackLengthLabel(points: TrackPoint[]): string {
  const m = trackLengthM(points);
  return m >= 1000 ? `${(m / 1000).toFixed(2)}km` : `${Math.round(m)}m`;
}
