/**
 * 업데이트 안내 화면 — **밀어서 스토어로 이동**.
 *
 * 왜 버튼이 아니라 슬라이드인가:
 *   강제 업데이트는 앱을 못 쓰게 막는 화면이다. 버튼은 잘못 눌러도 지나가지만
 *   밀기는 **의도가 있어야만** 동작한다. 산에서 장갑 낀 손으로 오작동하는 것도 줄어든다.
 *
 * 두 단계:
 *   - `required` — 최소 지원 버전 미만. **닫을 수 없다.** 업데이트해야 앱을 쓴다.
 *   - `optional` — 새 버전은 있지만 쓸 수는 있다. '나중에' 로 넘어간다.
 *
 * 제스처는 RN 내장 `PanResponder` 로 만든다 (gesture-handler/reanimated 미사용 —
 * 이 프로젝트의 다른 제스처와 같은 방침. ConceptPhotoEditor 주석 참조).
 */
import React, { useRef, useState } from 'react';
import {
  Animated,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Text } from './Text';
import { AppIcon } from './AppIcon';
import { useTheme } from '../../theme';
import { APP_VERSION, webStoreUrl } from '../../constants/version';
import type { UpdateInfo } from '../../services/updateService';

interface UpdateGateProps {
  info: UpdateInfo;
  /** optional 단계에서 '나중에' 를 눌렀을 때 */
  onDismiss: () => void;
}

const KNOB = 56;
const TRACK_PADDING = 4;

export const UpdateGate: React.FC<UpdateGateProps> = ({ info, onDismiss }) => {
  const { colors, radius, spacing } = useTheme();
  const { width } = useWindowDimensions();

  const trackWidth = Math.min(width - 48, 420);
  const maxSlide = trackWidth - KNOB - TRACK_PADDING * 2;

  const x = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);

  const openStore = () => {
    setDone(true);
    void (async () => {
      try {
        // market:// 나 itms-apps:// 는 스토어 앱을 바로 연다.
        await Linking.openURL(info.storeUrl);
      } catch {
        // 스토어 앱이 없거나(에뮬레이터) 주소가 비어 있으면 웹으로 되돌린다
        const web = webStoreUrl();
        if (web) {
          await Linking.openURL(web).catch(() => undefined);
        }
      }
    })();
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2,
      onPanResponderMove: (_, g) => {
        const next = Math.max(0, Math.min(maxSlide, g.dx));
        x.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        // 80% 이상 밀면 끝까지 붙이고 스토어로 (손가락을 끝까지 못 미는 경우가 많다)
        if (g.dx >= maxSlide * 0.8) {
          Animated.timing(x, {
            toValue: maxSlide,
            duration: 120,
            useNativeDriver: true,
          }).start(openStore);
        } else {
          Animated.spring(x, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background, padding: spacing.lg }]}>
      <View style={styles.body}>
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.surfaceVariant, borderRadius: radius.full },
          ]}
        >
          <AppIcon name="download" size={34} color={colors.primary} />
        </View>

        <Text variant="headline" style={styles.title}>
          {info.level === 'required' ? '업데이트가 필요합니다' : '새 버전이 있습니다'}
        </Text>

        <Text variant="body" color="textSecondary" style={styles.message}>
          {info.message}
        </Text>

        <Text variant="caption" color="textSecondary" style={styles.versions}>
          현재 {APP_VERSION}
          {info.latestVersion && info.latestVersion !== APP_VERSION
            ? `  →  최신 ${info.latestVersion}`
            : ''}
        </Text>
      </View>

      {/* 밀어서 스토어로 */}
      <View
        style={[
          styles.track,
          {
            width: trackWidth,
            backgroundColor: colors.surfaceVariant,
            borderRadius: (KNOB + TRACK_PADDING * 2) / 2,
            padding: TRACK_PADDING,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: colors.primary,
              borderRadius: (KNOB + TRACK_PADDING * 2) / 2,
              opacity: x.interpolate({
                inputRange: [0, maxSlide],
                outputRange: [0.12, 0.35],
              }),
              width: x.interpolate({
                inputRange: [0, maxSlide],
                outputRange: [KNOB + TRACK_PADDING * 2, trackWidth],
              }),
            },
          ]}
        />

        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.knob,
            {
              backgroundColor: colors.primary,
              borderRadius: KNOB / 2,
              transform: [{ translateX: x }],
            },
          ]}
        >
          {/* '뒤로' 아이콘을 뒤집어 오른쪽 화살표로 쓴다 (아이콘 세트를 늘리지 않는다) */}
          <View style={styles.knobIcon}>
            <AppIcon name="back" size={22} color={colors.onPrimary} />
          </View>
        </Animated.View>

        <View style={styles.hintWrap} pointerEvents="none">
          <Text variant="label" color="textSecondary">
            {done ? '스토어로 이동합니다…' : '밀어서 업데이트'}
          </Text>
        </View>
      </View>

      {info.level === 'optional' ? (
        <Pressable accessibilityRole="button" onPress={onDismiss} hitSlop={10} style={styles.later}>
          <Text variant="label" color="textSecondary">
            나중에
          </Text>
        </Pressable>
      ) : (
        <Text variant="caption" color="textSecondary" style={styles.later}>
          이 버전은 더 이상 사용할 수 없습니다
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { alignItems: 'center', marginBottom: 40 },
  badge: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 20, textAlign: 'center' },
  message: { marginTop: 10, textAlign: 'center', lineHeight: 22 },
  versions: { marginTop: 14 },
  track: { height: KNOB + TRACK_PADDING * 2, justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  knob: { width: KNOB, height: KNOB, alignItems: 'center', justifyContent: 'center' },
  knobIcon: { transform: [{ scaleX: -1 }] },
  hintWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: -1 },
  later: { marginTop: 24 },
});
