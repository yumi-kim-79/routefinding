/**
 * 금칙어 검사 — 글·댓글 작성 시 1차 거름망.
 *
 * ⚠️ 이건 **완벽한 필터가 아니다.** 우회는 얼마든지 가능하다.
 *    목적은 "명백한 것을 올리기 전에 막는" 것이고, 진짜 대응은 신고 + 관리자 처리다
 *    (services/moderationService.ts). 둘 중 하나만 있으면 심사에서 부족하다.
 *
 * ⚠️ 과하게 잡으면 정상 글이 막힌다. 등반 용어와 겹치는 단어는 넣지 말 것
 *    (예: '죽음의 계곡', '자살바위' 는 실제 등반지·루트 이름이다).
 */

/** 명백한 욕설·비속어만. 애매한 건 넣지 않는다 */
const WORDS = [
  '시발', '씨발', '씨빨', 'ㅅㅂ', '개새끼', '새끼야', '병신', 'ㅂㅅ',
  '지랄', '좆', '보지', '자지', '섹스', '창녀', '미친년', '미친놈',
  '느금마', '니애미', '엠창', '노무현', '틀딱', '한남충', '김치녀',
];

/** 연락처·계좌 유도 — 중고거래 사기의 첫 신호다 */
const PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b\d{2,3}-?\d{3,4}-?\d{4}\b/, label: '전화번호' },
  { re: /계좌|입금|선입금|송금/, label: '계좌·입금 안내' },
];

export interface ProfanityResult {
  ok: boolean;
  /** 사용자에게 보여줄 안내 (ok 면 undefined) */
  message?: string;
}

/**
 * @param strict `true` 면 연락처·계좌 패턴까지 막는다.
 *   중고거래 게시판에서만 켠다 — 자유게시판에서 전화번호를 막을 이유는 없다.
 */
export function checkText(text: string, strict = false): ProfanityResult {
  // 자모 분리·공백 우회를 조금이라도 줄인다
  const flat = text.replace(/[\s.·*_-]/g, '');

  const hit = WORDS.find((w) => flat.includes(w));
  if (hit) {
    return { ok: false, message: '욕설·비속어가 포함되어 있어 등록할 수 없습니다.' };
  }

  if (strict) {
    const p = PATTERNS.find((x) => x.re.test(text));
    if (p) {
      return {
        ok: false,
        message:
          `${p.label}가 본문에 들어 있습니다.\n` +
          '선입금 사기를 막기 위해 연락처·계좌는 본문에 적지 않습니다. 댓글로 직접 연락하세요.',
      };
    }
  }

  return { ok: true };
}
