# MyRouteTab / MyRouteCard — 2026-09-14 대체됨

`src/components/favorites/FavoriteList.tsx` 가 대신한다.

치워 둔 이유:
1. **MyRouteCard 가 `RouteDetail`(= 제보 상세, 관리자 화면)로 이동했다.** 즐겨찾기를
   눌렀을 때 가야 할 곳은 `ConceptDetail` 이다. 잘못된 목적지를 그대로 둔 파일은
   나중에 누군가 다시 갖다 쓴다.
2. 카드마다 `routeRef` 를 `getDoc` 했다(N+1). 즐겨찾기 40개면 읽기가 40번 더 생기고
   카드가 제각기 늦게 채워져 목록이 덜컹거린다. 새 구현은 `my_routes` 문서의
   스냅샷 필드만 쓴다 — 읽기는 구독 1개뿐이다.
3. 어느 화면에서도 참조하지 않는다(v2.2.0 에서 마이페이지 탭이 등반일지로 교체됨).

되살릴 일은 없을 것으로 본다. 지워도 된다.
