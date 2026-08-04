/**
 * 공용 아이콘 — 인라인 SVG (웹 `components/common/AppIcon.vue` 1:1 이식).
 *
 * 이모지를 쓰지 않는 이유 (웹과 동일):
 *   · 기기·OS마다 모양과 색이 제각각이다 (iOS/안드로이드가 전혀 다르게 그린다)
 *   · 색을 바꿀 수 없어 선택/비활성 상태를 표현하지 못한다
 *   · 글꼴 기준선에 걸려 세로 정렬이 어긋난다
 *
 * 스타일 규칙 (웹과 동일): 24x24 viewBox · stroke 방식 · 굵기 1.8 · 둥근 끝/이음.
 *
 * ⚠️ path 데이터는 **웹과 같은 값을 유지할 것.** 한쪽만 고치면 두 화면이 갈라진다.
 *    웹: routefinding-web/src/components/common/AppIcon.vue
 *
 * 웹은 `currentColor`로 부모 색을 따라가지만 RN에는 그런 개념이 없어 `color` prop을 받는다.
 * 미지정 시 테마의 textPrimary (색상 하드코딩 금지 — CLAUDE.md).
 */
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';

/** 원을 path로: cx,cy,r → 두 개의 반원 호 */
const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;

/** 점(둥근 캡으로 찍히는 아주 짧은 선) */
const dot = (x: number, y: number): string => `M${x} ${y}h.01`;

