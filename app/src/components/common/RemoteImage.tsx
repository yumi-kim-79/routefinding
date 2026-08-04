/**
 * 원격 이미지 — GCS 원본 주소를 다운로드 URL로 바꿔서 띄운다.
 *
 * 개념도 사진 URL이 `storage.googleapis.com` 형식으로 저장돼 있어 그냥 쓰면 403이다
 * (`services/imageUrlService.ts` 주석 참조). 화면마다 따로 처리하지 않도록 여기서 흡수한다.
 * 변환이 필요 없는 URL이면 추가 요청 없이 그대로 그린다.
 */
import React, { useEffect, useState } from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../../theme';
import { isRawGcsUrl, resolveImageUrl } from '../../services/imageUrlService';

interface RemoteImageProps {
  uri: string | undefined | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  /** 이미지가 없거나 변환에 실패했을 때 보여줄 문구 */
  emptyLabel?: string;
}

export const RemoteImage: React.FC<RemoteImageProps> = ({
  uri,
  style,
  resizeMode = 'cover',
  emptyLabel = '이미지 없음',
}) => {
  const { colors } = useTheme();
  // 변환이 필요 없는 주소면 첫 렌더부터 바로 그린다 (깜빡임 방지)
  const [resolved, setResolved] = useState<string | null>(
    uri && !isRawGcsUrl(uri) ? uri : null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (!uri) {
      setResolved(null);
      return;
    }
    if (!isRawGcsUrl(uri)) {
      setResolved(uri);
      return;
    }
    setResolved(null);
    void resolveImageUrl(uri).then((url) => {
      if (alive) {
        setResolved(url || null);
      }
    });
    return () => {
      alive = false;
    };
  }, [uri]);

  if (!resolved || failed) {
    return (
      <View
        style={[
          style,
          { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceVariant },
        ]}
      >
        <Text variant="caption" color="disabled">
          {emptyLabel}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: resolved }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setFailed(true)}
    />
  );
};
