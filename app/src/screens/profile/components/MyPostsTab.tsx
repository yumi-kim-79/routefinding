/** 내글 (v1 mypage_screen.dart _buildMyPostsTab: posts where userId==me). Phase 2-1 후속 구현 예정. */
import React from 'react';
import { View } from 'react-native';
import { Text } from '../../../components/common/Text';

export const MyPostsTab: React.FC = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <Text variant="title">내글</Text>
    <Text variant="caption" color="textSecondary" style={{ marginTop: 8 }}>
      _buildMyPostsTab: posts where userId==me
    </Text>
  </View>
);
