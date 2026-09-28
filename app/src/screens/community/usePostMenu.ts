/**
 * 글·댓글의 ⋯ 메뉴 — 삭제 / 신고 / 차단.
 *
 * ⚠️ 목록(CommunityScreen)과 상세(PostDetailScreen)가 **같은 메뉴**를 써야 한다.
 *    한쪽에만 신고가 있으면 심사에서 "신고 수단이 일관되지 않다"고 걸린다.
 *    그래서 화면마다 따로 만들지 않고 이 훅 하나로 모았다.
 *
 * ⚠️ `Alert` 를 쓴다. ActionSheet 라이브러리를 새로 넣지 않은 이유는
 *    안드로이드에 기본 ActionSheet 가 없어서 결국 두 벌을 만들어야 하기 때문이다.
 *    Alert 는 양쪽에서 동일하게 뜨고 접근성도 이미 처리돼 있다.
 */
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { isAdminEmail } from '../../constants/admin';
import type { BoardType } from '../../types/board';
import {
  REPORT_REASONS,
  blockUser,
  reportContent,
  type ReportTarget,
} from '../../services/moderationService';

export interface MenuTarget {
  type: ReportTarget;
  /** 글이면 postId, 댓글이면 commentId */
  id: string;
  /** 댓글일 때만 — 상위 글 ID */
  postId?: string;
  authorUid: string;
  nickname: string;
  /**
   * 글의 게시판 종류. `'log'` 면 본인이라도 삭제 항목을 띄우지 않는다 —
   * ⚠️ 등반일지 글은 지워도 **일지가 공개 상태로 남아** 다음 저장 때 되살아난다.
   *    firestore.rules 도 같은 이유로 막고 있다. 내리려면 일지의 '공개' 스위치를 끈다.
   */
  boardType?: BoardType;
}

export interface PostMenuOptions {
  /** 본인/관리자일 때 보여줄 삭제 동작. 없으면 삭제 항목이 안 뜬다 */
  onDelete?: () => void;
  /** 차단·신고 뒤 목록에서 즉시 치우고 싶을 때 */
  onHidden?: (authorUid: string) => void;
}

export function usePostMenu() {
  const uid = useAuthStore((s) => s.user?.uid);
  const isAdmin = isAdminEmail(useAuthStore((s) => s.user?.email));

  const report = useCallback(
    (t: MenuTarget) => {
      if (!uid) {
        return;
      }
      Alert.alert(
        '신고 사유',
        '접수된 신고는 24시간 안에 확인합니다.\n신고가 쌓이면 자동으로 숨겨집니다.',
        [
          ...REPORT_REASONS.map((reason) => ({
            text: reason,
            onPress: () => {
              void reportContent({
                targetType: t.type,
                targetId: t.id,
                postId: t.postId,
                authorUid: t.authorUid,
                reason,
                reporterUid: uid,
              })
                .then(() => Alert.alert('신고 접수', '신고해 주셔서 감사합니다.'))
                .catch((e: unknown) =>
                  Alert.alert('신고 실패', e instanceof Error ? e.message : String(e)),
                );
            },
          })),
          { text: '취소', style: 'cancel' as const },
        ],
      );
    },
    [uid],
  );

  const block = useCallback(
    (t: MenuTarget, onHidden?: (authorUid: string) => void) => {
      if (!uid) {
        return;
      }
      Alert.alert(
        `${t.nickname} 차단`,
        '이 사용자의 글과 댓글이 내 화면에서 보이지 않게 됩니다.\n상대에게는 알리지 않습니다.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '차단',
            style: 'destructive',
            onPress: () => {
              void blockUser(uid, t.authorUid, t.nickname)
                .then(() => onHidden?.(t.authorUid))
                .catch((e: unknown) =>
                  Alert.alert('차단 실패', e instanceof Error ? e.message : String(e)),
                );
            },
          },
        ],
      );
    },
    [uid],
  );

  /** ⋯ 을 눌렀을 때 부르는 함수 */
  const openMenu = useCallback(
    (t: MenuTarget, opts: PostMenuOptions = {}) => {
      const mine = !!uid && t.authorUid === uid;

      // 로그인 안 한 사람에게 신고 버튼을 띄워 봐야 규칙에서 막힌다
      if (!uid) {
        Alert.alert('로그인 필요', '신고·차단은 로그인 후 이용할 수 있습니다.');
        return;
      }

      const buttons = [];
      const isLog = t.boardType === 'log';
      if ((mine || isAdmin) && opts.onDelete && (!isLog || isAdmin)) {
        buttons.push({ text: '삭제', style: 'destructive' as const, onPress: opts.onDelete });
      }
      if (mine && isLog && !isAdmin) {
        buttons.push({
          text: '내리는 방법',
          onPress: () =>
            Alert.alert(
              '등반일지 글 내리기',
              '마이페이지 ▸ 등반일지에서 해당 일지를 열고 ' +
                "'커뮤니티에 공개' 스위치를 끄면 이 글이 사라집니다.",
            ),
        });
      }
      if (!mine) {
        buttons.push({ text: '신고', onPress: () => report(t) });
        buttons.push({
          text: '이 사용자 차단',
          style: 'destructive' as const,
          onPress: () => block(t, opts.onHidden),
        });
      }
      buttons.push({ text: '취소', style: 'cancel' as const });

      Alert.alert('', '', buttons);
    },
    [uid, isAdmin, report, block],
  );

  return { openMenu, report, block };
}
