/** 내 제보 관리 (v1 mypage_screen.dart _buildMyReportsTab: route_reports + bouldering_reports (authorUid==me), 삭제·반려). Phase 2-1 후속 구현 예정. */
import React from 'react';
import { View } from 'react-native';
import { Text } from '../../../components/common/Text';

export const MyReportsTab: React.FC = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <Text variant="title">내 제보 관리</Text>
    <Text variant="caption" color="textSecondary" style={{ marginTop: 8 }}>
      _buildMyReportsTab: route_reports + bouldering_reports (authorUid==me), 삭제·반려
    </Text>
  </View>
);
