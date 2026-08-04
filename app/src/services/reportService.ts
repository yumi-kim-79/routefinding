/**
 * 루트제보 저장 서비스.
 *
 * CLAUDE.md: 비용 발생 호출(Storage 쓰기 · Firestore 쓰기)은 service 모듈로 격리한다.
 *
 * 저장 경로·필드는 **웹 ReportView.vue와 1:1**이다. 기존 스키마를 바꾸지 않는다
 * (docs/02_DATA_MODEL.md). 하나라도 어긋나면 v1 앱과 웹이 못 읽는다.
 *
 *   대표 이미지  route_images/{산}/{구역|미지정}/{루트}/root_{n}.jpg
 *   피치 이미지  pitch_images/{산}/{루트}/pitch{i}_{j}.jpg
 *   GPX         route_gpx/{산}/{루트}/approach_{ts}.gpx
 *
 * ⚠️ 등반지/구역 목록은 웹처럼 컬렉션 전체를 다시 읽지 않고
 *    `conceptService.fetchConcepts()`의 5분 캐시를 재사용한다 (승인 루트 5,407건).
 *    차이: 웹은 status 무관 전체를, 우리는 승인분만 본다 → 목록이 약간 좁을 수 있으나
 *    읽기 비용과 대기시간이 없다. 직접 입력이 항상 가능하므로 기능 손실은 없다.
 */
import { addDoc, collection, deleteDoc, doc, updateDoc } from '@react-native-firebase/firestore';
import { getDownloadURL, putFile, ref } from '@react-native-firebase/storage';
import { auth, db, storage } from './firebase';
import { clearConceptCache, fetchConcepts } from './conceptService';
import type { Concept, ConceptSource, ConceptType } from '../types/concept';
import { genUid, type LocalImage, type ReportForm } from '../types/routeReport';

/** 타입 → 컬렉션 (웹과 동일) */
export function collectionOf(typeRoot: ConceptType): ConceptSource {
  return typeRoot === '리드' ? 'route_reports' : 'bouldering_reports';
}

/** Storage 경로에 쓸 수 없는 문자 치환 (웹 replace(/[\/\\]/g,'_')와 동일) */
function safe(v: string): string {
  return v.replace(/[/\\]/g, '_');
}

/** 선택한 타입에 존재하는 등반지 목록 */
export async function fetchMountains(typeRoot: ConceptType): Promise<string[]> {
  const { items } = await fetchConcepts(false);
  const set = new Set<string>();
  items
    .filter((c) => c.type === typeRoot)
    .forEach((c) => {
      const m = c.mountain?.trim();
      if (m) {
        set.add(m);
      }
    });
  return Array.from(set).sort();
}

/** 선택한 등반지의 구역 목록 */
export async function fetchZones(typeRoot: ConceptType, mountain: string): Promise<string[]> {
  if (!mountain.trim()) {
    return [];
  }
  const { items } = await fetchConcepts(false);
  const set = new Set<string>();
  items
    .filter((c) => c.type === typeRoot && c.mountain === mountain && c.zone)
    .forEach((c) => set.add(c.zone as string));
  return Array.from(set).sort();
}

/** 로컬 파일 1개 업로드 → 다운로드 URL */
async function upload(path: string, localUri: string): Promise<string> {
  const r = ref(storage, path);
  await putFile(r, localUri);
  return getDownloadURL(r);
}

/**
 * 이미 올라간 이미지는 URL을 그대로 재사용하고, 새로 고른 것만 업로드한다
 * (웹 submit의 `!file && previewUrl.startsWith('http')` 분기와 동일).
 */
async function uploadImages(
  images: LocalImage[],
  pathAt: (index: number) => string,
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < images.length; i += 1) {
    const img = images[i];
    if (img.remoteUrl) {
      urls.push(img.remoteUrl);
    } else {
      urls.push(await upload(pathAt(i), img.uri));
    }
  }
  return urls;
}

export interface SubmitResult {
  reportId: string;
  collection: ConceptSource;
}

