/**
 * 지도 마커 내용물 (핀 이미지 + 클러스터 숫자).
 *
 * 웹은 마커를 두 개 겹쳤다 — 핀 이미지 마커 + canvas로 구운 숫자 이미지 마커.
 * RN은 마커 안에 View를 넣을 수 있어 **하나의 마커**로 끝난다.
 * 숫자는 핀 '구멍 중심'(holeRatio)에 올려 핀 끝(실제 좌표)을 가리지 않게 한다.
 *
 * ⚠️ `tracksViewChanges`는 호출부(MapScreen)에서 첫 렌더 후 false로 내린다.
 *    true로 두면 마커마다 매 프레임 스냅샷을 떠서 지도가 버벅인다.
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import {
  CLUSTER_PIN_H,
  CLUSTER_PIN_W,
  MARKER_GEOMETRY,
  SINGLE_PIN,
} from '../../../constants/map';
import type { ConceptType } from '../../../types/concept';

interface RouteMarkerViewProps {
  type: ConceptType;
  /** 1이면 단일 마커, 2 이상이면 클러스터(숫자 표시) */
  count: number;
}

export const RouteMarkerView: React.FC<RouteMarkerViewProps> = ({ type, count }) => {
  const geo = MARKER_GEOMETRY[type];
  const isCluster = count > 1;
  const w = isCluster ? CLUSTER_PIN_W : SINGLE_PIN;
  const h = isCluster ? CLUSTER_PIN_H : SINGLE_PIN;

  return (
    <View style={{ width: w, height: h }}>
      <Image
        source={geo.source}
        style={{ width: w, height: h }}
        // 웹도 52x60으로 늘려 쓰므로(원본 200x200) 같은 비율을 유지하려면 stretch
        resizeMode={isCluster ? 'stretch' : 'contain'}
      />
      {isCluster ? (
        <View
          style={[
            styles.labelWrap,
            // 숫자 중심을 구멍 중심에 맞춘다 (라벨 높이의 절반만큼 위로)
            { top: h * geo.holeRatio - LABEL_HEIGHT / 2 },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.label}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
};

const LABEL_HEIGHT = 22;

const styles = StyleSheet.create({
  labelWrap: { position: 'absolute', left: 0, right: 0, height: LABEL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  // 흰 숫자 + 검은 외곽선 (웹 canvas strokeText 대응)
  label: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: LABEL_HEIGHT,
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
});
