/** 마이프로필 (v1 mypage_screen.dart my_profile_tab.dart: 사진(image_picker [TBD])·intro·등급. TODO: image-picker 도입 시 구현). Phase 2-1 후속 구현 예정. */
import React from 'react';
import { View } from 'react-native';
import { Text } from '../../../components/common/Text';

export const MyProfileTab: React.FC = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <Text variant="title">마이프로필</Text>
    <Text variant="caption" color="textSecondary" style={{ marginTop: 8 }}>
      my_profile_tab.dart: 사진(image_picker [TBD])·intro·등급. TODO: image-picker 도입 시 구현
    </Text>
  </View>
);
