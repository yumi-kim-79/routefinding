/**
 * 루트제보 작성 폼 상태 훅 (웹 `views/ReportView.vue`의 script 대응).
 * 화면은 표시에만 집중하고 상태·검증·업로드 호출은 여기에 모은다(CLAUDE.md 갓 파일 분해).
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import Geolocation, {
  type GeolocationResponse,
} from '@react-native-community/geolocation';
import { keepLocalCopy, pick, types } from '@react-native-documents/picker';
import {
  emptyPitch,
  emptyReportForm,
  genUid,
  MAX_PITCH_IMAGES,
  MAX_ROOT_IMAGES,
  type LocalImage,
  type PitchInput,
  type ReportForm,
} from '../../../types/routeReport';
import type { ConceptType } from '../../../types/concept';
import { fetchMountains, fetchZones, submitReport } from '../../../services/reportService';

export interface UseReportFormResult {
  form: ReportForm;
  setField: <K extends keyof ReportForm>(key: K, value: ReportForm[K]) => void;
  selectType: (t: ConceptType) => void;
  setMountain: (m: string) => void;
  mountains: string[];
  zones: string[];
  loadingLists: boolean;
  addImages: () => void;
  removeImage: (uid: string) => void;
  moveImage: (uid: string, dir: -1 | 1) => void;
  addPitch: () => void;
  removePitch: (uid: string) => void;
  updatePitch: (uid: string, patch: Partial<Omit<PitchInput, 'uid' | 'images'>>) => void;
  addPitchImages: (pitchUid: string) => void;
  removePitchImage: (pitchUid: string, imageUid: string) => void;
  movePitchImage: (pitchUid: string, imageUid: string, dir: -1 | 1) => void;
  pickGpx: () => void;
  clearGpx: () => void;
  useCurrentLocation: () => void;
  locating: boolean;
  locError: string | null;
  saving: boolean;
  submit: () => void;
  /** 저장 성공 시각 (화면이 안내를 띄운다) */
  savedAt: number | null;
}

/**
 * 배열 안에서 한 칸 이동.
 * 웹은 vuedraggable로 드래그 정렬하지만, RN에서 같은 걸 하려면
 * reanimated + gesture-handler(네이티브 의존성 2개)가 필요하다.
 * 순서 변경 빈도에 비해 비용이 커서 **좌/우 이동 버튼**으로 대체한다.
 */
