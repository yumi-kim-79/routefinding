/**
 * 지도 마커 1개 (핀 + 클러스터 숫자).
 *
 * ⚠️ 안드로이드 전용 함정 — 마커가 안 보이고 숫자만 나오던 원인 (2026-08-04 실측)
 *   안드로이드는 마커 자식 View를 **비트맵으로 한 번 떠서** 지도에 얹는다.
 *   그 스냅샷이 이미지 디코딩보다 먼저 찍히면 **핀은 비고 텍스트만 남는다.**
 *   (iOS는 뷰를 그대로 올리므로 같은 코드에서도 정상으로 보였다)
 *
 *   두 겹으로 막는다:
 *     1) `Image`의 `fadeDuration={0}` — 안드로이드 기본 페이드인(300ms) 동안
 *        스냅샷이 찍히면 투명한 이미지가 박힌다
 *     2) 마커마다 `tracksViewChanges`를 **자기 이미지가 로드될 때까지만** true로 둔다
 *        (전역 타이머로 일괄 처리하면 느린 마커가 스냅샷 타이밍을 놓친다)
 */
import React, { useEffect, useState } from 'react';
import { Marker } from 'react-native-maps';
import { MARKER_GEOMETRY } from '../../../constants/map';
import type { ConceptType } from '../../../types/concept';
import { RouteMarkerView } from './RouteMarkerView';
import type { RouteCluster } from '../hooks/useMapRoutes';

interface RouteMarkerProps {
  cluster: RouteCluster;
  type: ConceptType;
  onPress: (cluster: RouteCluster) => void;
}

export const RouteMarker: React.FC<RouteMarkerProps> = ({ cluster, type, onPress }) => {
  const geo = MARKER_GEOMETRY[type];
  const [ready, setReady] = useState(false);

  // 아이콘이 바뀌면 새 이미지를 다시 스냅샷해야 한다
  useEffect(() => {
    setReady(false);
  }, [type]);

  return (
    <Marker
      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      // 핀 끝이 실제 좌표에 오도록 실측 비율 사용 (constants/map.ts 주석 참조)
      anchor={{ x: 0.5, y: geo.tipRatio }}
      tracksViewChanges={!ready}
      onPress={() => onPress(cluster)}
    >
      <RouteMarkerView
        type={type}
        count={cluster.routes.length}
        onImageLoad={() => {
          // 로드 직후가 아니라 **다음 프레임**에 꺼야 그려진 결과가 스냅샷에 들어간다
          requestAnimationFrame(() => setReady(true));
        }}
      />
    </Marker>
  );
};