/**
 * 제보 저장. 이미지·GPX 업로드 후 Firestore에 `status: 'pending'`으로 추가한다.
 * @throws 검증 실패 / 업로드 실패 메시지
 */
export async function submitReport(form: ReportForm): Promise<SubmitResult> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }
  const mountain = form.mountain.trim();
  const routeName = form.routeName.trim();
  if (!mountain) {
    throw new Error('등반지를 입력하세요.');
  }
  if (!routeName) {
    throw new Error('루트 이름을 입력하세요.');
  }
  if (!form.latitude || !form.longitude) {
    throw new Error('위치 좌표를 지정해주세요.');
  }

  const safeM = safe(mountain);
  const safeR = safe(routeName);
  const zoneSeg = form.zone.trim() ? safe(form.zone.trim()) : '미지정';

  // 대표 이미지
  const imageUrls = await uploadImages(
    form.images,
    (i) => `route_images/${safeM}/${zoneSeg}/${safeR}/root_${i + 1}.jpg`,
  );

  // 피치 이미지 (리드만 실제로 값이 있다)
  const pitches = [];
  for (let i = 0; i < form.pitches.length; i += 1) {
    const p = form.pitches[i];
    const urls = await uploadImages(
      p.images,
      (j) => `pitch_images/${safeM}/${safeR}/pitch${i + 1}_${j + 1}.jpg`,
    );
    pitches.push({
      name: p.name,
      length: p.length,
      difficulty: p.difficulty,
      style: p.style,
      gear: p.gear,
      imageUrls: urls,
    });
  }

  // GPX
  let gpxUrl = '';
  if (form.gpxUri) {
    gpxUrl = await upload(`route_gpx/${safeM}/${safeR}/approach_${Date.now()}.gpx`, form.gpxUri);
  }

  const payload = {
    typeRoot: form.typeRoot,
    mountain,
    routeName,
    latitude: parseFloat(form.latitude),
    longitude: parseFloat(form.longitude),
    imageUrls,
    overview: form.overview,
    type: form.type,
    equipment: form.equipment,
    avgDifficulty: form.avgDifficulty,
    pioneer: form.pioneer,
    zone: form.zone,
    directions: form.directions,
    no: form.no,
    difficulty: form.difficulty,
    pitches,
    // v2에서 어프로치 실시간 기록은 제거됐지만, 기존 문서를 읽는 화면이 있어
    // 필드 자체는 빈 배열로 유지한다 (웹과 동일)
    trackingPath: [],
    gpxUrl,
    status: 'pending' as const,
    timestamp: new Date(),
    authorUid: user.uid,
    nickname: user.displayName ?? '',
  };

  const target = collectionOf(form.typeRoot);
  const docRef = await addDoc(collection(db, target), payload);
  clearConceptCache();
  return { reportId: docRef.id, collection: target };
}


/**
 * 기존 개념도 → 편집 폼 (관리자 수정 — 웹 `ConceptEditView.vue` 대응).
 * 이미 올라간 이미지는 `remoteUrl`로 담아 재업로드하지 않는다.
 */
export function conceptToForm(c: Concept): ReportForm {
  const toLocal = (urls: string[] | undefined): LocalImage[] =>
    (urls ?? [])
      .filter((u): u is string => typeof u === 'string' && u.length > 0)
      .map((u) => ({ uid: genUid(), uri: u, remoteUrl: u }));

  const rootUrls =
    Array.isArray(c.imageUrls) && c.imageUrls.length > 0
      ? c.imageUrls
      : c.imageUrl
        ? [c.imageUrl]
        : [];

  return {
    typeRoot: c.type,
    mountain: c.mountain ?? '',
    zone: c.zone ?? '',
    routeName: c.routeName ?? '',
    latitude: c.latitude !== undefined ? String(c.latitude) : '',
    longitude: c.longitude !== undefined ? String(c.longitude) : '',
    images: toLocal(rootUrls),
    overview: c.overview ?? '',
    type: c.climbType ?? '',
    equipment: c.equipment ?? '',
    avgDifficulty: c.avgDifficulty ?? '',
    pioneer: c.pioneer ?? '',
    pitches: (c.pitches ?? []).map((p) => ({
      uid: genUid(),
      name: p.name ?? '',
      length: p.length !== undefined ? String(p.length) : '',
      difficulty: p.difficulty ?? '',
      style: p.style ?? '',
      gear: p.gear ?? '',
      images: toLocal(p.imageUrls),
    })),
    directions: c.directions ?? '',
    no: c.no !== undefined ? String(c.no) : '',
    difficulty: c.difficulty ?? '',
    gpxUri: null,
    gpxName: null,
  };
}

