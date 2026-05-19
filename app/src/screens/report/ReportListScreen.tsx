/**
 * 지도 탭 (v1 /reports = RouteReportListScreen).
 * ⚠️ v1 라벨↔화면 비직관 보존: 탭 라벨은 "지도"지만 실제는 리포트 목록.
 * Phase 2-5에서 구현.
 */
import React from 'react';
import { PlaceholderScreen } from '../../components/common/PlaceholderScreen';

export const ReportListScreen: React.FC = () => (
  <PlaceholderScreen
    title="지도(리포트 목록)"
    note="v1 탭2 /reports (route_report_list_screen.dart)"
  />
);