function move<T extends { uid: string }>(list: T[], uid: string, dir: -1 | 1): T[] {
  const i = list.findIndex((x) => x.uid === uid);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) {
    return list;
  }
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function useReportForm(): UseReportFormResult {
  const [form, setForm] = useState<ReportForm>(() => emptyReportForm());
  const [mountains, setMountains] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const setField = useCallback(
    <K extends keyof ReportForm>(key: K, value: ReportForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    setLoadingLists(true);
    void fetchMountains(form.typeRoot)
      .then((list) => {
        if (alive) {
          setMountains(list);
        }
      })
      .finally(() => {
        if (alive) {
          setLoadingLists(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [form.typeRoot]);

  useEffect(() => {
    let alive = true;
    void fetchZones(form.typeRoot, form.mountain).then((list) => {
      if (alive) {
        setZones(list);
      }
    });
    return () => {
      alive = false;
    };
  }, [form.typeRoot, form.mountain]);

  /** 타입 전환 시 등반지·구역 초기화 (웹 selectType과 동일) */
  const selectType = useCallback((t: ConceptType) => {
    setForm((prev) =>
      prev.typeRoot === t ? prev : { ...prev, typeRoot: t, mountain: '', zone: '' },
    );
  }, []);

  /** 등반지 변경 시 구역 초기화 */
  const setMountain = useCallback((m: string) => {
    setForm((prev) => ({ ...prev, mountain: m, zone: '' }));
  }, []);

  const pickImages = useCallback(async (limit: number): Promise<LocalImage[]> => {
    const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: limit });
    if (res.didCancel || !res.assets) {
      return [];
    }
    return res.assets
      .filter((a) => !!a.uri)
      .map((a) => ({ uid: genUid(), uri: a.uri as string }));
  }, []);

  const addImages = useCallback(() => {
    void (async () => {
      const room = MAX_ROOT_IMAGES - form.images.length;
      if (room <= 0) {
        Alert.alert(`사진은 최대 ${MAX_ROOT_IMAGES}장까지 첨부할 수 있습니다.`);
        return;
      }
      const picked = await pickImages(room);
      if (picked.length > 0) {
        setForm((prev) => ({
          ...prev,
          images: [...prev.images, ...picked].slice(0, MAX_ROOT_IMAGES),
        }));
      }
    })();
  }, [form.images.length, pickImages]);

  const removeImage = useCallback((uid: string) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((i) => i.uid !== uid) }));
  }, []);

  const moveImage = useCallback((uid: string, dir: -1 | 1) => {
    setForm((prev) => ({ ...prev, images: move(prev.images, uid, dir) }));
  }, []);

  const addPitch = useCallback(() => {
    setForm((prev) => ({ ...prev, pitches: [...prev.pitches, emptyPitch()] }));
  }, []);

  const removePitch = useCallback((uid: string) => {
    setForm((prev) => ({ ...prev, pitches: prev.pitches.filter((p) => p.uid !== uid) }));
  }, []);

  const updatePitch = useCallback(
    (uid: string, patch: Partial<Omit<PitchInput, 'uid' | 'images'>>) => {
      setForm((prev) => ({
        ...prev,
        pitches: prev.pitches.map((p) => (p.uid === uid ? { ...p, ...patch } : p)),
      }));
    },
    [],
  );

  const addPitchImages = useCallback(
    (pitchUid: string) => {
      void (async () => {
        const target = form.pitches.find((p) => p.uid === pitchUid);
        if (!target) {
          return;
        }
        const room = MAX_PITCH_IMAGES - target.images.length;
        if (room <= 0) {
          Alert.alert(`피치 사진은 최대 ${MAX_PITCH_IMAGES}장까지 첨부할 수 있습니다.`);
          return;
        }
        const picked = await pickImages(room);
        if (picked.length === 0) {
          return;
        }
        setForm((prev) => ({
          ...prev,
          pitches: prev.pitches.map((p) =>
            p.uid === pitchUid
              ? { ...p, images: [...p.images, ...picked].slice(0, MAX_PITCH_IMAGES) }
              : p,
          ),
        }));
      })();
    },
    [form.pitches, pickImages],
  );

  const removePitchImage = useCallback((pitchUid: string, imageUid: string) => {
    setForm((prev) => ({
      ...prev,
      pitches: prev.pitches.map((p) =>
        p.uid === pitchUid ? { ...p, images: p.images.filter((i) => i.uid !== imageUid) } : p,
      ),
    }));
  }, []);

  const movePitchImage = useCallback((pitchUid: string, imageUid: string, dir: -1 | 1) => {
    setForm((prev) => ({
      ...prev,
      pitches: prev.pitches.map((p) =>
        p.uid === pitchUid ? { ...p, images: move(p.images, imageUid, dir) } : p,
      ),
    }));
  }, []);

  const pickGpx = useCallback(() => {
    void (async () => {
      try {
        const [file] = await pick({ type: [types.allFiles] });
        if (!file?.name || !file.name.toLowerCase().endsWith('.gpx')) {
          Alert.alert('GPX 파일(.gpx)만 선택할 수 있습니다.');
          return;
        }
        // 안드로이드가 주는 content:// URI는 Storage 업로드에서 실패할 수 있어
        // 앱 캐시로 복사해 file:// 경로를 확보한다.
        const [copy] = await keepLocalCopy({
          files: [{ uri: file.uri, fileName: file.name }],
          destination: 'cachesDirectory',
        });
        if (copy.status !== 'success') {
          Alert.alert('GPX 파일을 읽지 못했습니다.');
          return;
        }
        setForm((prev) => ({ ...prev, gpxUri: copy.localUri, gpxName: file.name }));
      } catch {
        // 사용자가 선택을 취소한 경우 포함 — 조용히 무시
      }
    })();
  }, []);

  const clearGpx = useCallback(() => {
    setForm((prev) => ({ ...prev, gpxUri: null, gpxName: null }));
  }, []);

  const useCurrentLocation = useCallback(() => {
    void (async () => {
      setLocError(null);
      if (Platform.OS === 'android') {
        // 안드로이드는 런타임 권한이 필요하다 (iOS는 Info.plist 문구로 시스템이 처리)
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setLocError('위치 권한이 거부되었습니다. [지도에서 선택]을 이용해 주세요.');
          return;
        }
      }
      setLocating(true);
      Geolocation.getCurrentPosition(
        (pos: GeolocationResponse) => {
          setLocating(false);
          setForm((prev) => ({
            ...prev,
            latitude: String(pos.coords.latitude),
            longitude: String(pos.coords.longitude),
          }));
        },
        () => {
          setLocating(false);
          setLocError('현재 위치를 가져오지 못했습니다. [지도에서 선택]을 이용해 주세요.');
        },
        // 자연암벽은 GPS가 약하다 — 정확도 우선 + 넉넉한 타임아웃 (웹과 동일 값)
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    })();
  }, []);

  const submit = useCallback(() => {
    if (saving) {
      return;
    }
    void (async () => {
      setSaving(true);
      try {
        await submitReport(form);
        setForm(emptyReportForm(form.typeRoot));
        setSavedAt(Date.now());
      } catch (e) {
        Alert.alert('저장 실패', e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    })();
  }, [form, saving]);

  return {
    form,
    setField,
    selectType,
    setMountain,
    mountains,
    zones,
    loadingLists,
    addImages,
    removeImage,
    moveImage,
    addPitch,
    removePitch,
    updatePitch,
    addPitchImages,
    removePitchImage,
    movePitchImage,
    pickGpx,
    clearGpx,
    useCurrentLocation,
    locating,
    locError,
    saving,
    submit,
    savedAt,
  };
}
