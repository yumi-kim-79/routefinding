/**
 * 스택으로 여는 루트제보 작성 (개념도 → "이 구역에 루트 제보").
 *
 * 왜 별도 파일인가:
 *   `ReportWriteScreen`은 **탭**의 화면이라 네비 파라미터를 받지 않는다(props로만 받는다).
 *   같은 화면을 스택에서도 열려면 파라미터를 props로 바꿔주는 얇은 껍데기가 필요하다.
 *   화면 본체를 건드리지 않으므로 탭 동작은 그대로다.
 *
 * 배경 (2026-08-05 요청):
 *   같은 등반지·구역의 개념도를 보다가 루트를 추가하려면 홈으로 나가 루트제보 탭을 열고
 *   등반지·구역·좌표를 처음부터 다시 골라야 했다. 보고 있던 화면에서 바로 열면
 *   그 값들이 이미 채워져 있다.
 */
import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ReportWriteScreen } from './ReportWriteScreen';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'ReportWrite'>;
type Rt = RouteProp<MainStackParamList, 'ReportWrite'>;

export const ReportWriteRoute: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();

  return (
    <ReportWriteScreen
      prefill={params?.prefill}
      onSaved={() => navigation.goBack()}
    />
  );
};
