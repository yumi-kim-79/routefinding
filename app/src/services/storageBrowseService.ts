/**
 * Storage에 이미 올라가 있는 루트 사진 목록 조회 (관리자 복구용).
 *
 * 왜 필요한가 — 2026-08-05 실측:
 *   개념도 문서를 실수로 삭제해도 **Storage의 사진 파일은 지워지지 않는다.**
 *   루트를 다시 만들 때 사진을 처음부터 다시 올릴 필요 없이, 남아 있는 파일을
 *   그대로 붙일 수 있어야 한다. (Firestore 문서 삭제는 되돌릴 수 없지만 사진은 살아 있다)
 *
 * 경로 규약은 업로드와 동일: `route_images/{산}/{구역|미지정}/{루트}`
 */
import { getDownloadURL, list, ref } from '@react-native-firebase/storage';
import { storage } from './firebase';

export interface StoredImage {
  /** Storage 전체 경로 */
  path: string;
  /** 파일명 (화면 표시용) */
  name: string;
  /** 바로 쓸 수 있는 다운로드 URL */
  url: string;
}

/** 업로드와 같은 치환 규칙 (reportService.safe와 동일) */
function safe(v: string): string {
  return v.replace(/[/\\]/g, '_');
}

export function routeImageFolder(mountain: string, zone: string, routeName: string): string {
  const zoneSeg = zone.trim() ? safe(zone.trim()) : '미지정';
  return `route_images/${safe(mountain.trim())}/${zoneSeg}/${safe(routeName.trim())}`;
}

/**
 * 해당 루트 폴더의 이미지들을 최신 순으로 돌려준다.
 * @param maxResults 한 번에 가져올 최대 개수 (기본 50)
 */
export async function listRouteImages(
  mountain: string,
  zone: string,
  routeName: string,
  maxResults = 50,
): Promise<StoredImage[]> {
  if (!mountain.trim() || !routeName.trim()) {
    return [];
  }
  const folder = routeImageFolder(mountain, zone, routeName);
  const result = await list(ref(storage, folder), { maxResults });

  const items = await Promise.all(
    result.items.map(async (item) => {
      try {
        return {
          path: item.fullPath,
          name: item.name,
          url: await getDownloadURL(item),
        };
      } catch {
        // 개별 파일 실패는 건너뛴다 (권한·삭제 등)
        return null;
      }
    }),
  );

  return items
    .filter((x): x is StoredImage => x !== null)
    // 파일명이 root_1, root_2 … 순서라 이름순이 곧 원래 순서다
    .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
}
