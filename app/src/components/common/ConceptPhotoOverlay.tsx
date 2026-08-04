/**
 * 개념도 사진 위의 라인·텍스트 오버레이 (읽기 전용) — 웹 `ConceptPhotoOverlay.vue` 이식.
 *
 * 좌표는 0~1 정규화라 컨테이너 크기만 알면 어디서든 정확히 겹친다.
 * 선 굵기·글자 크기도 컨테이너에 비례시켜 확대/축소해도 비율이 유지된다.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import {
  FONT_RATIO,
  STROKE_RATIO,
  TEXT_STROKE_RATIO,
  toPath,
  type PhotoLine,
  type PhotoText,
} from '../../types/conceptPhoto';

interface ConceptPhotoOverlayProps {
  lines: PhotoLine[];
  texts: PhotoText[];
  /** 컨테이너 실제 픽셀 크기 */
  width: number;
  height: number;
}

export const ConceptPhotoOverlay: React.FC<ConceptPhotoOverlayProps> = ({
  lines,
  texts,
  width,
  height,
}) => {
  if (width <= 0 || height <= 0) {
    return null;
  }
  const strokeW = Math.max(1, width * STROKE_RATIO);
  const fontSize = Math.max(8, height * FONT_RATIO);

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      pointerEvents="none"
    >
      {lines.map((ln, i) => (
        <Path
          key={`l${i}`}
          d={toPath(ln.points, width, height)}
          fill="none"
          stroke={ln.color || '#ff2d2d'}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {/*
        ⚠️ 웹은 `paint-order="stroke"`로 외곽선을 먼저 깔고 색을 덮는데,
           react-native-svg는 paint-order를 지원하지 않아 **검정 외곽선이 글자색을 덮어버린다**
           (선택한 색과 무관하게 전부 검게 보이던 원인, 2026-08-04 실측).
           → 같은 글자를 두 번 그린다: ① 외곽선만 ② 그 위에 색만.
      */}
      {texts.map((tx, i) => (
        <SvgText
          key={`ts${i}`}
          x={tx.x * width}
          y={tx.y * height}
          fontSize={fontSize}
          fontWeight="bold"
          textAnchor="middle"
          fill="none"
          stroke="#000"
          strokeWidth={fontSize * TEXT_STROKE_RATIO}
          strokeLinejoin="round"
        >
          {tx.text}
        </SvgText>
      ))}
      {texts.map((tx, i) => (
        <SvgText
          key={`tf${i}`}
          x={tx.x * width}
          y={tx.y * height}
          fontSize={fontSize}
          fontWeight="bold"
          textAnchor="middle"
          fill={tx.color || '#ffe14d'}
        >
          {tx.text}
        </SvgText>
      ))}
    </Svg>
  );
};
