/** MY ROUTE (v1 mypage_screen.dart _buildMyRouteTab: users/{uid}/my_routes). Phase 2-1 후속 구현 예정. */
import React from 'react';
import { View } from 'react-native';
import { Text } from '../../../components/common/Text';

export const MyRouteTab: React.FC = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <Text variant="title">MY ROUTE</Text>
    <Text variant="caption" color="textSecondary" style={{ marginTop: 8 }}>
      {'_buildMyRouteTab: users/{uid}/my_routes'}
    </Text>
  </View>
);
