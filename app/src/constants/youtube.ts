/**
 * 유튜브 검색 (선택 기능).
 *
 * ⚠️ 키가 **비어 있어도 앱은 정상 동작한다.** 키가 없으면 앱 안에서 후보를 못 보여주고,
 *    대신 유튜브 앱/웹을 검색어와 함께 열어 준다 (services/youtubeSearch.ts).
 *
 * 키 만드는 법:
 *   Google Cloud Console → 우리 Firebase 프로젝트(routefinding09-4b597)
 *   → 'YouTube Data API v3' 사용 설정 → 사용자 인증 정보 → API 키
 *   → ⚠️ 키 제한에서 **YouTube Data API v3 만** 허용할 것
 *
 * ⚠️ 무료 할당량은 하루 10,000 유닛이고 **검색 1회가 100 유닛**이다 = 하루 100회.
 *    그래서 목록 화면에서 자동으로 부르지 않는다. **사람이 버튼을 눌렀을 때만** 검색한다.
 *
 * ⚠️ 이 키는 클라이언트에 박히므로 비밀이 아니다. 반드시 API 제한을 걸 것.
 */
export const YOUTUBE_API_KEY = '';

/** 검색어 만들기 — 루트명만으로는 '노을' 같은 흔한 단어가 엉뚱하게 걸린다 */
export function videoQuery(mountain?: string, zone?: string, routeName?: string): string {
  return [mountain, zone, routeName, '클라이밍']
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
