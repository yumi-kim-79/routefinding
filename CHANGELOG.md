# 📋 CHANGELOG

이 프로젝트의 모든 변경 사항은 이 파일에 기록된다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 를 따른다.
버전 관리는 [Semantic Versioning](https://semver.org/lang/ko/) 을 따른다.

---

## [Unreleased] — v2.0 마이그레이션 진행 중

### 📅 2026-08-05 (15차) — 🐛 첫 사진 첨부 모자이크 — 진짜 원인은 레이아웃 타이밍

> 14차에서 `maxWidth` 탓으로 보고 iOS에서 뺐지만 **증상이 그대로였다.** 오진이었다.

#### 원인 — 캔버스 크기를 재기 전에 사진이 먼저 올라갔다
- 캔버스 영역(`area`)은 첫 렌더에서 **1×1**이고 `onLayout`이 돌아야 실제 크기가 된다
- 그 사이에 `<Image>`가 먼저 마운트되면 **iOS가 1px 크기로 디코딩한 비트맵을 캐시**하고,
  뷰가 커진 뒤에도 그걸 확대해 쓴다 → **모자이크처럼 뭉개진다**
- 나갔다 다시 첨부하면 그땐 이미 크기가 잡혀 있어 정상으로 보였다 — **매번 같은 패턴이던 이유**

#### Fixed
- **크기를 잰 뒤에만**(`area.w > 1`) 사진과 오버레이를 그린다
- `<Image>`의 `key`에 캔버스 크기를 넣어, 나중에 크기가 바뀌어도 다시 디코딩하게 했다

#### 되돌린 판단
- `constants/image.ts`의 "iOS는 축소하면 저해상도 임시본을 물어온다"는 서술은 **근거가 없어졌다**.
  주석을 정정하고 `[TODO]`로 남겼다 — 이번 수정이 확인되면 iOS에도 축소를 되살린다
  (업로드 용량·시간이 준다). 한 번에 하나씩 확인하려고 이번 빌드에서는 원본 그대로 둔다

#### 검증
- `tsc --noEmit` 에러 0 / `eslint` 에러 0


### 📅 2026-08-05 (14차) — 🐛 iOS에서 첫 사진 첨부가 모자이크로 보이던 문제

#### 원인 — 어제 넣은 축소 옵션이 iOS에서 역효과
- 안드로이드 메모리 부족(업로드 중 앱 종료)을 막으려고 사진 선택에
  `maxWidth`/`maxHeight`/`quality`를 넣었는데(10차),
- **iOS는 `maxWidth`가 지정되면 저해상도 임시본(degraded)을 먼저 돌려주고**
  라이브러리가 그걸 그대로 저장한다 → 처음 첨부하면 모자이크처럼 뭉개져 보이고,
  나갔다 다시 첨부하면 정상으로 보인다 (매번 같은 패턴 — 사용자 스크린샷으로 확인)

#### Fixed — 축소는 Android에서만
| 플랫폼 | 처리 | 이유 |
|---|---|---|
| Android | 긴 변 2048px · 품질 0.8로 축소 | 원본(5,000만 화소급)이면 업로드 중 메모리 부족으로 죽는다 |
| iOS | **원본 그대로** | 축소 옵션이 저해상도 임시본을 물어온다. iOS는 메모리로 죽은 사례가 없다 |

- ⚠️ 이 차이는 취향이 아니라 **각 OS에서 실제로 터진 문제**에 맞춘 것이다.
  한쪽 값을 다른 쪽에 그대로 옮기면 그 OS의 문제가 되살아난다 — `constants/image.ts`에 주석으로 남김

#### 검증
- `tsc --noEmit` 에러 0


### 📅 2026-08-05 (13차) — 🐛 승인 요청이 무한 로딩에 걸리던 문제

#### 원인 — `react-native-view-shot`이 iOS 바이너리에 없었다
```
Unhandled JS Exception: Invariant Violation:
TurboModuleRegistry.getEnforcing(...): 'RNViewShot' could not be found.
```
- `package.json`에는 추가됐지만 **`pod install`을 하지 않아** 네이티브 모듈이 안 들어갔다
  (`Podfile.lock` 확인: svg·maps·geolocation·documents는 있고 **view-shot만 없음**)
- 라인 합성 단계에서 예외가 밖으로 새어 나가 **저장 버튼이 무한 로딩**에 걸렸다

#### Fixed — 합성 실패를 앱이 감당하게
- `captureRef`를 **별도 try/catch**로 감싸 예외가 새어 나가지 않게 했다.
  이제 어떤 경우에도 저장 버튼이 풀린다
- 실패하면 무슨 일인지 알리고 **선택지를 준다**: `취소` / `원본만 저장`
  - 원본만 저장해도 **선·글자 좌표는 그대로 저장**되므로 앱·웹의 사진 화면에서는 선이 보인다
  - 다만 승인해서 개념도에 넣을 때는 **선이 빠진 원본**이 들어간다 — 이 점을 문구로 명시
- 조용히 원본만 저장하지 않는 이유: 나중에 승인했을 때 선이 사라진 걸 발견하는 것보다
  **저장 시점에 아는 편이 낫다**

#### 교훈 — 빌드 안내에서 놓친 것
`react-native-view-shot`을 추가한 커밋(`5f0b161`)에서는 준비 단계를 안내했지만,
이후 여러 턴 동안 "JS만 바뀌었습니다"로 안내하면서 **`pod install`이 누락된 채 계속 빌드**됐다.
→ 네이티브 의존성을 추가한 뒤에는 **그 이후 안내에도 한동안 준비 단계를 유지**해야 한다.


### 📅 2026-08-05 (12차) — 찍은 글자를 끌어서 옮기기

#### Added — 글자 위치 수정
- 글자 도구에서 **이미 찍어둔 글자를 누르면 새로 만들지 않고 그 글자를 잡는다.**
  손가락을 따라 옮겨지고, 떼면 그 자리에 고정된다 (잘못 찍었을 때 다시 지울 필요가 없다)
- 빈 곳을 누르면 지금까지처럼 새 글자가 찍힌다
- 글자를 잡은 상태에서 두 번째 손가락이 들어오면 잡기를 놓고 확대·이동으로 넘어간다

#### 구현 메모 — 글자 히트 판정
- RN에는 그려진 텍스트의 실제 폭을 재는 API가 없다 →
  **글자당 폭 ≈ 글꼴 크기의 0.6배**로 근사한다 (글꼴 크기는 세로의 4% = `FONT_RATIO`)
- 손가락이 굵으므로 최소 잡기 범위(가로 3.5%, 세로 3%)를 따로 둔다.
  짧은 글자('1P')도 확실히 잡힌다
- 겹쳐 있으면 중심이 가장 가까운 것을 잡는다
- ⚠️ **이동은 되돌리기 이력에 넣지 않는다.** 되돌리기는 '추가한 것'을 취소하는 동작이라
  위치 변경까지 섞으면 무엇이 취소될지 예측하기 어려워진다

#### 검증
- `tsc --noEmit` 에러 0 / `eslint` 에러 0


### 📅 2026-08-05 (11차) — 사진 편집기 전면 개편 (전체화면 + 확대 편집)

> 사진이 작아 라인을 정확히 긋기 어렵다는 피드백.

#### Changed — 캔버스를 화면 전체로
- 스크롤을 없앴다. **스크롤과 그리기 제스처가 서로를 잡아먹는다** — 화면을 고정하고
  캔버스가 남는 공간을 전부 차지한다
- 헤더는 한 줄로 압축(대상 루트명 + 사진 변경), 도구 바는 하단 고정

#### Added — 확대한 상태로 그리기
- **두 손가락 = 확대·이동(1~6배), 한 손가락 = 그리기.** 확대해 놓고 세밀하게 그을 수 있다
- 확대 중 두 번째 손가락이 들어오면 **그리던 획을 버린다** (확대하려던 것이지 그릴 의도가 아니다)
- 확대 중에도 도구·색상 바는 그대로 떠 있어 언제든 바꿀 수 있다. `원래 크기` 버튼으로 복귀
- 점 간격 임계값을 배율로 나눠, 확대할수록 더 촘촘히 기록한다

#### Fixed — 🚨 앱에서 그린 선이 웹에서 어긋나던 문제
- 좌표는 **사진 박스 기준 0~1 정규화**인데, 캔버스가 **4:3 고정**이었다.
  세로 사진을 올리면 위아래 검은 여백까지 좌표 범위에 들어가 웹에서 열면 선이 밀렸다
- → 캔버스를 **사진의 실제 종횡비와 정확히 같게** 만든다 (여백 0)
- 확대/이동 중 찍힌 화면 좌표는 **역변환**해서 사진 좌표로 되돌린다
  (`s = c + (p−c)·k + t` 의 역 — `toContent`)
- 합성본 캡처 전에 **배율을 원래대로 되돌린다.** 확대 상태로 캡처하면 잘린 그림이 구워진다

#### 검증
- `tsc --noEmit` 에러 0 / `eslint` 에러 0
- ⏳ 미검증: 실기기에서 확대 편집·합성본 정확도


### 📅 2026-08-05 (10차) — 클러스터링 정정 · 시작 속도 · 안드로이드 업로드 크래시

#### Fixed — 같은 자리인데 마커가 둘로 찍히던 문제
- **원인**: 웹을 따라 좌표를 `toFixed(5)`로 반올림해 **격자**로 묶었는데, 격자는 경계 문제가 있다.
  2m 떨어진 두 루트가 격자 경계에 걸치면 서로 다른 칸으로 가서 마커가 따로 찍힌다
  (사용자 스크린샷에서 확인 — 같은 바위인데 핀 2개)
- **조치**: 격자 → **거리 기준(30m)** 그룹핑. 경계 문제가 없고 "가까우면 묶인다"가 그대로 성립한다
- 전량 비교는 O(n²)라 5,000건에서 못 버틴다 → **성긴 격자로 후보를 좁힌 뒤 이웃 9칸만 거리 비교**
- 클러스터 좌표는 첫 루트 좌표를 대표로 쓴다 (평균을 내면 묶일수록 기준점이 흔들린다)
- 부수 효과: 마커 수가 줄어 지도 렌더도 가벼워진다

#### Changed — 좌표 입력은 소수점 6자리까지
- 6자리면 약 11cm 해상도로 암장 좌표엔 차고 넘친다. 그 아래는 GPS 오차 범위라 의미가 없고,
  자릿수만 늘면 같은 바위가 다른 좌표로 갈라진다
- 숫자·마이너스·점만 받고, 마이너스는 맨 앞 하나, 점도 하나로 정리한다

#### Changed — ⚡ 시작 속도 (stale-while-revalidate)
- 승인 루트 5,400건 서버 조회가 앱 켤 때마다 몇 초씩 걸렸다
- **로컬(오프라인) 캐시로 먼저 그리고, 서버 응답이 오면 조용히 갱신**한다
  (`getDocsFromCache` → 즉시 반환, 뒤에서 `getDocs`)
- 갱신은 `subscribeConceptsUpdate`로 지도·개념도 화면에 전달된다
- **두 번째 실행부터는 지도가 즉시 뜬다.** 네트워크가 죽어 있어도 캐시본으로 동작한다

#### Fixed — 🚨 안드로이드에서 사진 업로드 중 탭 이동 시 앱이 죽던 문제
- **원인**: 원본 해상도 그대로 골라서 최신 폰은 한 장이 5,000만 화소가 넘는다.
  미리보기 디코딩만으로 수백 MB를 쓰고, 업로드 중 다른 탭으로 가면 메모리 부족으로 죽는다
- **조치 (근본)**: 사진 선택 단계에서 **긴 변 2048px · 품질 0.8로 축소** (`constants/image.ts`).
  개념도·루트 사진 용도로는 충분하고(라인 그리기·확대에도 문제없다),
  업로드 시간과 Storage 사용량도 크게 준다 — 2026-08-03 한도 초과 이력 고려
- **조치 (안전판)**: `AndroidManifest.xml`에 `android:largeHeap="true"`
- 적용: 루트제보 사진 8장, 피치 사진, 개념도 사진 등록(촬영·앨범)

#### 검증
- `tsc --noEmit` 에러 0 / `eslint` 에러 0 / AndroidManifest XML 파싱 확인


### 📅 2026-08-05 (9차) — 위경도 직접 입력

#### Changed — 좌표를 직접 칠 수 있다
- 기존: `현재위치` / `지도에서 선택` 버튼으로만 지정 (칸은 읽기 전용)
- 변경: **위도·경도 입력칸을 직접 편집** 가능. 버튼 두 개는 그대로 유지
- 웹 수정 화면(`ConceptEditView`)도 직접 입력 방식이라 그쪽과도 맞는다
- 필요한 상황: 현장에서 GPS가 안 잡힐 때, **삭제된 루트를 예전 좌표로 되살릴 때**,
  다른 자료(지형도·GPX)에서 좌표를 옮겨 적을 때

#### Added — 좌표 검증
- 숫자가 아니거나 범위를 벗어나면(위도 ±90, 경도 ±180) 입력칸 아래에 사유를 띄우고
  **저장 버튼을 잠근다**
- 잘못된 값이 저장되면 지도에서 엉뚱한 곳(또는 `0,0` = 아프리카 앞바다)에 찍힌다
- 키보드는 플랫폼별로: iOS `numbers-and-punctuation`(소수점·음수 입력 가능) / Android `numeric`

#### 검증
- `tsc --noEmit` 에러 0 / `eslint` 에러 0


### 📅 2026-08-05 (8차) — 기존 Storage 사진 불러오기 (삭제 복구용)

#### Added — 관리자 전용 '이 루트에 올라가 있던 기존 사진 불러오기'
- **개념도 문서를 지워도 Storage의 사진 파일은 지워지지 않는다** (2026-08-05 실측).
  루트를 다시 만들 때 사진을 처음부터 다시 올릴 필요가 없어야 한다
- `services/storageBrowseService.ts` — `route_images/{산}/{구역|미지정}/{루트}` 폴더를
  `list()`로 훑어 다운로드 URL까지 만들어 준다. 파일명이 `root_1, root_2 …`라 이름순이 곧 원래 순서
- `screens/report/components/StoredImagePicker.tsx` — 격자에서 골라 담는다.
  이미 폼에 있는 사진은 '이미 추가됨'으로 잠근다
- 고른 사진은 `remoteUrl`이 채워진 채 폼에 들어가 **재업로드하지 않는다**
  (Storage 쓰기 0회 — 2026-08-03 한도 초과 이력 고려)
- 루트제보 작성/수정 화면 양쪽에서 쓴다. **등반지·루트 이름을 먼저 입력**해야 버튼이 뜬다
  (폴더 경로가 그 이름으로 만들어지기 때문)

> ⚠️ 폴더 경로는 **이름으로 만들어진다.** 예전과 등반지·구역·루트명이 한 글자라도 다르면
> 사진을 못 찾는다. 이번 복구 대상은 `route_images/무의도/호룡골/황발이`.

#### 검증
- `tsc --noEmit` 에러 0 / `eslint` 에러 0
- ⏳ 미검증: 실기기에서 목록 조회(Storage 규칙의 list 권한 포함)·선택·저장


### 📅 2026-08-05 (7차) — 실수 삭제 방지 + 제보 관리 정리

> ⚠️ **사고 발생**: 관리자가 개념도 상세를 보다가 실수로 루트 하나를 삭제했다
> (무의도 · 호룡골 · 황발이). Firestore 문서 삭제는 되돌릴 수 없다.

#### Removed — 🚨 개념도 상세의 관리자 수정/삭제 버튼
- 개념도를 **보다가** 실수로 삭제하는 사고가 실제로 났다
- 수정·삭제는 **개념도 목록 카드에서만** 한다 — 그쪽은 대상이 카드로 명확히 구분되고,
  보는 흐름(상세 열람)과 관리 흐름(목록 관리)이 섞이지 않는다

#### Fixed — 승인된 사진이 개념도에서 안 지워지던 문제
- **원인**: 사진이 승인되면 개념도 `imageUrls`에 들어가 위쪽 캐러셀에 나온다.
  그런데 상세 하단 '등록된 사진' 스트립이 **승인된 사진도 계속 그리고 있었다** →
  관리자가 개념도 수정에서 그 사진을 지워도 **아래쪽에 그대로 남아** 안 지워진 것처럼 보였다
- **조치**: 스트립은 **아직 처리되지 않은(승인 대기·반려) 사진만** 그린다.
  제목도 '검토 중인 사진'으로 바꿨다
- 웹도 같은 중복 표시를 한다 → 웹 수정 필요 [TODO]

#### Changed — 관리자 제보 관리: 처리한 건은 목록에서 자동으로 빠진다
- 관리자 구독을 `status in ['draft','pending','rejected']` → **`['draft','pending']`**
- 승인·반려하면 status가 바뀌어 쿼리에서 빠지므로 **목록에서 즉시 사라진다**
- 반려된 건은 **올린 사람 본인**의 구독에는 남아 사유를 계속 확인할 수 있다

#### Changed — 삭제 기능
- 루트 제보: 삭제 버튼은 이미 있었다(본인 또는 관리자, 상태 무관) — 유지
- 개념도 사진: **관리자도 삭제**할 수 있게 했다 (기존엔 올린 본인만 '등록 취소')

#### Fixed — 승인·삭제 후 캐시 무효화 누락
- 제보 승인(`ReportActions`)과 삭제에서 `clearConceptCache()`를 부르지 않아
  승인된 루트가 개념도·지도에 최대 5분간 안 나왔다

#### 검증
- `tsc --noEmit` 에러 0 / `eslint` 에러 0


### 📅 2026-08-05 (6차) — 반려 사유 표시

#### Fixed — 반려했는데 사유가 안 보이던 문제
- 필드명은 앱·웹·문서가 모두 `rejectionReason`으로 **일치**한다(확인함).
  문제는 **표시 조건**이었다: 사유가 있을 때만 줄을 그려서
  *저장이 안 된 건지 표시가 안 되는 건지 구분할 수 없었다*
- 반려 상태면 **항상** 사유 줄을 띄운다 — 웹의 `반려사유: {{ ... || '없음' }}`와 동일.
  값이 없으면 '없음'이 보이므로 원인이 바로 드러난다
- 줄 수 2 → 4, 색을 warning → error로 (상태와 같은 계열이라 눈에 띈다)
- 레거시 대비: 읽을 때만 `rejectionReason ?? rejectReason` 둘 다 본다
  (02_DATA_MODEL 초안이 `rejectReason`을 쓴 이력이 있다. **쓰기는 항상 `rejectionReason`**)

#### Added — 개념도 사진에도 반려 사유 표시
- 웹은 보여주는데 앱엔 없었다 → 제보 관리 카드와 개념도 상세 스트립 양쪽에 추가

#### Fixed — 실패가 화면을 덮던 문제
- 승인·반려·삭제가 실패하면 `setError`로 **목록 전체가 에러 화면으로 바뀌었다**
- 실패는 알림(Alert)으로 알리고 목록은 그대로 둔다. 무엇이 실패했는지도 함께 표시

#### 검증
- `tsc --noEmit` 에러 0 / `eslint` 에러 0


### 📅 2026-08-05 (5차) — 🐛 키보드 가림 + 개념도 수정이 반영 안 되던 문제

#### Fixed — 입력칸이 키보드에 가려 뭘 쓰는지 안 보이던 문제
- **원인**: `KeyboardAvoidingView behavior="padding"`만으로는 iOS에서 하단 입력칸이 가려진다.
  `SafeAreaView` 안쪽이라 높이 계산이 어긋난다
- **조치**: `components/common/KeyboardAwareScroll.tsx` 신설
  - iOS는 `automaticallyAdjustKeyboardInsets`(RN 0.70+)로 스크롤 인셋 자동 조정
  - Android는 매니페스트의 `adjustResize`가 처리 + 넉넉한 하단 여백(260)
  - `keyboardDismissMode`도 플랫폼별로 자연스럽게
- 적용: **등반일지 작성 / 루트제보 작성·수정 / 개념도 사진 등록** 세 화면이 같은 동작을 갖는다

#### Fixed — 🚨 관리자가 개념도를 수정해도 반영되지 않던 문제
사진을 지우고 저장한 뒤 다시 들어가면 **지운 사진이 그대로 보였다.** 원인이 두 겹이었다.

1. **`conceptService`의 5분 캐시를 아무도 비우지 않았다.**
   `clearConceptCache()`가 정의만 돼 있고 **호출처가 한 곳도 없었다** →
   수정·삭제·사진 승인 후에도 목록/지도가 최대 5분간 옛 데이터를 보여준다
   → `updateReport` / `deleteReport` / `submitReport` / `approveConceptPhoto`에서 캐시를 비운다
   → `useConcepts`는 화면에 돌아올 때 재확인 (캐시가 살아 있으면 읽기 0, 비었으면 그때만 재조회)
2. **개념도 상세가 다시 읽지 않았다.**
   수정 화면에서 돌아와도 첫 로드 결과가 그대로 남는다 (Firestore 오프라인 캐시도 겹친다)
   → 화면에 다시 포커스되면 재조회 (첫 진입은 중복 조회하지 않도록 가드)

#### 검증
- `tsc --noEmit` 에러 0 / `eslint` 에러 0
- ⏳ 미검증: 실기기에서 키보드 가림·수정 반영


### 📅 2026-08-05 (4차) — 이미지 URL 변환 + 개념도 상세 사진 오버레이

#### Fixed — 🚨 개념도 사진이 403으로 안 뜨던 문제 (웹에는 있던 처리가 앱에 없었다)
- DB의 이미지 URL이 `https://storage.googleapis.com/<bucket>/<path>` 형식이다.
  이 형식은 **Storage 보안 규칙이 아니라 GCS IAM**을 타서 그냥 쓰면 **403**이다
  (`docs/03` 인수인계 실측 항목). 웹은 `getDownloadURL()`로 재변환하는데 앱은 안 하고 있었다
- `services/imageUrlService.ts` — 변환 + 앱 수명 캐시 + 중복 요청 병합
- `components/common/RemoteImage.tsx` — 화면마다 따로 처리하지 않도록 흡수.
  변환이 필요 없는 주소면 첫 렌더부터 그대로 그려 깜빡임이 없다
- 적용: 개념도 카드 썸네일 / 상세 캐러셀 / 피치 썸네일 / 전체화면 뷰어 / 사진 검토 카드

#### Added — 개념도 상세에 등록된 사진 + 라인 오버레이 (`ConceptPhotoStrip`)
- 승인된 사진은 모두, **승인 대기는 올린 본인과 관리자만** 보인다 (규칙과 동일)
- 관리자는 상세에서 바로 **승인·추가 / 승인·교체**, 본인은 **등록 취소**
- 합성본이 아니라 **원본 + 좌표 오버레이**로 그린다 → 나중에 선만 고치는 것도 가능
- ⚠️ Firestore 쿼리는 결과 문서를 **전부 읽을 수 있어야** 통과한다.
  `where(conceptId==X)`만 걸면 남의 pending이 섞여 **쿼리 전체가 권한 오류**로 죽는다
  → 일반 사용자는 '승인된 것' / '내 것' **두 쿼리로 나눠** 구독하고 합친다

#### 검증
- `tsc --noEmit` 에러 0 / `eslint` 에러 0 (경고 57건은 기존 컨벤션 범위)
- ⏳ 미검증: 실기기에서 사진 표시·오버레이 정렬·상세 승인


### 📅 2026-08-05 (3차) — 관리자 개념도 수정·삭제 + 즐겨찾기 (웹 기능 따라잡기)

#### Added — 관리자 개념도 수정 (`ConceptEditScreen`)
- 웹 `concepts/edit/:id`(ConceptEditView) 대응. 목록 카드와 상세 양쪽에서 진입
- 입력 필드가 루트제보 작성과 완전히 같아 **`ReportWriteScreen`을 수정 모드로 재사용**했다.
  웹은 화면이 둘로 나뉘어 있어 필드가 갈라질 위험이 있는데, 여기서는 한 곳만 고치면 된다
- 기존 사진은 재업로드하지 않는다(`LocalImage.remoteUrl`), 새로 고른 것만 올린다
- `status`/`timestamp`/`authorUid`는 건드리지 않는다 — 수정으로 승인 상태나 작성자가 바뀌면 안 된다

#### Fixed — 🚨 수정 시 데이터가 지워질 뻔한 모델 누락 2건 (수정 기능 만들다 발견)
| 필드 | 문제 | 조치 |
|---|---|---|
| `type` (등반 형태) | 문서의 `type`은 '슬랩' 같은 **등반 형태**인데, `Concept.type`이 리드/볼더링으로 **덮어써서 원본이 사라진다.** 그대로 저장하면 등반 형태가 지워진다 | `conceptService`가 원본을 `climbType`에 보존 |
| `pitches[].name`, `.gear` | `ConceptPitch` 모델에 아예 없었다. 저장 시 피치 이름·장비가 날아간다 | 모델에 추가 |

#### Added — 즐겨찾기 (별) · 등반일지 바로가기
- 개념도 목록 카드에 **별 / 연필(등반일지) / 카메라(사진 등록) / 관리자 수정·삭제** 액션 열 추가
  (웹 카드와 같은 구성). 상세에도 즐겨찾기·관리자 버튼 추가
- ⚠️ **`my_routes` 문서 모양이 웹과 v1에서 다르다** (실측):
  v1/앱 `MyRouteTab`은 `routeRef`(DocumentReference)를 deref하고,
  웹은 `routeId`(문자열)+스냅샷 필드를 쓴다. 한쪽만 쓰면 다른 화면에서 빈 항목이 된다
  → **둘 다 쓴다.** 문서 id는 개념도 id와 같게 둬서 존재 확인이 간단하다

#### 검증
- `tsc --noEmit` 에러 0 / `eslint` **에러 0** (경고 51건은 기존 컨벤션 범위)
- ⏳ 미검증: 실기기에서 수정 저장·삭제·즐겨찾기

#### 아직 웹과 다른 것 (다음 후보)
1. **개념도 이미지 URL 변환 미적용** — 웹은 `storage.googleapis.com` 원본 주소를
   `getDownloadURL()`로 재변환한다(GCS IAM 때문에 그냥 쓰면 403). 앱은 아직 안 한다 → 일부 사진이 안 뜰 수 있음
2. 개념도 **상세에 등록된 사진 오버레이 표시** + 관리자 인라인 승인 (앱은 제보 관리에서만)
3. 개념도 상세의 **GPX 버튼**(붙여넣기/업로드/복사/다운로드/공유)
4. 임시저장 — **웹도 미구현**(버튼만 있고 동작 없음)


### 📅 2026-08-05 (2차) — 관리자가 앱에서도 남의 제보를 승인할 수 있게

#### Added — 관리자 전체 제보 조회
- 기존: `MyReportsTab`이 관리자여도 `authorUid == 내 uid`만 구독 → **남의 제보가 안 보였다**
- 추가: 관리자면 두 컬렉션에 `where status in ['draft','pending','rejected']` 구독을 더 건다
  (본인 구독은 그대로 두고 컬렉션/id로 중복 제거)
- ⚠️ 웹은 `where(status in ...) + orderBy(timestamp)`를 쓰지만 그 조합은 **복합 색인이 필요**하다.
  앱은 **단일 where만 쓰고 정렬은 클라이언트에서** 한다 — `conceptService`와 같은 방침.
  색인 배포를 기다릴 필요가 없고, 색인 없이 실패해 조용히 빈 목록이 되는 사고도 막는다

#### Fixed — 🚨 승인·반려가 항상 `route_reports`로 나가던 문제
- `ReportActions`의 승인과 `MyReportsTab`의 반려가 **`route_reports`로 하드코딩**돼 있었다
  (v1 동작을 그대로 옮긴 결과 — 그동안은 본인 제보만 보였고 대부분 리드라 드러나지 않았다)
- 관리자가 볼더링 제보까지 보게 되면서 **엉뚱한 컬렉션의 같은 id 문서를 승인/반려**할 수 있게 됐다.
  최악의 경우 관계없는 리드 루트가 승인된다
- → 카드가 들고 있는 `report.collection`을 쓰도록 수정

#### 검증
- `tsc --noEmit` 에러 0
- ⏳ 미검증: 관리자 계정으로 남의 볼더링 제보 승인·반려


### 📅 2026-08-05 — 🐛 사진 등록 실기기 피드백 3건 수정 + 사진 승인 화면

> 실기기(iOS·Android) 확인에서 나온 문제들.

#### Fixed — 글자 색이 항상 검게 보이던 문제
- **원인**: 웹은 `paint-order="stroke"`로 검정 외곽선을 먼저 깔고 색을 덮는데,
  **react-native-svg는 `paint-order`를 지원하지 않는다.** 그래서 외곽선이 글자색을 덮어버렸다
  (빨강·노랑 어떤 색을 골라도 검게 보임)
- **조치**: 같은 글자를 두 번 그린다 — ① 외곽선만(`fill="none"`) ② 그 위에 색만(`stroke` 없음)

#### Fixed — iOS에서 모달 상단 X 버튼이 안 눌리던 문제
- **원인**: RN `Modal`은 `SafeAreaView` 바깥이라 **노치·상태바 영역에 헤더가 그대로 들어간다.**
  카메라 홀 근처라 탭이 먹지 않았다
- **조치**: `useSafeAreaInsets().top`만큼 헤더 상단 여백 추가.
  사진 등록 모달과 좌표 선택 모달 **둘 다** 적용

#### Added — 개념도 사진 승인 화면 (제보 관리)
- **등록한 사진이 제보 관리에 안 보이던 이유**: `concept_photos`는 별도 컬렉션이라
  `route_reports` 구독에 잡히지 않는다. 저장은 정상이었고 **보여주는 화면이 없었다**
- 제보 관리 상단에 사진 섹션 추가:
  - 관리자 → `pending`·`rejected` 전체, 일반 사용자 → 본인 것만 (보안 규칙과 동일 조건)
  - 관리자 액션: **승인·추가 / 승인·교체 / 반려(사유)** — 웹과 동일
  - 본인 액션: 승인 전 **등록 취소**
  - 썸네일 탭 → 공용 뷰어(핀치 줌)로 크게 보기
- 승인 시 개념도에 넣는 URL은 **합성본(flatUrl)** — 선을 안 그렸으면 원본
  (목록·뷰어는 URL을 그냥 띄우므로 원본을 넣으면 라인이 사라진다)
- `services/conceptPhotoReview.ts`로 분리 (비용 발생 호출은 service에 격리 — CLAUDE.md)

#### 알아둘 것 — 앱의 제보 관리는 아직 '내 제보'만 본다
`MyReportsTab`의 route_reports/bouldering_reports 구독은 관리자여도 `authorUid == 내 uid`다.
웹은 관리자에게 **전체 pending**을 함께 보여준다. 사진(concept_photos)은 이번에 맞췄지만
**루트 제보 자체는 아직 웹과 다르다.** [QUESTION] 앱에서도 관리자 전체 조회가 필요한지 확인 후 반영.

#### 검증
- `tsc --noEmit` 에러 0
- ⏳ 미검증: 실기기에서 글자색·X 버튼·승인 흐름


### 📅 2026-08-04 (8차) — 개념도 이미지 확대 + 사진 등록·라인 그리기

> 웹에는 있는데 앱에 없던 두 기능. 사용자 확인 2026-08-04.

#### Added — 전체화면 뷰어 핀치 줌 (`components/common/ZoomableImage.tsx`)
- 개념도는 "사진 위의 라인"을 읽는 게 목적이라 확대가 필수인데
  앱 뷰어는 가로 스와이프만 됐다 (`[TBD] 제스처 라이브러리` 주석 상태였음)
- 두 손가락 확대(1~4배) · 확대 중 드래그 · **두 번 탭 확대/복귀**
- 확대 중에는 가로 스와이프를 잠근다 (이동과 페이지 넘김이 싸우지 않도록)
- **외부 제스처 라이브러리 없이** RN 내장 `PanResponder` + `Animated`로 구현.
  gesture-handler + reanimated는 네이티브 의존성이 2개 늘고, maps·svg에서 겪은
  RN 버전 불일치 함정이 반복될 수 있다

#### Added — 개념도 사진 등록 + 라인/텍스트 그리기
```
components/common/ConceptPhotoOverlay.tsx   읽기전용 SVG 오버레이 (웹 동명 컴포넌트 이식)
screens/route/components/ConceptPhotoEditor.tsx  촬영·첨부 → 그리기 → 등록 (모달)
services/conceptPhotoService.ts             원본+합성본 업로드 + concept_photos 생성
types/conceptPhoto.ts                       좌표 규약 + toPath (웹과 동일 알고리즘)
```
- 진입점 2곳 — **개념도 목록 카드의 카메라 버튼**, **상세의 '사진 등록 · 라인 그리기'**
  (웹의 📷 버튼 / '사진 등록' 버튼과 같은 자리)
- 도구: 선 / 글자 · 기본색 6종 · 되돌리기 · 전체 지우기 — 웹과 동일
- **좌표 규약을 웹과 동일하게 유지**: 0~1 정규화, 선 굵기 가로의 0.6%,
  글자 세로의 4%, 글자 외곽선 18%, 곡선은 이웃 두 점의 중점을 지나는 2차 베지어
- Storage 경로도 웹과 동일 → `storage.rules` 변경 불필요:
  `route_images/{산}/{구역}/{루트}/user_{uid}_{ts}.jpg` + `..._lined.jpg`
- **합성본을 업로드 시점에 만든다** — 승인되면 합성본이 개념도 `imageUrls`에 들어가는데,
  목록·캐러셀·뷰어는 URL을 그냥 이미지로 띄우므로 원본을 넣으면 라인이 사라진다

#### Added — 라이브러리 `react-native-view-shot` 4.0.3 (버전 고정)
- 라인 합성본을 굽는 용도. 4.0.3은 2024-12 릴리스로 RN 0.76 시기이고
  **C++ 소스가 없어** Yoga API 드리프트 위험이 없다 (svg에서 당한 방식의 사고 예방)

#### Added — iOS `NSCameraUsageDescription`
- `launchCamera`를 처음 쓰게 됐다. 이 문구가 없으면 **촬영 시 크래시**한다
  (`docs/06_iOS_BUILD_NOTES.md` §0-1에 예고돼 있던 항목)

#### 아직 안 한 것
- 개념도 목록·상세에서 **등록된 `concept_photos`의 오버레이를 겹쳐 보여주는 것**은 미구현.
  지금은 등록(제보)까지만 된다. 웹은 목록·상세에 오버레이를 그린다 → 다음 작업
- 관리자 승인 화면(승인·추가 / 승인·교체 / 반려)도 앱에는 아직 없다 (웹에서 처리 가능)

#### 검증
- `tsc --noEmit`: 신규 코드 에러 0 (react-native-view-shot 미설치 1건 제외)
- ⏳ 미검증: 실기기 촬영·그리기·합성·업로드


### 📅 2026-08-04 (7차) — 🐛 `react-native-svg` 버전 고정 (안드로이드 네이티브 빌드 실패 수정)

#### Fixed — `assembleRelease`가 C++ 컴파일에서 실패하던 문제
```
RNSVGLayoutableShadowNode.cpp:31:52: error: no member named 'StyleSizeLength'
  in namespace 'facebook::yoga'; did you mean 'StyleLength'?
```
- **원인**: Yoga가 RN 0.77에서 `StyleLength` → `StyleSizeLength`로 바뀌었고,
  `react-native-svg`는 **15.11.2(2025-02-24)부터** 새 API를 쓴다. 우리는 RN 0.76.9다
- **조치**: `react-native-svg` 15.15.5 → **15.11.1 고정** (캐럿 금지)
- 실측 경계: 15.11.1까지 `StyleLength` ✅ / 15.11.2부터 `StyleSizeLength` ❌

#### 배운 것 — `peerDependencies: "*"`는 호환을 보장하지 않는다
`react-native-svg`도 `react-native-maps`도 peer가 `*`라 **설치와 `tsc`는 통과하고
네이티브 빌드에서만 터진다.** 두 라이브러리 모두 RN 0.76을 쓰는 동안 버전을 올리면 안 된다.
판별법: 패키지의 `devDependencies.react-native`가 우리보다 높으면 의심할 것
(svg 15.15.5는 `^0.77.0`, 15.11.1은 `^0.77.0-rc.6`이라 이것만으로는 부족 —
`common/cpp`의 실제 API 사용을 확인해야 한다).


### 📅 2026-08-04 (6차) — 루트제보 작성 화면 (웹 ReportView.vue 이식)

> 4탭 중 마지막 플레이스홀더였던 루트제보를 실화면으로 교체.
> **웹 `/report`는 목록이 아니라 작성 폼**이라 앱도 탭을 누르면 바로 폼이 열린다.

#### Added — 작성 화면
```
src/screens/report/ReportWriteScreen.tsx        폼 조립
src/screens/report/hooks/useReportForm.ts       상태·검증·업로드 호출
src/screens/report/components/
  ImageStrip      사진 첨부(썸네일·삭제·순서)
  PitchEditor     피치 목록 (리드 전용)
  CoordPickerModal 지도에서 좌표 선택
src/services/reportService.ts                   Storage 업로드 + Firestore 저장
src/types/routeReport.ts                        폼 모델
```
- `components/common/PickerModal.tsx`로 이동 (지도 필터와 공용)
- 저장 필드·Storage 경로는 **웹과 1:1** (스키마 변경 없음):
  `route_images/{산}/{구역|미지정}/{루트}/root_{n}.jpg`,
  `pitch_images/{산}/{루트}/pitch{i}_{j}.jpg`, `route_gpx/{산}/{루트}/approach_{ts}.gpx`
- `status: 'pending'`으로 저장 → 관리자 승인 후 개념도·지도에 나온다

#### Added — 라이브러리 2개
| 라이브러리 | 이유 |
|---|---|
| `@react-native-community/geolocation` 3.4.0 | '현재위치' 버튼. 지도 탭은 `onUserLocationChange`로 됐지만 폼 화면엔 지도가 없다 |
| `@react-native-documents/picker` **10.1.7** | GPX 파일 선택. ⚠️ 12.x는 RN 0.79+ 요구(우리 0.76.9), 구 `react-native-document-picker`는 deprecated |

#### Changed — 웹과 다르게 간 부분 · 이유
| 항목 | 웹 | 앱 | 이유 |
|---|---|---|---|
| 등반지·구역 선택 | `<select>` | 공용 `PickerModal` + 직접 입력 토글 | RN에 select 없음. Picker 라이브러리는 iOS/안드로이드 UI가 완전히 달라 통일 불가 |
| 사진 순서 변경 | vuedraggable 드래그 | 좌/우 이동 버튼 | 드래그하려면 reanimated + gesture-handler 2개가 더 필요 |
| 지도에서 선택 | 마커 드래그 | 화면 중앙 십자선 | 손가락에 가리지 않고 양 플랫폼 동작이 동일 |
| 등반지·구역 목록 | 컬렉션 전체 재조회 | `conceptService` 5분 캐시 재사용 | 승인 루트 5,407건. 승인분만 보므로 목록이 약간 좁을 수 있으나 직접 입력이 항상 가능 |

#### 미구현 — [QUESTION] 임시저장
웹 폼에 `임시저장` / `임시저장 불러오기` 버튼이 있지만 **`saveDraft`·`showDraftList` 구현이 없다**
(눌러도 아무 일도 일어나지 않는다). 앱에는 넣지 않았다.
실제로 필요한 기능인지 확인 후 **양쪽에 같이** 넣는 것이 맞다.

#### 검증
- `tsc --noEmit`: 신규 코드 에러 0 (미설치 모듈 해석 3건 제외)
- ⏳ 미검증: `yarn install` → `pod install` → 실기기에서 사진 업로드·GPX·좌표·저장


### 📅 2026-08-04 (5차) — 안드로이드 마커 버그 수정 + 아이콘 웹과 통일

#### Fixed — 🐛 안드로이드에서 마커 핀이 안 보이고 숫자만 나오던 문제
- **원인**: 안드로이드는 마커 자식 View를 **비트맵으로 한 번 떠서** 지도에 얹는다.
  그 스냅샷이 이미지 디코딩보다 먼저 찍히면 핀은 비고 텍스트만 남는다.
  iOS는 뷰를 그대로 올리므로 **같은 코드에서 iOS만 정상**으로 보였다
- 두 겹으로 수정:
  1. `Image`에 `fadeDuration={0}` — 안드로이드 기본 페이드인(300ms) 중에 스냅샷이 찍히면
     투명한 이미지가 박힌다 (직접 원인)
  2. `tracksViewChanges`를 **마커별로** 자기 이미지 `onLoad`까지만 true로 유지
     → 기존엔 전역 타이머(700ms) 일괄 처리라 느린 마커가 타이밍을 놓쳤다
- 마커 1개 = `components/RouteMarker.tsx`로 분리 (MapScreen에서 전역 타이머 제거)

#### Added — `react-native-svg` 15.15.5 + `components/common/AppIcon.tsx`
- 웹 `components/common/AppIcon.vue`의 **path 데이터를 그대로 이식** (아이콘 27종).
  24x24 viewBox · stroke 1.8 · 둥근 끝/이음 — 규칙도 웹과 동일
- ⚠️ path는 웹과 같은 값을 유지할 것. 한쪽만 고치면 두 화면이 갈라진다
- 웹의 `currentColor` 대응이 RN에 없어 `color` prop으로 받는다 (미지정 시 테마 textPrimary)
- react-native-svg는 개념도 라인 그리기(P1)에도 필요해 어차피 들어올 의존성이었다

#### Fixed — 하단 탭에 아이콘이 없던 문제
- `MainTabNavigator.tsx`에 `tabBarIcon`이 아예 정의돼 있지 않아
  React Navigation 기본 도형이 4탭에 **똑같이** 그려지고 있었다 (`[TBD] 아이콘 라이브러리`)
- 웹 `BottomNavBar.vue`와 같은 SVG path 사용: 개념도(봉우리) / 지도(접힌 지도) /
  루트제보(문서+더하기) / 마이페이지(사람). 크기 23, 활성 굵기 2.1 — 웹과 동일
- 활성·비활성 색은 테마 토큰(`primary` / `textSecondary`) 사용.
  웹은 `#1573ee` / `#9aa0ac` 하드코딩이라 아주 미세하게 다르다 [TBD] 필요 시 토큰 추가

#### Changed — 남아 있던 이모지 제거 (웹은 이미 제거 완료)
| 위치 | 이전 | 이후 |
|---|---|---|
| 등반일지 카드 | `⏱ 🎒 👥` 텍스트 | `clock` / `backpack` / `users` 아이콘 |
| 개념도 상세 버튼 | `✎ 등반일지 쓰기` | `등반일지 쓰기` |
| 지도 선택 모달 | `✓` | `check` 아이콘 |

- `ProfileWithCrown.tsx`의 `👤`/`👑`은 **그대로 둔다** — 등급 제거로 v2 화면에서 미사용,
  보존 파일이라 건드리지 않는다

#### 검증
- `tsc --noEmit`: 신규 코드 에러 0 (react-native-svg 미설치 상태의 모듈 해석 1건 제외)
- ⏳ 미검증: `yarn install` → `pod install` → 양 플랫폼 실기기


### 📅 2026-08-04 (4차) — 지도 탭 구현 (웹 MapView.vue 이식)

> 플레이스홀더였던 지도 탭을 실화면으로 교체. **iOS·Android 동시 개발**(사용자 요청).

#### Added — `react-native-maps` 1.26.0
- ⚠️ **버전 고정 필수, 캐럿(`^`) 금지.** 1.26.1+는 New Architecture에 RN 0.81.1 이상을 요구하는데
  이 프로젝트는 RN 0.76.9다. 최신(1.29.x)을 넣으면 빌드가 깨진다
- 실측: **iOS·Android 양쪽 다 New Architecture로 동작 중**
  (iOS `Podfile.lock`에 `React-Fabric` pod, Android `newArchEnabled=true`)
  → `docs/09_RNFB_UPGRADE.md`의 "RN 0.76.9는 New Arch가 기본이 아니다" 서술은 사실과 다름 (별도 정정 필요)
- iOS는 **구글 지도로 고정**(기본값 애플 지도 → 웹·안드로이드와 달라 보임):
  `ios/Podfile`에 `pod 'react-native-maps/Google'`, `AppDelegate.mm`에 `[GMSServices provideAPIKey:]`
- Google Maps API 키 2개 발급 (Android/iOS 각각 앱 제한 + API 1개 제한).
  Firebase 자동 생성 키는 건드리지 않음

#### Added — 지도 탭 화면
```
src/screens/map/MapScreen.tsx              화면 조립
src/screens/map/hooks/useMapRoutes.ts      데이터·필터·클러스터링
src/screens/map/components/
  MapFilterBar / PickerModal / RouteMarkerView / RouteDetailSheet / ClusterListModal
src/constants/map.ts                       마커 실측 기하 + 지도 상수
src/assets/icons/{lead,bouldering}_marker.png   v1 Flutter에서 추출
```
- 마커 앵커는 **PNG 알파 실측 비율 그대로**. 웹은 픽셀로 환산했지만
  react-native-maps의 `anchor`는 0~1 비율을 받아 `{ x: 0.5, y: tipRatio }`로 변환 없이 쓴다
- 클러스터 숫자: 웹은 canvas로 이미지를 구워 마커 2개를 겹쳤지만, RN은 마커 안에 `<Text>`를
  넣어 **마커 1개**로 끝난다 → 양 플랫폼이 같은 코드로 같은 결과
- `Concept` 타입에 `latitude`/`longitude` 추가 (런타임엔 이미 들어오던 값, 선언만 누락돼 있었음).
  문서마다 숫자/문자열이 섞여 있어 `number | string` union + 사용 시 Number 변환

#### Changed — 웹과 다르게 간 부분 (사용자 승인)
| 항목 | 웹 | 앱 | 이유 |
|---|---|---|---|
| 데이터 | 타입 전환마다 `onSnapshot` 재구독 | `conceptService.fetchConcepts()` 캐시 재사용 | 개념도 탭과 캐시 공유, 칩 전환 즉시 반응 (산속 네트워크) |
| 등반지·구역 선택 | `<select>` | 자체 모달 `PickerModal` | RN에 대응 요소 없음. Picker 라이브러리는 iOS/Android UI가 완전히 달라 "양쪽이 같아 보여야 한다"와 충돌 |
| 위치 | `navigator.geolocation` | 지도의 `onUserLocationChange` | geolocation 라이브러리 추가 회피 (검증할 네이티브 표면 축소) |
| 마커 수 | 제한 없음 | `MAX_MARKERS = 400` | RN 마커는 각각 네이티브 뷰라 수천 개면 앱이 멈춘다. 상한 초과 시 안내 배너 표시 [QUESTION] 실기기 체감 후 조정 |

#### Fixed — 웹 RouteDetailDialog의 잘못된 필드명 (앱에서 정정)
- 웹은 `route.images / description / createdAt`을 읽는데 실제 필드는
  `imageUrls·imageUrl / overview / timestamp`다 → 웹 다이얼로그는 개요·등록일이 항상 비어 보인다
- 앱 `RouteDetailSheet`는 **실측 필드명**으로 제대로 표시한다 (웹도 별도 수정 필요)

#### 검증
- `tsc --noEmit`: 지도 관련 신규 코드 **에러 0** (react-native-maps 미설치 상태의 모듈 해석 2건 제외)
- ⏳ 미검증: `yarn install` → `pod install` → 양 플랫폼 실기기 동작
- ⚠️ `pod install`이 최대 위험 구간이다. 이 Podfile은 RNFB 때문에 `use_frameworks! :linkage => :static`을
  쓰는데 GoogleMaps 9.4.0 pod과 충돌할 수 있다. Podfile에 되돌리는 방법을 주석으로 남겨뒀다


### 📅 2026-08-04 (3차) — 🎉 iOS 실기기 빌드 성공 (5월부터 보류되던 트랙 해제)

#### Fixed — iOS 빌드
- Xcode Release 구성으로 **실기기 빌드·실행 성공**. 4탭 네비게이션 동작 확인
- `use_frameworks! :linkage => :static` 전환으로 인한 추가 에러 **없음**
  (react-native-screens / image-picker / safe-area-context 모두 정상)
- `docs/05_ROADMAP.md` Phase 1-2.5 보류 트랙 해제

#### Changed — iOS 번들 ID 변경 (사용자 승인)
- `com.yusungyun.RouteFinding` → **`com.yusung.routefinding`** (안드로이드 `applicationId`와 통일)
- 이유: 기존 ID가 **다른 Apple 팀에 선점**돼 있어 현재 개발 팀(YUMI KIM)으로 등록 불가.
  v1 iOS는 **App Store 미출시**라 잃을 사용자가 없어 변경 비용 0
- Firebase 프로젝트 `routefinding09-4b597`에 **iOS 앱 신규 등록** → 새 `GoogleService-Info.plist` 적용.
  기존 iOS 앱 항목은 삭제하지 않고 보존
- `GoogleService-Info.plist`는 `.gitignore` 대상이라 커밋되지 않는다.
  다른 맥에서 빌드하려면 Firebase 콘솔에서 재발급 필요

#### Fixed — `GoogleService-Info.plist` 경로 참조 (잠재 버그)
- `project.pbxproj`의 파일 참조에 `RouteFinding/` 폴더명이 빠져 있어
  `Build input file cannot be found` 발생. 다른 파일들은 모두 폴더명이 붙어 있었다
- §2 시도 #3의 `xcodeproj` gem 등록 시점부터 깨져 있었고, 이전 빌드는 더 앞 단계에서
  죽어 드러나지 않았다 → 파일을 `app/ios/GoogleService-Info.plist`로 이동해 해결

#### Added — 안드로이드 release APK 산출 확인
- `./gradlew assembleRelease` 성공 (2m 42s). `app-release.apk` **59MB**
  (debug 132MB 대비 절반 이하)
- `assets/index.android.bundle` **1.5MB 포함** → Metro 없이 단독 실행 가능 ✅
- ABI 4종(arm64-v8a / armeabi-v7a / x86 / x86_64) 모두 포함
- ⚠️ 여전히 **debug 키 서명**이라 사이드로딩 전용. 스토어 업로드 불가 (P2, `docs/08` §2-2)
- ⚠️ `applicationId`가 스토어의 v1과 같은 `com.yusung.routefinding`이라,
  v1이 설치된 기기에는 서명 불일치로 설치되지 않는다 → v1 삭제 후 설치할 것

#### 실기기 확인 결과 (iOS)
- 앱 실행, 하단 4탭 이동, 개념도·마이페이지 정상
- 지도 · 루트제보 = 플레이스홀더 (예정대로 Phase 2에서 구현)
- **하단 탭 아이콘이 없다** — `MainTabNavigator.tsx`에 `tabBarIcon` 미정의(`[TBD] 아이콘 라이브러리`).
  React Navigation 기본 도형이 4개 탭에 동일하게 표시된다. 웹은 이미
  `components/common/AppIcon.vue`(인라인 SVG 24종)로 이모지를 걷어낸 상태 → 앱도 맞춰야 함


### 📅 2026-08-04 (후속) — RNFB 25.1.0 업그레이드 + iOS Podfile 근본 정정

> **목적**: 보류 트랙이던 iOS 빌드 복구. `docs/09_RNFB_UPGRADE.md`의 조사 결론대로
> **25.1.0으로만** 올렸다(26은 New Architecture 필수라 RN 업그레이드와 묶어 별도 진행).

#### Changed — `@react-native-firebase/*` 24.0.0 → **25.1.0**
- 대상 6개: `app` / `auth` / `firestore` / `storage` / `messaging` / `app-check`
- `src/types/auth.ts` — `FirebaseAuthTypes.User` → 모듈러 `User` 타입 (2곳)
- `src/services/firebase.ts` — App Check provider를 모듈러 방식으로:
  `firebase.appCheck().newReactNativeFirebaseAppCheckProvider()`
  → `new ReactNativeFirebaseAppCheckProvider()`
- iOS App Check는 **`deviceCheck` 유지**. 현재 권장값인
  `appAttestWithDeviceCheckFallback`은 Firebase 콘솔에 App Attest 별도 등록이 필요해
  실기기 검증 후로 미룸 (`[TBD]` 주석으로 표시)
- Firestore/Storage 호출부는 처음부터 모듈러 API라 **수정 0건**

#### Fixed — iOS `pod install` 실패의 진짜 원인 규명
- 범인은 **`use_modular_headers!`** 였다. 1차 실패("Swift pods cannot yet be integrated
  as static libraries")를 넘기려 전역으로 켰는데, gRPC-Core의 헤더 배치와 맞지 않아
  `Pods/Headers/Private/grpc/gRPC-Core.modulemap not found`를 낳았다.
  **패치를 벗길 때마다 다음 불일치가 드러나던 "양파 까기"의 근원.** Xcode 26 자체의 문제가 아니었다
- `ios/Podfile` — `use_modular_headers!` 제거 → RNFB 공식 권장인 **static framework 링크**로 전환
  (`$RNFirebaseAsStaticFramework = true` + `use_frameworks! :linkage => :static`,
   `USE_FRAMEWORKS` 환경변수로 재정의 가능)
- gRPC 3타깃(`gRPC-C++`/`gRPC-Core`/`BoringSSL-GRPC`)의 `CLANG_ENABLE_EXPLICIT_MODULES=NO`
  **post_install 패치 전량 제거**
- ✅ `pod install --repo-update` 통과 — firebase-ios-sdk **12.15.0**, gRPC-C++ 1.69.0
- `project.pbxproj` — 링크 산출물이 `libPods-*.a`(static library) → `Pods_*.framework`로 자동 갱신
- `PrivacyInfo.xcprivacy` — 파일 타임스탬프 API 사유 `3B52.1` 추가(pod install 갱신분)

#### Docs
- `docs/06_iOS_BUILD_NOTES.md` — §2에 **4~7차 시도 이력**과 원인 규명 추가
- `docs/09_RNFB_UPGRADE.md` — 신규. "왜 25이고 26이 아닌가" 판단 근거와 실행 순서
- `docs/08_DEPLOY.md` — §3이 아직 "26으로 올려라"로 남아 있어 **25 결정에 맞게 정정**,
  §2-1의 지도 SDK `[TBD]`도 Google Maps 결정 반영, §1에 Firebase CLI 계정 함정 추가

#### 검증
- `tsc --noEmit` 0 error / `eslint` 0 error
- ✅ 안드로이드 실기기 실행 정상 (업그레이드 후에도 깨지지 않음)
- ⏳ **미검증: iOS Xcode 실기기 빌드.** `use_frameworks!`는 *모든* pod의 링크 방식을 바꾸므로
  `react-native-screens` / `image-picker` / `safe-area-context`에서 새 에러가 날 수 있다.
  실패 시 **임의 패치 금지** — 에러 원문을 `docs/06_iOS_BUILD_NOTES.md` §2 표에 누적 기록할 것


### 📅 2026-08-04 — 앱 단순화 + 마이페이지 개편 + 등반일지 신규

#### Changed — 4탭 체제로 축소 (웹·앱 공통)
- 유지: **개념도 / 지도 / 루트제보 / 마이페이지**. 제거: 홈 · 게시판 · 크루
- 화면 **파일은 보존**하고 라우팅만 해제 (되돌리기 쉽도록). 기존 URL은 `/map`으로 리다이렉트
- 로그인 후 첫 화면 = 지도
- 앱: `ReportListScreen`을 '루트제보' 탭으로 승격(기존엔 탭 없음)
- 제거된 라우트 타입은 남겨둠 — 보존한 화면 파일이 참조하므로 지우면 타입체크가 깨진다

#### Changed — 마이페이지 등급/포인트 전면 제거
- 등급(Level) · 다음 등급까지 남은 점수 · 포인트(Point) 표시 제거
- `ProfileWithCrown`(왕관 + 등급 테두리) → 신규 `Avatar`(단순 원형)로 교체
  (마이프로필 · 프로필 헤더 · 제보 카드). ProfileWithCrown 파일은 보존
- 웹 '내 게시글/댓글 프로필 일괄 갱신' 버튼 제거 (게시판이 빠짐)
- `users.level` / `users.point`는 **Firestore에 그대로 둔다** — 타입에 `@deprecated`만 표시

#### Added — 프로필 사진 변경 (앱)
- `react-native-image-picker` 도입 + `services/profilePhoto.ts`
- 경로는 웹과 동일 `profile_photos/{uid}.jpg`, 512x512로 리사이즈 후 업로드
  (2026-08-03 Storage 한도 초과 경험 반영)

#### Added — 등반일지 (신규 기능, 웹·앱)
- 새 컬렉션 `users/{uid}/climbing_logs` — **날짜별 1건**
  (같은 루트 재방문이 많아 루트당 1건인 `my_routes`로는 불가)
- 필드는 사용자 스프레드시트와 1:1: 날짜(+종료일) / 장소 / 루트명 / 소요장비 /
  등반 소요시간 / 참석자 / 등반내용 및 특이사항
- 마이페이지 'MY ROUTE' 탭 → **'등반일지' 탭**으로 대체 (검색 + 작성/수정/삭제)
- 개념도 목록의 ✎ 버튼 / 상세의 '등반일지 쓰기' 버튼 → 장소·루트명 자동 입력
- 즐겨찾기(★, `my_routes`)는 개념도에 그대로 유지
- 앱: 날짜는 `YYYY-MM-DD` 텍스트 입력 (date picker 의존성 추가 회피, [TBD])

#### Added — iOS 사전 준비 (빌드는 여전히 보류 트랙)
- `ios/RouteFinding/Info.plist`
  - `NSLocationWhenInUseUsageDescription` **값이 빈 문자열**이던 것을 실제 문구로 채움
    (빈 값은 App Store 심사 거부 사유)
  - `NSPhotoLibraryUsageDescription` 추가 — 없으면 image-picker 사용 시 iOS에서 크래시
- `docs/06_iOS_BUILD_NOTES.md`
  - **§0 재시도 트리거 충족 기록**: RNFB 24.0.0 → 최신 **26.1.0**(2026-08-03 릴리스).
    보류 사유였던 "생태계가 Xcode 26.x를 지원해야 함" 조건이 해소됐을 가능성이 높다.
    단 메이저 2단계 업그레이드라 breaking change 확인 필수 — **임의 업그레이드 금지**
  - **§0-1 v2 리뉴얼 반영분 체크리스트** 신설: Android 전용으로 쌓인 변경 중
    iOS에서만 문제될 수 있는 항목(pod install 재실행, 사진 업로드 URI, 키보드 회피,
    날짜 입력 등) 정리
- 확인만 하고 손대지 않은 것: `GoogleService-Info.plist`(Android와 동일 프로젝트 ✅),
  AppDelegate `[FIRApp configure]` ✅, App Check DeviceCheck 분기 ✅

#### Added — 루트제보 좌표 입력 개선 (웹)
- 위도/경도 칸에 **[📍 현재위치] · [🗺 지도에서 선택]** 버튼 배치
  (지도 선택 기능은 원래 있었으나 화면 위쪽에 떨어져 있고 안내문구가
   "어프로치 기록시 자동입력"이라 못 쓰는 것처럼 보였다)
- **어프로치 실시간 기록 섹션 제거**, GPX 파일 업로드는 유지(사용자 결정)
- 좌표를 지워버리던 `watch(trackingPath, ..., {immediate:true})` 제거

#### Added — 개념도 사진 등록 + 라인 그리기 (웹)
- 새 컬렉션 `concept_photos` — 사진 + 라인/텍스트를 **좌표(0~1 정규화)로 저장**.
  원본 사진은 손대지 않아 나중에 선만 고치거나 지울 수 있다
- `components/ConceptPhotoOverlay.vue` — 읽기전용 SVG 오버레이.
  ResizeObserver로 컨테이너를 재서 썸네일/전체화면 어디서든 정확히 겹쳐 그린다
- `components/ConceptPhotoEditor.vue` — 촬영(`capture="environment"`)/첨부 →
  펜·텍스트·기본색 6종·되돌리기·전체지우기 → 저장
- 개념도 **목록 카드에 📷 버튼**, **상세에 '📷 사진 등록' 버튼**
- 승인 흐름: 등록 시 `pending` → 승인 전에는 **본인과 관리자만 조회**(보안 규칙이 보장) →
  관리자가 **승인·추가 / 승인·기존 교체 / 반려** 선택. 본인은 승인 전까지 삭제 가능
- Storage 경로는 기존 규칙(`route_images/{산}/{구역}/{루트}/{파일}`)에 맞춰
  storage.rules 변경 불필요

#### 🚨 배포 필요 — 사용자 조치
- `firestore.rules`에 `users/{userId}/climbing_logs` 규칙을 추가했다. **배포 전에는 저장이 거부된다.**
  ```
  firebase deploy --only firestore:rules
  ```
- `firestore.rules`에 `concept_photos` 규칙도 추가했다(2026-08-04 2차). 같은 명령으로 함께 배포된다.

#### 검증
- `tsc --noEmit` 0 error / `eslint` 0 error(경고 23, 기존 컨벤션 범위)
- 웹 SFC 컴파일 6개 파일 통과
- ⏳ 미검증: 에뮬레이터 런타임, 웹 등반일지 저장(규칙 배포 후)


### 📅 2026-08-03 — 개념도 리뉴얼 1단계: "찾아서 보기"

> **방향 결정(사용자)**: 개념도를 **단순하게** 재설계.
> 1단계 = 기존 개념도 찾아서 보기 / 2단계(P1) = 개념도 추가 + 사진 위 라인 그리기 + 사용자 간 공유.
> 적용 범위: **RN 앱 v2 + 웹 동시**. 데이터는 **기존 컬렉션 그대로**(스키마 변경 0).

#### Added — RN 앱 (`app/src`)
- `types/concept.ts` — 개념도 모델 + 표시 헬퍼(`conceptImages`/`conceptTitle`/`conceptLengthLabel`/`conceptSearchIndex`)
- `services/conceptService.ts` — `route_reports`+`bouldering_reports`의 `status=='approved'` 병합 조회.
  단일 where만 사용(복합 색인 불필요) / 5분 TTL 캐시 / `Promise.allSettled`로 **부분 실패 허용**
- `screens/route/hooks/useConcepts.ts` — 로딩·새로고침·검색(공백 AND 토큰)·타입 칩 상태
- `screens/route/ConceptListScreen.tsx` — 플레이스홀더 → **실화면**. 검색 한 줄 + 전체 리스트 + 당겨서 새로고침
- `screens/route/components/ConceptCard.tsx` — 썸네일 + "등반지 · 구역 · 루트명" + 타입/난이도/길이
- `screens/route/ConceptDetailScreen.tsx` — 사진 캐러셀 + 기본정보 + 피치 목록 (`source` 미지정 시 두 컬렉션 순차 시도 = 딥링크 대비)
- `screens/route/components/ConceptImageViewer.tsx` — 전체화면 뷰어(가로 스와이프, RN 빌트인 Modal — 외부 lib 0)

#### Changed
- `navigation/types.ts` — `ConceptDetail: { conceptId, source? }` 라우트 추가
- `navigation/MainNavigator.tsx` — `ConceptDetail` 플레이스홀더 → 실화면 등록
- 웹 `src/views/ConceptListView.vue` — **4단계(칩→등반지→구역→검색) → 1단계(검색 한 줄)** 로 단순화.
  두 컬렉션 병합 로드 + 클라이언트 필터. 즐겨찾기/관리자 수정·삭제/이미지 뷰어/지도 클러스터 진입(`?ids=`)은 유지

#### Docs
- `docs/02_DATA_MODEL.md` — §6에 **실측 정정** 추가: 화면상의 "개념도"는 `concepts/{mountain}/routes`가 아니라
  `route_reports`/`bouldering_reports`를 읽는다 (+ `pitches` 배열 필드 vs 서브컬렉션 구분)
- `docs/04_WIREFRAMES.md` — 개념도 매핑 상태 ⏳ → ✅, 상세 화면 행 추가

#### Fixed / Changed — 실데이터 검증 후 정책 변경 (같은 날 후속)

> **실측**: 승인 루트가 **5,407건**. "50명 사용자 = 데이터도 작다"는 전제가 틀렸다.
> 웹에서 전량 렌더 시 이미지 요청이 동시에 5천 건 발생 → 브라우저가 감당 못해
> 썸네일이 전부 `@error` → `display:none` 으로 사라지는 증상 확인(사용자 스크린샷).

- **웹 `ConceptListView.vue`**
  - 전량 렌더 → **30개씩 무한 스크롤**(IntersectionObserver, rootMargin 600px)
  - `<img loading="lazy" decoding="async">` 추가
  - 이미지 로드 실패 시 `style.display='none'`(빈 회색 박스) → **'이미지 없음' 자리표시**로 대체
- **검색 전 목록 비노출** (사용자 결정): 검색어가 없으면 목록을 그리지 않고
  **Firestore 조회 자체를 첫 검색까지 지연** → 탭 진입만으로 발생하던 읽기 5,407회 → **0회**
  - 검색 전 화면: 안내 문구 + 예시 칩(북한산/인수봉/파주/무의도)
  - 지도 클러스터 진입(`?ids=`)은 예외로 검색 없이 즉시 표시(읽기 최대 10건)
- **RN `useConcepts.ts` / `ConceptListScreen.tsx`** — 동일 정책 적용.
  `startedRef` 가드로 첫 검색 시 1회만 로드, FlatList `initialNumToRender=10`/`windowSize=7`

#### 🚨 [QUESTION] — 사용자 확인 필요
1. **`firestore.rules`에 `bouldering_reports` 규칙 없음** → §9 전면 차단에 걸려 볼더링 조회가 실패할 수 있음.
   클라이언트는 방어했으나 규칙 추가는 별도 PR + 승인 필요.
2. 리뉴얼 2단계(사진 위 라인 그리기)용 라인 좌표 저장 위치·제스처 라이브러리 = 아직 [TBD].

#### 검증
- `tsc --noEmit` 통과(0 error) / `eslint` 0 error(경고 5, 기존 컨벤션 범위)
- 웹 `ConceptListView.vue` SFC 컴파일 검증 통과
- ⏳ **미검증**: 에뮬레이터 런타임 시각 검증 (다음 세션 첫 작업)

### 📅 2026-05-20 세션 종합

> **하루 성과**: Sprint 2-1 핵심 본문 4개 탭 완료 + ⑤ MyProfileTab [D] intro 편집. Sprint 2-1 진행도 **~80%**(잔여: [F] 사진 업로드, [E] 동기화 분석, ⑥ HomeScreen 부가, ⑦ UserProfile).
> 세션 작업 커밋 **5개**(+ 세션 종료 docs 커밋 1 = 6), 브랜치 `v2`: `bbe3fd0 → c8e3132`.

- **2-1-2 탭 본문 4종 완료** (모두 v1 1:1):
  1. `MyPostsTab` — posts where userId .snapshots() + UnreadBadge(N+1) — `5020b3c`
  2. `MyCommentsTab` — collectionGroup('comments') + PostTitle(N+1) + postId=ref.parent.parent.id — `6f4df3e`
  3. `MyReportsTab` — 두 컬렉션 머지(route_reports+bouldering_reports) + approved 제외 + timestamp desc + 권한별 액션 + `PromptModal`(공용) — `60716c9`
  4. `MyRouteTab` — users/{uid}/my_routes orderBy savedAt desc + 검색 + routeRef deref(N+1) + 삭제된 루트 처리 — `19a752a`
- **⑤ MyProfileTab [D] intro 편집** 완료 (`c8e3132`): 읽기전용 필드+등급+"다음 등급까지 N점"(`levelCalculator.ts` 1:1 포팅) + intro TextInput+저장.
- **공용 신규**: `PromptModal`(RN 빌트인 Modal, 외부 lib 0), `UnreadBadge`(MyPosts/MyComments 공용 추출)
- **신규 타입**: `post`/`notification`/`comment`/`report`/`myRoute` (전부 v1 실측 필드명)
- **02_DATA_MODEL 인라인 정정 6건**(스키마 불변, docs만): `posts.timestamp`·`notifications.{checked,postId,commentId,reportId,crewId}`·`comments.{text,timestamp,photoUrl}`·`route_reports.rejectionReason`+status'draft'·`my_routes.{savedAt,routeRef}`
- **🔍 자기진단·정정 1건**: 사용자 [B] 닉네임/[C] 등급 변경 작업 요청이 **v1엔 없는 기능**임을 분석 중 발견(my_profile_tab은 read-only) → 멈춤·보고·옵션 A로 정정(MVP 1:1 보존 강화)
- **🧅 양파 까기 0건** — 5/19(4건) 대비 큰 진전. typecheck+빌드 게이트 신뢰성 확립 + v1 코드 사전 정밀 분석 효과
- **검증 모드 전환**: 각 탭마다 시각 검증 → 일괄 모드(typecheck+빌드 게이트만 통과 시 진행). 5/19 누적 검증으로 게이트 신뢰성 입증됨
- **다음 세션 첫 작업**: 일괄 시각 검증 → ⑤[F] 사진 업로드(양파 위험 구간, 보고 후 신중 진행)

### 📅 2026-05-19 세션 종합

> **하루 성과**: Phase 0 마무리 → **Phase 1 (Android) 완료 + 런타임 검증** → Phase 2-1 진행분.
> 세션 작업 커밋 **11개**(+ 세션 종료 docs 커밋 1 = 12), 브랜치 `v2`: `8bcbaaa → 8d837a9`.

- **Phase 1 완료(Android 기준)**: RN 0.76.9 초기화 → Firebase(Android) → 네비(RNav7) → 상태관리(Zustand) → 디자인 시스템(하이브리드) → 인증 화면(v1 1:1 이메일 게이트). 에뮬레이터 런타임 검증 통과.
- **Phase 2-1 진행분**: 네비 정정 + 스키마 정정 + ProfileWithCrown + MyPage 갓파일 분해 착수.
- **🔍 자기진단·정정 패턴**:
  - **4→5탭 정정**: Phase 1-3 탭 구조를 미사용 dead code(`bottom_nav_bar.dart`) 근거로 잘못 구현 → v1 실제(`home_screen.dart` 5탭) 발견·정정·이력 기록.
  - 스키마 타입 오류 정정(`photoUrl`/`level:string`/`intro`), `bouldering_reports` 미문서화 발견·보강.
- **🧅 "양파 까기"/이슈 해결 4건**(추측 패치 금지, 멈춤·보고 원칙 준수):
  1. yarn Berry/홈 설정 충돌 → Berry 3.6.4 통일
  2. iOS Xcode 26.3 ↔ gRPC (ScanDependencies→_stdio.h→modulemap) → **iOS 보류 트랙**(`06_iOS_BUILD_NOTES.md`)
  3. RN 0.76 ↔ react-native-screens 4.25 codegen → 4.4.0 핀
  4. async-storage 3.x Android 빌드 실패 → 제거(결정 A 일관)
  5. (보너스) Notifee 빨간화면 = 의존성 무관, 좀비 Metro 스테일 번들 → 포트 정리
- **결정 확정**: 패키지명(기존 유지)·RN 0.76.9·Node 20·yarn Berry·Zustand·디자인토큰(하이브리드)·이미지피커(react-native-image-picker, 미설치)·App Check(Play Integrity/DeviceCheck+debug).
- **별도 트랙/연기**: iOS 빌드(1-2.5), FCM(Phase 3), 영상 스플래시·top-tab 라이브러리·아이콘 라이브러리([TBD]).

### 📁 문서

#### Added
- `README.md` 작성 (RideTalk 패턴 채택)
- `CLAUDE.md` 작성 (Claude Code 작업 컨벤션)
- `docs/01_MVP_SPEC.md` 작성 (기존 Flutter 기능 = MVP)
- `docs/02_DATA_MODEL.md` 작성 (Firestore 모델, 기존 구조 유지)
- `docs/03_TECH_STACK.md` 작성 (RN + Firebase 스택)
- `docs/04_WIREFRAMES.md` 작성 (Flutter → RN 매핑표)
- `docs/05_ROADMAP.md` 작성 (5 Phase 마이그레이션 계획)
- `GETTING_STARTED.md` 작성 (개발 환경 셋업 가이드)
- `CHANGELOG.md` 작성 (이 파일)

### 🏗️ 코드 / 셋업 (Phase 1 — 2026-05-19)

#### Added
- `app/` 에 **React Native 0.76.9** 프로젝트 초기화 (`@react-native-community/cli`, TypeScript 템플릿)
  - 앱명 `RouteFinding` → iOS `RouteFinding.xcworkspace` (GETTING_STARTED.md와 일치)
  - 의존성 설치 완료 (yarn Berry, `node_modules` 생성)
  - `package.json`에 `typecheck`(tsc --noEmit), `clean`(react-native clean) 스크립트 추가
- `app/package.json`에 `packageManager: yarn@3.6.4` 핀
- 개발 환경 결정 확정: Node 20.x LTS(v20.20.2, nvm), RN 0.76.9, yarn Berry 3.6.4
- **`app/src/` 폴더 구조 생성** — `03_TECH_STACK.md` 확정 구조 그대로 27개 디렉터리, 각 폴더에 `.gitkeep` + 용도 설명 `README.md`
  - `App.tsx` → `src/App.tsx` 이동, `index.js`·`__tests__/App.test.tsx` import 경로 갱신
  - 타입체크(`yarn typecheck`) 통과 확인

#### Removed
- 루트의 v1 잔재 파일 git 추적 제거 (전량 `~/Backups/routefinding-data/`에 백업됨)
  - `bouldering_data.csv`, `routes.json`, `approach.gpx` — 일반 루트/샘플 시드 데이터 (v2는 Firestore가 원천, NFC 원천 `*_nfc.csv` 아님)
  - 루트 `package.json`, `package-lock.json` — RN 앱은 `app/`로 이동되어 루트 툴링 불필요
  - 판별 결과 NFC 원천 파일 없음 → `docs/data-archive/` 보존 불필요

### 🔥 Firebase 연결 (Phase 1-2 — 2026-05-19)

#### Added
- `@react-native-firebase/{app,auth,firestore,storage,messaging,app-check}` **v24.0.0** 설치
- `google-services.json`(Android) / `GoogleService-Info.plist`(iOS) 배치 (`.gitignore`로 추적 제외 확인)
- Android Gradle 연동: `android/build.gradle`에 `com.google.gms:google-services:4.4.2` classpath, `android/app/build.gradle`에 플러그인 적용
- iOS `AppDelegate.mm`에 `[FIRApp configure]` 추가 (기본 앱 초기화)
- `app/src/services/firebase.ts` 작성 — 모듈러 인스턴스(auth/db/storage/messaging) export + `initAppCheck()`
  - App Check provider: Android=Play Integrity / iOS=DeviceCheck (배포), 개발 빌드는 debug provider (docs/02_DATA_MODEL.md 명세 준수)
- `App.tsx`에서 부팅 시 `initAppCheck()` 호출
- ✅ **Android 빌드 검증 성공** (`./gradlew :app:assembleDebug` — RNFB 6개 모듈 컴파일, APK 생성)

#### iOS 후속
- [x] iOS `pod install` 해결 — Podfile에 `use_modular_headers!` 추가 (사용자 결정, 72 deps/97 pods 설치 완료)
- [x] `GoogleService-Info.plist` Xcode 프로젝트 등록 — `xcodeproj` gem으로 RouteFinding 타깃 Resources에 추가
- [x] iOS 빌드 1차 실패(`gRPC-C++` ScanDependencies) → Podfile post_install 패치(gRPC explicit modules off, 사용자 결정 A) 적용 → gRPC 에러 해소
- [x] 2차 실패(`_stdio.h`) → 패치 최소화(Option 1: `CLANG_ENABLE_MODULES=NO` 제거, `CLANG_ENABLE_EXPLICIT_MODULES=NO`만 유지) → `_stdio.h` 에러 완전 해소(원인 검증됨)
- [x] 3차 실패 — `fatal error: module map file '.../grpc/gRPC-Core.modulemap' not found`

#### 결정: iOS 빌드 보류, Android 우선 진행 (2026-05-19)
- **사유**:
  - 에러가 양파 까기 패턴(gRPC ScanDependencies → `_stdio.h` → modulemap → …) — 근본 원인은 **Xcode 26.3 (Build 17C529) / iPhoneSimulator 26.2 SDK가 bleeding-edge**, firebase-ios-sdk 12.10.0 / gRPC 생태계 미추격
  - Phase 1 나머지(네비게이션·상태관리·인증 화면·디자인 시스템)는 **OS 무관** → Android로 검증·코드 작성 가능
  - 시간 효율: 지금 1~2시간 디버깅 vs 1~2주 후 RNFB/firebase-ios-sdk 새 버전 + 재시도 5분
- **재검증 트리거**: `@react-native-firebase/*` 또는 `firebase-ios-sdk`(gRPC 포함) 새 메이저/마이너 출시 시, 또는 Xcode 26.x 호환 픽스 공지 시
- iOS 빌드 별도 트랙 문서화 → `docs/06_iOS_BUILD_NOTES.md`
- 현 시점 Android는 빌드 검증 ✅ 완료, Phase 1-2는 **Android 기준 완료**로 간주

#### Changed
- **번들 ID를 기존 v1 그대로 유지하도록 네이티브 프로젝트 수정**
  - Android: `namespace`/`applicationId`/Java 패키지 → `com.yusung.routefinding` (전체 리네임)
  - iOS: 앱 타깃 `PRODUCT_BUNDLE_IDENTIFIER` → `com.yusungyun.RouteFinding`, 테스트 타깃 → `com.yusungyun.RouteFinding.tests`
  - 사유: 기존 Firebase 앱·50명 유저 무중단 전환
- **패키지 매니저: yarn classic 1.22 계획 → yarn Berry 3.6.4 채택**
  - 사유: 시스템 환경이 이미 Berry로 통일됨(다른 Vue/Firebase 프로젝트), classic yarn deprecated, 매번 `YARN_IGNORE_PATH=1` 우회 부담 제거, 모던 기준
  - 관련 docs(`03_TECH_STACK.md`, `GETTING_STARTED.md`)를 yarn 3.x(Berry) 기준으로 갱신

### 🧭 네비게이션 (Phase 1-3 — 2026-05-19)

#### Added
- React Navigation **v7** 설치 (`@react-navigation/native` 7.2.4, `native-stack` 7.15.1, `bottom-tabs` 7.16.1) + `react-native-screens` 4.4.0(핀), `react-native-safe-area-context` 4.14.1(핀)
- `src/navigation/` 골격: `types.ts`(타입 안전 param, 딥링크 대비 id), `AuthNavigator`, `MainTabNavigator`(v1 4탭), `MainNavigator`(push/modal), `RootNavigator`(인증 분기), `useAuthGate`(스텁)
- 플레이스홀더 화면: auth 3종 + 탭 4종(Board/Concept/ReportList/MyPage) + 공통 `PlaceholderScreen`
- `App.tsx` → NavigationContainer + SafeAreaProvider + RootNavigator (RN 템플릿 화면 제거)
- ✅ typecheck 통과, ✅ **Android `assembleDebug` 빌드 성공**

#### Changed
- 하단 탭 **5탭 가정 → v1 실측 4탭으로 정정** (게시판/개념도/지도/마이페이지). `git show main:lib/bottom_nav_bar.dart` 근거. `docs/04_WIREFRAMES.md` 네비게이션 섹션·매핑표 정정 (CLAUDE.md 1:1 보존)
- 딥링크: param 타입만 대비(구조), 실제 linking·FCM은 Phase 3 (사용자 결정)

#### Fixed
- `react-native-screens@4.25.1`(yarn add 기본 최신) ↔ RN 0.76.9 codegen 불일치(`Unknown prop type "accessibilityContainerViewIsModal"`) → 4.4.0 핀으로 해결 (RNav7 peer `>=4.0.0` 충족). safe-area-context도 4.14.1로 정렬

### 🗃️ 상태관리 (Phase 1-4 — 2026-05-19)

#### Added
- **Zustand 5.0.x** 설치·확정 (`[TBD] 상태관리` 해소 — 단독개발+50명 규모 적합, 보일러플레이트 적음)
- `src/stores/authStore.ts` — Firebase Auth 연동(modular). `initialize()`=`onAuthStateChanged` 구독, `signIn/signUp/signOut`. **persist 없음**(결정 A: Firebase 네이티브 세션이 단일 출처, v1 자동로그인 동등)
- `src/stores/userStore.ts` — `users/{uid}` 프로필 `fetchProfile/updateProfile/clear` (modular Firestore)
- `src/types/user.ts`(02_DATA_MODEL User 스키마), `src/types/auth.ts`(AuthUser)
- `src/constants/firestoreFields.ts` — COLLECTIONS/SUBCOLLECTIONS 상수 (P0, 02_DATA_MODEL 명명규칙)
- `useAuthGate`를 스텁 → authStore 실연동, `RootNavigator`가 `isInitializing` 동안 Splash 표시
- `App.tsx`에서 `initialize()` 1회 호출(+언마운트 해제)
- ✅ typecheck 통과, ✅ Android `assembleDebug` 성공

#### 변경 사유 / 메모
- `initialize()` 호출 위치: 요청은 "Splash에서"였으나 Splash는 **인증 시 마운트되지 않아** 자동로그인이 깨짐 → 앱 전역(`App.tsx`)에서 호출하도록 정정(정확성). Splash는 `isInitializing` 동안 표시되는 역할 유지
- `signUp`의 프로필 문서(`users/{uid}`) 생성은 Phase 2 SignUp 화면 + userStore에서 (현재 범위는 인증 골격)

#### Removed
- `@react-native-async-storage/async-storage` 제거 — **Phase 1-4 결정 A(persist 안 함)에 따라 미사용**. 설치된 3.0.2가 RN 0.76 셋업에서 `storage-android:1.0.0` 미해소로 Android 빌드 실패시킴. userStore 캐시 등 향후 필요 시 **RN 0.76 호환 2.x로 재도입 예정**

### 🎨 디자인 시스템 (Phase 1-6 — 2026-05-19)

#### Added
- **하이브리드 디자인 시스템 확정** (`[TBD] 디자인 토큰` 해소): v1 색상값 보존 + M3 스타일 토큰 구조
- v1 색상 분석 (`git grep main`): `ThemeData(primarySwatch: Colors.blue)` + Material 표준 + 등급 메달(gold/silver/bronze) 추출
- `src/theme/`: `colors.ts`(light + dark placeholder, v1 실측값), `typography.ts`(시스템 폰트, M3 스케일), `spacing.ts`(4배수), `radius.ts`, `index.ts`(`useTheme` 훅 — useColorScheme 기반 light/dark 선택)
- 공통 컴포넌트: `Text`(variant/color), `Button`(primary/secondary/ghost × sm/md/lg, loading/disabled), `Input`(label/error/비번토글), `Screen`(SafeArea+배경)
- `PlaceholderScreen`을 토큰 사용 레퍼런스로 리팩터(하드코딩 제거)
- ✅ typecheck 통과, ✅ Android `assembleDebug` 성공

#### 결정 / 메모
- secondary = `#448AFF`(blueAccent, 브랜드 파랑 일관성), purple은 `accent.purple`(#9C27B0) 별도 슬롯 (사용자 조정)
- 폰트: 시스템 기본(v1 동일, 별도 폰트 미도입). 다크모드: 구조만(placeholder), 실제 토글은 Phase 5
- 등급 메달·트래킹 속도색은 별도 의미 슬롯으로 v1 UX 정확 보존

### 🔐 인증 화면 (Phase 1-5 — 2026-05-19)

#### Added
- `SplashScreen` 정적 구현 (로고/태그라인/인디케이터). 자동로그인 체크는 `authStore.initialize()`가 담당. 영상 스플래시는 v2.1+
- `LoginScreen` — 이메일/비밀번호 + `authStore.signIn`, v1 에러 코드 매핑, **이메일 인증 게이트** 차단 시 재발송 다이얼로그(RN Alert)
- `SignUpScreen` — 닉네임 **중복확인 버튼**(v1 방식) + 이메일/비밀번호 → `authStore.signUp`
- `authStore`: **Option A 게이트 패턴** — `gatePassed` + `signingIn` 가드. v1 1:1: `!emailVerified && !isOldUser && !isAdmin` 차단, `isOldUser`=createdAt<2025-05-01 05:00 UTC(없으면 true), `signUp`=계정+displayName+`users/{uid}` 문서+인증메일+signOut(자동로그인 안 함)
- `userStore`: `isNicknameAvailable`(nickname 쿼리), `createProfile`(v1 동일 필드 `nickname/email/createdAt`)
- `constants/admin.ts`: `ADMIN_EMAILS=['yusung790926@gmail.com']` + `EMAIL_VERIFICATION_CUTOFF` (TODO Phase 2-5 Custom Claims 이전)
- `types/auth.ts`: `EmailNotVerifiedError`(resend 클로저)
- `AuthNavigator` Login↔SignUp 정리(Splash는 RootNavigator가 isInitializing 중 렌더), `useAuthGate`=`isAuthenticated && gatePassed`
- ✅ typecheck 통과, ✅ Android `assembleDebug` 성공

#### 의도적 이탈 (사용자 승인, v1과 다름)
- `last_email` 자동입력 생략 (결정 A·async-storage 미사용, userStore 캐시 도입 시 재검토)
- 로그인/스플래시 FCM 토큰 저장 → Phase 3 (messaging 미설치)
- 영상 스플래시·이미지 피커 제외 (MVP)
- 인증 다이얼로그: v1 `AlertDialog`(상시·로딩) → RN `Alert`(재발송 후 결과 Alert) — 기능 동등, 커스텀 모달/추가 의존성 회피

### ✅ Phase 1 런타임 검증 (2026-05-19)

- Android 에뮬레이터 런타임 검증 통과: Splash→Login, 회원가입+이메일인증 게이트, 로그인→MainTabs, 4탭, 디자인 토큰. (선택 항목 탭전환·자동로그인 복원은 추후 확인)
- **Phase 1 (1-1~1-6) Android 기준 100% 완료** (기능+런타임). iOS 빌드는 `docs/06_iOS_BUILD_NOTES.md` 보류 트랙 유지
- 검증 보고서·교훈 → `docs/07_RUNTIME_VERIFICATION.md` 신규
- 🐞 교훈: Notifee "native module not found"는 **의존성 문제 아님**(notifee 트리에 부재) — 좀비 Metro(포트 8081)의 스테일 번들. 클린 절차 1순위 = `lsof -ti:8081 | xargs kill -9`

### 🧭 Phase 2-1 ① 네비게이션 5탭 정정 (2026-05-19)

#### Fixed
- **하단 탭 4→5 정정 (Phase 1-3 오류 정정)**: Phase 1-3은 미사용 dead code `lib/bottom_nav_bar.dart`(4탭)를 근거로 4탭 구현. v1 실제 진입 화면 `lib/home_screen.dart`(IndexedStack 5탭) 분석 결과 정정 — **게시판/개념도/루트 위치/크루/마이페이지** (CLAUDE.md 1:1 보존)
  - `MapTab`: 잘못된 `ReportListScreen` → `MapScreen`(v1 idx2 루트 위치)으로 수정
  - `CrewTab` 추가(v1 idx3 CrewMainScreen), `CrewMain`은 push에서 탭으로 이동
  - `types.ts` MainTabParamList 5탭, `MainTabNavigator` 재작성, `MainNavigator`에서 CrewMain push 제거
  - 신규 placeholder: `screens/map/MapScreen.tsx`, `screens/crew/CrewMainScreen.tsx`
- 04_WIREFRAMES.md 네비 섹션·매핑표 재정정 + **탭 구조 정정 이력**(5가정→4(dead code 오판)→5확정) 명시
- HomeScreen 부가기능 분리 계획 명시: 출석보상(Phase 2-1 별도 P1) / 업데이트체크(Phase 3+) / AdMob(Phase 4) / `_tabHistory`·`initialIndex`(1:1 TODO)
- ✅ typecheck, ✅ Android `assembleDebug`

### 🗄️ Phase 2-1 ② 스키마 타입/문서 정정 (2026-05-19)

#### Fixed
- `types/user.ts` 실제 v1 필드명에 맞춤 (Firestore 구조 불변): `profileImageUrl`→**`photoUrl`**, `level: number`→**`level: string`**(등반등급 "5.15"~"5.6"), **`intro`** 추가. `UserProfileUpdate`도 동기화
- `02_DATA_MODEL.md`: User 스키마 정정 + **`[QUESTION] level` 해소**(등반등급 문자열 확정) + 컬렉션 트리/규칙 주석 `photoUrl` 반영
- `02_DATA_MODEL.md`에 **`bouldering_reports`** 컬렉션 신규 문서화(§5-1, 인공벽/볼더링 제보 — v1에서 사용 중이나 기존 문서 누락분, 실 스키마는 [TBD])
- ✅ typecheck, ✅ Android `assembleDebug` (영향: types 전용, userStore 호환)

### 👑 Phase 2-1 ③ ProfileWithCrown (2026-05-19)

#### Added
- `theme/colors.ts`에 **`grade` 맵 + `gradeDefault`** 추가 — v1 `_levelBorderColor` 10단계 1:1 (gold/silver/bronze=medal 재사용, purple=accent 재사용, red=error, yellow/blue 재사용, **brown/pink/lightBlueAccent 신규 팔레트**). dark는 상속(등급=도메인 상수)
- `components/common/ProfileWithCrown.tsx` — v1 1:1 이식: 등급 테두리색·등급 뱃지·displayType 프리셋(profile/comment/reply)·showNickname Row. 사진 없으면 👤 fallback
- 크라운: 결정 C(이모지 👑 placeholder, 상위 3등급 5.15/5.14/5.13만 — v1 `_crownAsset` 조건 동일). 원본 4.2MB PNG 미도입, **TODO(v2.1+) 최적화 에셋 교체** 명시
- ✅ typecheck, ✅ Android `assembleDebug`

### 🧗 Phase 2-1 ④ MyPage 갓파일 분해 착수 (2026-05-19)

#### Added
- `mypage_screen.dart`(1163줄) 분해 골격: `screens/profile/MyPageScreen.tsx`(컨테이너) + `components/ProfileHeader.tsx`(실구현: ProfileWithCrown+닉네임+intro+로그아웃) + 5탭 컴포넌트(`MyReportsTab/MyPostsTab/MyCommentsTab/MyRouteTab/MyProfileTab` placeholder) + `hooks/useMyPage.ts`(authStore uid→userStore.fetchProfile)
- 탭 스위처: v1 TabBar 라벨 1:1(`내 제보 관리/내글/내댓글/MY ROUTE/마이프로필`), 경량 커스텀 구현(@react-navigation/material-top-tabs 미도입 — 새 의존성 결정 회피)
- 이전 MyPageScreen placeholder → 분해 컨테이너로 교체 (MainTabNavigator idx4 그대로 연결)
- ✅ typecheck, ✅ Android `assembleDebug`

#### 잔여 (후속)
- 5탭 본문 실구현(Reports/Posts/Comments/Routes), MyProfileTab은 image-picker(react-native-image-picker 확정) 도입 시
- 알림 아이콘(Phase 3), 출석보상(P1), `_updateAllPostsAndCommentsProfile` 비정규화 동기화

### 📝 Phase 2-1 2-1-2-① MyPostsTab (2026-05-20)

#### Added
- `MyPostsTab.tsx` 구현 — v1 `_buildMyPostsTab` 1:1: `posts where userId==uid .snapshots()`(orderBy/limit 없음 보존), ProfileWithCrown + 제목 + snippet(content 30자) + 날짜 + 빈 상태
- `UnreadBadge`(inline 서브컴포넌트) — `notifications where receiverId+checked==false+postId` 일회성 조회(N+1, v1 FutureBuilder 보존). 인덱스 누락 등 에러 시 `console.warn`만(앱 안 깸)
- 신규 타입: `types/post.ts`, `types/notification.ts` (v1 실측 필드명)
- 신규 유틸: `utils/date.ts` (`formatDate` — v1 `_formatDate` 대응)
- 네비: `MainStack`의 `PostDetail`로 push (현재 placeholder, Phase 2-2에서 실구현)
- ✅ typecheck, ✅ Android `assembleDebug`

#### Fixed (스키마 인라인 정정 — 점진 처리, Firestore 구조 불변)
- `posts.timestamp` (v1 실측, ~~`createdAt`~~) — 02_DATA_MODEL §2 정정
- `notifications.checked` (v1 실측, ~~`isRead`~~), `postId`/`commentId`/`reportId`/`crewId` (v1 실측, ~~`target*Id`~~) — 02_DATA_MODEL §7 정정
- 나머지(comments.timestamp, my_routes.savedAt, route_reports.rejectionReason)는 해당 탭 구현 시 정정

### 💬 Phase 2-1 2-1-2-② MyCommentsTab (2026-05-20)

#### Added
- `MyCommentsTab.tsx` 구현 — v1 `_buildMyCommentsTab` 1:1: `collectionGroup('comments') where userId==uid orderBy timestamp desc .snapshots()` (인덱스 firestore.indexes.json 정의 확인됨)
- 아이템: 본인 ProfileWithCrown + **원본 글 제목**(`PostTitle` inline 서브컴포넌트, posts/{postId}.get per item N+1, v1 보존) + 댓글 본문(2줄) + 날짜 + 알림 배지
- postId 추출: `doc.ref.parent.parent.id` (경로 posts/{postId}/comments/{commentId})
- 신규 타입: `types/comment.ts` (v1 실측: `text`, `timestamp`, `photoUrl`)
- 공용 컴포넌트 **`UnreadBadge` 추출** — MyPostsTab의 inline 배지를 `components/common/UnreadBadge.tsx`로 일반화(`field: 'postId'|'commentId'|'reportId'|'crewId'`). MyPostsTab도 공용 사용으로 교체(중복 제거)
- onTap → 원본 PostDetail로 push
- ✅ typecheck, ✅ Android `assembleDebug`

#### Fixed (스키마 인라인 정정)
- `comments.text` (v1 실측, ~~`content`~~), `comments.timestamp` (~~`createdAt`~~), `comments.photoUrl` (~~`authorProfileUrl`~~) — 02_DATA_MODEL §3 정정

### 🧗 Phase 2-1 2-1-2-③ MyReportsTab (2026-05-20)

#### Added
- `MyReportsTab.tsx` — v1 `_buildMyReportsTab` 1:1. **두 컬렉션 동시 구독**(`route_reports` + `bouldering_reports` where `authorUid==uid`), 머지 후 `status!=='approved'` 필터(+v1 의도 보존) + `timestamp desc` 정렬. 컬렉션 태그(`Report.collection`)로 **삭제 시 안전 분기**(v1 휴리스틱 대체)
- `ReportCard.tsx` — v1 `_buildReportCard` 1:1: 썸네일(`imageUrls[0]`)+`산·루트명`+ProfileWithCrown+상태 뱃지+반려사유(rejected 시)+액션
- `ReportActions.tsx` — 권한별 액션: 삭제(본인||관리자, Alert 확인) / 승인(관리자&pending, 직접 update — v1 1:1 무확인) / 반려(관리자&pending, PromptModal). 승인·반려는 `route_reports`에만 적용(v1 동일)
- `PromptModal.tsx`(공용) — RN 빌트인 `Modal`+`Input`+`Button` 자체구현(Alert.prompt iOS-only 우회, 새 의존성 0). 향후 다른 입력 다이얼로그에서 재사용
- `types/report.ts` — `Report`/`ReportStatus`/`ReportCollection` + `statusToKorean`(v1 매핑). 상태색은 테마 의미 슬롯(disabled/warning/success/error)에 1:1 매핑
- 작성자 N+1 제거(이 탭은 본인 제보만 → ProfileHeader profile 재사용)
- ✅ typecheck, ✅ Android `assembleDebug`

#### Fixed (스키마 인라인 정정)
- `route_reports.rejectionReason` (v1 실측, ~~`rejectReason`~~) + status 'draft' 기본값 추가 — 02_DATA_MODEL §4 정정

### 🥾 Phase 2-1 2-1-2-④ MyRouteTab (2026-05-20)

#### Added
- `MyRouteTab.tsx` — v1 `_buildMyRouteTab` 1:1: `users/{uid}/my_routes orderBy savedAt desc .snapshots()` + 상단 검색 TextInput(클라이언트 필터, post-deref 매칭 v1 동일)
- `MyRouteCard.tsx` — v1 `_myRouteTile` 1:1: `routeRef` deref(N+1, getDoc)로 현재 mountain/routeName/imageUrl 표시, `routeRef` 없으면 저장 스냅샷, 삭제 시 "삭제된 루트입니다." 표시. 삭제(Alert 확인) + onTap → RouteDetail({reportId: routeRef.id ?? myRouteId}) placeholder
- `types/myRoute.ts` — `routeRef`(modular `DocumentReference` 타입 — `getDoc(ref)` 직접 호출 가능), `savedAt` 등 v1 실측 필드
- ✅ typecheck, ✅ Android `assembleDebug`

#### Fixed (스키마 인라인 정정)
- `users/{uid}/my_routes.savedAt` (v1 실측, ~~`completedAt`~~) + `routeRef`(DocumentReference) 필드 명시 — 02_DATA_MODEL §1-1 정정

### 👤 Phase 2-1 2-1-2-⑤ MyProfileTab [D] intro 편집 (2026-05-20)

#### Added
- `MyProfileTab.tsx` 실구현 — v1 `widgets/my_profile_tab.dart` 1:1 (편집 가능 필드: intro만 / 사진은 [F])
- 읽기 전용 필드 v1 1:1: 닉네임 / 이메일 / **등급 + "다음 등급(X)까지 N점" 안내** / 포인트
- 한 줄 소개(intro) `Input` multiline + "소개글 저장" `Button` → `useUserStore.updateProfile(uid, { intro })` (Alert로 결과 안내)
- ProfileWithCrown 큰 사이즈 표시(편집 버튼 없음 — [F] 단계 추가)
- `utils/levelCalculator.ts` — v1 `constants/level.dart`의 `LEVEL_POINT_MAP` + `getNextLevel` + `getRemainToNextLevel` 1:1 포팅
- `types/user.ts`에 `point?: number` 추가 (v1 실측)
- `KeyboardAvoidingView` + `ScrollView`(`keyboardShouldPersistTaps='handled'`)로 키보드 대응
- ✅ typecheck, ✅ Android `assembleDebug`

#### 정정 / 결정 사유 (v1 1:1 보존)
- **닉네임 변경([B])·등급 변경([C]) 작업 제외** — v1 my_profile_tab은 두 필드를 read-only로만 표시. 변경 기능 자체가 v1에 없음(`ProfileService.updateDisplayName`은 정의돼 있으나 미사용). 신기능 추가는 v2.1+ (CLAUDE.md MVP 원칙)
- **비정규화 동기화([E]) 보류** — v1도 MyProfileTab에서 자동 호출 안 함(`_updateAllPostsAndCommentsProfile`는 별도 트리거, 위치 추가 분석 필요). v1 동작 그대로 유지
- 등급은 v1 `calcLevel`에 따라 도메인 자동 계산 — 수동 변경은 데이터 무결성 깨뜨림(별도 이유)
- **[F] 프로필 사진(image-picker+Storage)은 양파 가능 구간으로 별도 보고 후 진행**

### 🌿 브랜치

#### Added
- `v2` 브랜치 (현재 활성, Flutter 잔재 정리 완료 → RN 코드 시작)

### ⚠️ 해결 대기 ([TBD])
- [TBD] 상태관리 라이브러리 (Zustand vs Redux Toolkit) — RideTalk 패턴 확인 후 결정
- [TBD] 지도 SDK (Google Maps vs Kakao Map) — 사용자 결정 필요
- [TBD] 디자인 토큰 (RideTalk 것 그대로 vs 새로 설계)
- ~~[TBD] iOS/Android 패키지명 (기존 그대로 vs v2 신규)~~ → ✅ **해결**: 기존 v1 그대로 유지 (2026-05-19)

### ❓ 질문 ([QUESTION])
- [QUESTION] 하단 탭바 정확한 구성
- [QUESTION] 갓 파일 4개의 내부 기능 상세 (map_input, generic_route_detail, mypage, crew_detail)
- [QUESTION] 이미지 에디터의 정확한 용도
- [QUESTION] 크루 채팅방의 백엔드 (Firestore vs RTDB)
- [QUESTION] 인공벽 매장 시스템 도입 시점 (v2.0 vs v2.1+)

---

## [1.2.3] — Flutter 기존 버전 (현재 운영 중)

### 📊 현황
- 빌드 번호: 39
- 사용자: 약 50명
- 플랫폼: Android, iOS
- 백엔드: Firebase
- 코드: Flutter 3.7.2+, Dart

→ 이 버전은 v2.0 출시 시까지 `main` 브랜치에서 유지. 긴급 패치만 적용.

---

*변경 사항 추가 시 [Unreleased] 섹션 최상단에 기록. 출시 시 버전 번호로 이동.*