export const ICONS = {
  // ── 하단 탭 (웹 BottomNavBar.vue와 동일) ──
  /** 개념도: 두 개의 봉우리 (토포=바위/산) */
  concept: ['M2.5 19.5h19', 'M4.5 19.5 10 8.5l3.2 6.4', 'M12.4 19.5 16.5 11.8l3.4 7.7'],
  /** 지도: 접힌 지도 */
  map: ['M9 4.5 3.5 7v12.5L9 17l6 2.5 5.5-2.5V4.5L15 7z', 'M9 4.5V17', 'M15 7v12.5'],
  /** 루트제보: 문서 + 더하기 */
  report: [
    'M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z',
    'M14 3v5h5',
    'M12 12.5v5',
    'M9.5 15h5',
  ],
  /** 마이페이지: 사람 */
  user: [circle(12, 8.5, 3.6), 'M4.8 20c0-3.6 3.2-5.6 7.2-5.6s7.2 2 7.2 5.6'],

  // ── 공용 (웹 AppIcon.vue와 동일) ──
  /** 즐겨찾기 */
  star: ['M12 3.6l2.5 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.2 2.8 1.1-5.9L3.6 9.8l5.9-.8z'],
  /** 등반일지 쓰기 (연필) */
  pencil: ['M18.4 2.6a2.1 2.1 0 0 1 3 3L7.2 19.8 3 21l1.2-4.2z', 'M15 5.5l3.5 3.5'],
  /** 사진 촬영 */
  camera: [
    'M3 8.6A2.1 2.1 0 0 1 5.1 6.5h2.1l1.3-2.1h7l1.3 2.1h2.1A2.1 2.1 0 0 1 21 8.6v8.8a2.1 2.1 0 0 1-2.1 2.1H5.1A2.1 2.1 0 0 1 3 17.4z',
    circle(12, 13, 3.3),
  ],
  /** 사진 첨부 (갤러리) */
  image: ['M3.5 5.5h17v13h-17z', circle(8.6, 10, 1.5), 'm3.5 16.2 4.6-4.6 3.9 3.9 3.1-3.1 5.4 5.4'],
  /** 선 그리기 (자유 곡선) */
  line: ['M3 17.5c3.2-6.4 6.4 1.6 9.6-4.8s5.4 1.6 8.4-3.2'],
  /** 글자 넣기 */
  type: ['M5.5 7V5h13v2', 'M12 5v14', 'M9 19h6'],
  /** 되돌리기 */
  undo: ['M4 10.5h10.5a4.8 4.8 0 1 1 0 9.6H10', 'm8 6.5-4 4 4 4'],
  /** 전체 지우기 / 삭제 */
  trash: ['M4 6.5h16', 'M9.5 6.5v-2h5v2', 'M6.6 6.5l1 13h8.8l1-13'],
  /** 현재 위치 */
  locate: [circle(12, 12, 3.2), circle(12, 12, 7.6), 'M12 2v2.5', 'M12 19.5V22', 'M2 12h2.5', 'M19.5 12H22'],
  /** 소요시간 */
  clock: [circle(12, 12, 8.6), 'M12 7.2V12l3.2 1.9'],
  /** 장비 */
  backpack: [
    'M6 10a6 6 0 0 1 12 0v8.5a1.8 1.8 0 0 1-1.8 1.8H7.8A1.8 1.8 0 0 1 6 18.5z',
    'M9.4 10V6.2a2.6 2.6 0 0 1 5.2 0V10',
    'M9 14.4h6',
  ],
  /** 참석자 */
  users: [
    circle(9.2, 8.6, 3.4),
    'M2.6 20c0-3.3 2.9-5.2 6.6-5.2s6.6 1.9 6.6 5.2',
    'M16.4 5.6a3.4 3.4 0 0 1 0 6',
    'M17.6 15.2c2.4.6 3.8 2.2 3.8 4.4',
  ],
  /** 닫기 */
  x: ['M6 6l12 12', 'M18 6 6 18'],
  /** 검색 */
  search: [circle(10.6, 10.6, 6.6), 'm15.4 15.4 5 5'],
  /** 뒤로 */
  back: ['m14.5 5-7 7 7 7'],
  /** 드래그 손잡이 */
  grip: [dot(9, 6.5), dot(9, 12), dot(9, 17.5), dot(15, 6.5), dot(15, 12), dot(15, 17.5)],
  /** 추가 */
  plus: ['M12 5v14', 'M5 12h14'],
  /** 승인 */
  check: ['m4.5 12.5 5 5 10-11'],
  /** 클립보드 (GPX 붙여넣기) */
  clipboard: [
    'M9 4.5H7A1.8 1.8 0 0 0 5.2 6.3v13A1.8 1.8 0 0 0 7 21.1h10a1.8 1.8 0 0 0 1.8-1.8v-13A1.8 1.8 0 0 0 17 4.5h-2',
    'M9 3.4h6v3H9z',
  ],
  /** 파일 열기 (업로드) */
  upload: ['M21 15.5v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3', 'm7.5 8.5 4.5-4.5 4.5 4.5', 'M12 4v12'],
  /** 다운로드 */
  download: ['M21 15.5v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3', 'm7.5 11 4.5 4.5 4.5-4.5', 'M12 15.5v-12'],
  /** 복사 */
  copy: [
    'M9.5 9.5h9a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 8 20v-9a1.5 1.5 0 0 1 1.5-1.5z',
    'M5.5 15.5A1.5 1.5 0 0 1 4 14V5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 16 5v.5',
  ],
  /** 공유 */
  share: [
    circle(18, 5.5, 2.6),
    circle(6, 12, 2.6),
    circle(18, 18.5, 2.6),
    'm8.3 10.7 7.4-3.9',
    'm8.3 13.3 7.4 3.9',
  ],
} as const;

export type AppIconName = keyof typeof ICONS;

interface AppIconProps {
  name: AppIconName;
  size?: number;
  strokeWidth?: number;
  /** 별(즐겨찾기)처럼 채워야 하는 아이콘 */
  filled?: boolean;
  /** 미지정 시 테마 textPrimary */
  color?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = 20,
  strokeWidth = 1.8,
  filled = false,
  color,
}) => {
  const { colors } = useTheme();
  const tint = color ?? colors.textPrimary;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? tint : 'none'}
      stroke={tint}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name].map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
};