/**
 * 개념도 수정 (관리자). 새로 고른 사진만 업로드하고 기존 URL은 그대로 둔다.
 *
 * ⚠️ `status` / `timestamp` / `authorUid`는 **건드리지 않는다.**
 *    승인 상태나 작성자가 수정으로 바뀌면 안 된다 (웹 ConceptEditView와 동일).
 */
export async function updateReport(
  source: ConceptSource,
  conceptId: string,
  form: ReportForm,
): Promise<void> {
  const mountain = form.mountain.trim();
  const routeName = form.routeName.trim();
  if (!mountain) {
    throw new Error('등반지를 입력하세요.');
  }
  if (!routeName) {
    throw new Error('루트 이름을 입력하세요.');
  }

  const safeM = safe(mountain);
  const safeR = safe(routeName);
  const zoneSeg = form.zone.trim() ? safe(form.zone.trim()) : '미지정';

  const imageUrls = await uploadImages(
    form.images,
    (i) => `route_images/${safeM}/${zoneSeg}/${safeR}/root_${i + 1}.jpg`,
  );

  const pitches = [];
  for (let i = 0; i < form.pitches.length; i += 1) {
    const p = form.pitches[i];
    const urls = await uploadImages(
      p.images,
      (j) => `pitch_images/${safeM}/${safeR}/pitch${i + 1}_${j + 1}.jpg`,
    );
    pitches.push({
      name: p.name,
      length: p.length,
      difficulty: p.difficulty,
      style: p.style,
      gear: p.gear,
      imageUrls: urls,
    });
  }

  let gpxPatch: { gpxUrl: string } | Record<string, never> = {};
  if (form.gpxUri) {
    const gpxUrl = await upload(
      `route_gpx/${safeM}/${safeR}/approach_${Date.now()}.gpx`,
      form.gpxUri,
    );
    gpxPatch = { gpxUrl };
  }

  await updateDoc(doc(db, source, conceptId), {
    typeRoot: form.typeRoot,
    mountain,
    routeName,
    latitude: form.latitude ? parseFloat(form.latitude) : null,
    longitude: form.longitude ? parseFloat(form.longitude) : null,
    imageUrls,
    // 목록·지도가 imageUrl 단일 필드도 보므로 첫 장으로 맞춰준다
    imageUrl: imageUrls[0] ?? '',
    overview: form.overview,
    type: form.type,
    equipment: form.equipment,
    avgDifficulty: form.avgDifficulty,
    pioneer: form.pioneer,
    zone: form.zone,
    directions: form.directions,
    no: form.no,
    difficulty: form.difficulty,
    pitches,
    ...gpxPatch,
  });

  // ⚠️ 목록·지도는 conceptService의 5분 캐시를 본다.
  //    비우지 않으면 **수정한 내용이 최대 5분간 반영되지 않는다**
  //    (2026-08-05: 삭제한 사진이 그대로 보이던 원인).
  clearConceptCache();
}

/** 개념도 삭제 (관리자) — 웹 ConceptListView.deleteRoute와 동일 */
export async function deleteReport(source: ConceptSource, conceptId: string): Promise<void> {
  await deleteDoc(doc(db, source, conceptId));
  clearConceptCache();
}
