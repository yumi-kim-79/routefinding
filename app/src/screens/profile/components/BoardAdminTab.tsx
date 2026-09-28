/**
 * 게시판 관리 탭 (관리자 전용) — 마이페이지 ▸ 게시판 관리. v2.1.0 신규 (2026-09-07).
 *
 * 사용자 요구사항: "내가 나중에 게시판을 추가할수있게 해줘".
 * 여기서 만든 게시판은 **앱을 새로 배포하지 않아도** 모든 사용자의 커뮤니티 탭에 바로 나타난다
 * (CommunityScreen 이 boards 를 실시간 구독한다).
 *
 * ⚠️ `type` 과 `id` 는 만든 뒤 못 바꾼다. 이미 쓴 글이 `boardId` 를 들고 있고,
 *    type 이 바뀌면 그 게시판의 기존 글에서 필수 필드가 어긋난다 (types/board.ts).
 * ⚠️ 지우기보다 **숨김(visible=false)** 을 쓴다. 삭제하면 그 게시판의 글이 갈 곳을 잃는다.
 *
 * ⚠️ **게시판을 만드는 정식 경로는 이 화면이다.** `tools/seed_boards.js` 는 처음 한 번을 위한
 *    보조 수단일 뿐이고, 서비스 계정 키가 필요해 손이 더 간다 (2026-09-08 실측:
 *    키를 지운 뒤 `PERMISSION_DENIED`). 새 게시판은 여기서 만든다.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { KeyboardAwareScroll } from '../../../components/common/KeyboardAwareScroll';
import { useTheme } from '../../../theme';
import {
  createBoard,
  fetchAllBoards,
  updateBoard,
} from '../../../services/boardService';
import { LOG_BOARD_ID, type Board, type BoardInput } from '../../../types/board';

const TYPES: { value: BoardInput['type']; label: string; hint: string }[] = [
  { value: 'free', label: '자유', hint: '사진 + 글' },
  { value: 'place', label: '등반지', hint: '등반지 입력 필수' },
  { value: 'market', label: '중고거래', hint: '가격·지역·거래상태' },
  // ⚠️ 2026-09-08 추가. 이게 빠져 있어서 파티 모집 게시판을 앱에서 만들 수 없었다
  { value: 'party', label: '파티 모집', hint: '등반 날짜 필수 · 인원 · 모집중/마감' },
];

export const BoardAdminTab: React.FC = () => {
  const { colors, radius } = useTheme();

  const [list, setList] = useState<Board[] | null>(null);
  const [busy, setBusy] = useState(false);

  // 새 게시판 입력
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('');
  const [type, setType] = useState<BoardInput['type']>('free');

  const reload = useCallback(async () => {
    try {
      setList(await fetchAllBoards());
    } catch (e) {
      Alert.alert('불러오기 실패', e instanceof Error ? e.message : String(e));
      setList([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = useCallback(async () => {
    if (!name.trim() || !id.trim()) {
      Alert.alert('ID 와 이름을 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      // 맨 뒤에 붙인다 — 기존 순서를 건드리지 않는다
      const order = (list ?? []).reduce((m, b) => Math.max(m, b.order), 0) + 10;
      await createBoard({
        id: id.trim(),
        name: name.trim(),
        description: desc.trim(),
        icon: icon.trim(),
        type,
        order,
      });
      setId('');
      setName('');
      setDesc('');
      setIcon('');
      await reload();
      Alert.alert('추가 완료', '커뮤니티 탭에 바로 나타납니다.');
    } catch (e) {
      Alert.alert('추가 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [id, name, desc, icon, type, list, reload]);

  const patch = useCallback(
    async (b: Board, changes: Parameters<typeof updateBoard>[1]) => {
      try {
        await updateBoard(b.id, changes);
        await reload();
      } catch (e) {
        Alert.alert('수정 실패', e instanceof Error ? e.message : String(e));
      }
    },
    [reload],
  );

  const move = useCallback(
    (b: Board, dir: -1 | 1) => {
      if (!list) {
        return;
      }
      const i = list.findIndex((x) => x.id === b.id);
      const j = i + dir;
      if (j < 0 || j >= list.length) {
        return;
      }
      // 두 게시판의 order 를 맞바꾼다
      void patch(b, { order: list[j].order });
      void patch(list[j], { order: b.order });
    },
    [list, patch],
  );

  if (!list) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAwareScroll contentContainerStyle={styles.pad}>
      {list.map((b, i) => (
        <View key={b.id} style={[styles.card, { borderColor: colors.border, borderRadius: radius.md }]}>
          <View style={styles.rowTop}>
            <Text variant="label" style={styles.grow}>
              {b.icon ? `${b.icon} ` : ''}
              {b.name}
            </Text>
            <Text variant="caption" color="disabled">
              {b.id} · {b.type}
            </Text>
          </View>
          {b.description ? (
            <Text variant="caption" color="textSecondary">
              {b.description}
            </Text>
          ) : null}

          <View style={styles.btnRow}>
            <Pressable onPress={() => move(b, -1)} disabled={i === 0} hitSlop={6}>
              <Text variant="label" color={i === 0 ? 'disabled' : 'primary'}>
                ↑
              </Text>
            </Pressable>
            <Pressable onPress={() => move(b, 1)} disabled={i === list.length - 1} hitSlop={6}>
              <Text variant="label" color={i === list.length - 1 ? 'disabled' : 'primary'}>
                ↓
              </Text>
            </Pressable>
            <Pressable onPress={() => void patch(b, { visible: !b.visible })} hitSlop={6}>
              <Text variant="label" color={b.visible ? 'textSecondary' : 'error'}>
                {b.visible ? '숨기기' : '숨김 해제'}
              </Text>
            </Pressable>
            {/* ⚠️ 등반일지 게시판은 어떤 경로로도 글쓰기가 열리면 안 된다 */}
            {b.id !== LOG_BOARD_ID ? (
              <Pressable onPress={() => void patch(b, { writable: !b.writable })} hitSlop={6}>
                <Text variant="label" color="textSecondary">
                  {b.writable ? '글쓰기 잠금' : '글쓰기 열기'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}

      <View style={[styles.card, { borderColor: colors.primary, borderRadius: radius.md }]}>
        <Text variant="title">게시판 추가</Text>
        <Text variant="caption" color="textSecondary">
          추가하면 앱을 새로 배포하지 않아도 바로 나타납니다.
        </Text>

        <Input
          label="ID (영문 소문자, 예: gear-review)"
          value={id}
          onChangeText={setId}
          autoCapitalize="none"
        />
        <Input label="이름" value={name} onChangeText={setName} />
        <Input label="설명 (선택)" value={desc} onChangeText={setDesc} />
        <Input label="아이콘 이모지 (선택)" value={icon} onChangeText={setIcon} maxLength={2} />

        <Text variant="label" color="textSecondary">
          종류 — ⚠️ 만든 뒤에는 바꿀 수 없습니다
        </Text>
        <View style={styles.typeRow}>
          {TYPES.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => setType(t.value)}
              style={[
                styles.chip,
                {
                  borderRadius: radius.full,
                  borderColor: type === t.value ? colors.primary : colors.border,
                },
              ]}
            >
              <Text variant="caption" color={type === t.value ? 'primary' : 'textSecondary'}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text variant="caption" color="disabled">
          {TYPES.find((t) => t.value === type)?.hint}
        </Text>

        <Button title="게시판 만들기" onPress={() => void add()} disabled={busy} />
      </View>
    </KeyboardAwareScroll>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  pad: { padding: 16, rowGap: 12, paddingBottom: 40 },
  card: { borderWidth: 1, padding: 12, rowGap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  grow: { flex: 1 },
  btnRow: { flexDirection: 'row', columnGap: 16, marginTop: 4, alignItems: 'center' },
  typeRow: { flexDirection: 'row', columnGap: 8 },
  chip: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
});
