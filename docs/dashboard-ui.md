# 관제 화면 구성 및 연동 상태

브랜치: `feat/turtle-scan-ui`

- `#map`: 지도, 현재 위치와 목적지, 위험도별 균열 마커와 요약, 우측 로봇 현황 및 균열 상세.
- `#inspection`: 기간별 전체·고위험 균열 수, 평균 면적, 위험도 비율, 균열 탐지 추이, 검색·필터·정렬 가능한 전체 로그.
- `#control`: 좌측 TurtleBot 지도·좌표·수동 조작·자율주행, 우측 미니로봇 영상·수동 조작·전조등·회수.

## 위험도

`risk`는 0~1 숫자이며 UI는 백분율을 표시한다. 표시 소수점은 최대 두 자리로 절삭하여 구간 경계에서 상위 등급처럼 반올림되지 않게 한다.

| 등급 | 값 | 표시 구간 |
| --- | --- | --- |
| Low | 0 ≤ risk < 0.25 | 0% 이상 25% 미만 |
| Medium | 0.25 ≤ risk < 0.5 | 25% 이상 50% 미만 |
| High | 0.5 ≤ risk < 0.75 | 50% 이상 75% 미만 |
| Critical | 0.75 ≤ risk ≤ 1 | 75% 이상 100% 이하 |

고위험 건수는 High와 Critical의 합계다. 유효하지 않은 값은 정보 없음으로 처리한다. 평균 면적은 유효한 `areaM2`만 사용한다. 날짜 집계는 한국 시간 기준이며 탐지가 없는 중간 날짜는 0건으로 채운다.

## 실제 연동과 준비된 UI

지도·로봇 상태·키보드 명령·전조등·저장 영상 및 WebRTC는 기존 API와 연결된다. 지도 교체 이벤트 `map.updated`를 수신하면 화면 지도를 갱신한다. 현재 위치는 온라인, localization 유효, 지도 버전 및 좌표계 일치, 지도 범위 내부일 때만 표시한다.

균열 API는 아직 없다. `src/features/inspection.ts`의 `DEMO_CRACKS`로 화면을 확인하며 미연동 데이터는 자동으로 더미 데이터를 표시한다. 새 지도에 표시되는 예시 마커는 실제 탐지 위치가 아니다. 실제 연동 시 Crack의 `mapVersion`을 채우고 현재 지도와 일치하는 기록만 표시해야 한다.

목적지·배터리·진행률은 아직 Agent가 보내지 않는다. 다음은 FE에 준비한 선택적 status 필드이며, 실제 백엔드/Agent 계약이 확정되면 송신 측 연동이 필요하다. 값이 없으면 미수신 상태를 표시한다.

```json
{
  "battery_percent": 78,
  "destination": {
    "x": 1.2,
    "y": 0.7,
    "frame_id": "map",
    "map_version": "현재 지도 버전"
  },
  "navigation_progress": 0.42
}
```

진행률은 로봇에서 계산한 경로 대비 진행 비율을 받아 표시한다. 목적지까지 직선거리로 임의 추정하지 않는다. 자율주행 시작·일시 정지·복귀와 미니로봇 회수는 명령 API가 없으므로 비활성화했다.

## 조작

한 번에 한 로봇만 조종 활성화한다. W/A/S/D·방향키 또는 화면 방향 버튼을 누르는 동안 이동한다. Space·화면 정지 버튼은 즉시 정지를 전송한다. 화면 이동, 조종 대상 전환, 조종 해제 시 기존 연결에서 정지하고 조종권을 해제한다. 창 포커스 이탈 및 문서 숨김은 키를 비우고 정지한다. 상단 비상 정지는 현재 대시보드의 수동 조작을 중단하며, 아직 연동되지 않은 자율주행이나 다른 조종자의 로봇까지 정지시키는 기능은 아니다.

## 확인 명령

```bash
node --experimental-strip-types --test tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
npm run build
npm run dev
```

Node 23에서 테스트를 검증했다. 실제 주행 성공 여부는 별도 실기 검증이 필요하다.

## Turtle Scan 화면 후속 변경

서비스명과 첨부 로고를 TURTLE SCAN으로 적용했다. 예시 안내 배너와 선택 스위치는 제거했으며 미연동 균열·표시용 위치·목적지·진행률은 자동으로 더미 데이터를 사용한다. 표시용 RobotState와 실제 조작 RobotState는 분리한다. 더미 로봇은 조종권 획득이나 오프라인 조작을 활성화하지 않는다. 지하공간 지도 상세는 선택 시에만 별도 열(좁은 화면에서는 지도 아래 패널)에 나타나고 분류는 제거했다. 화면 높이 기준으로 크기를 조정하며 작은 화면에서 표·상세·조작 열은 내부 스크롤을 사용한다. 이 절은 위의 예시 전환 및 미수신 표시 설명보다 우선한다.

## 차트·미디어 크기 보완

- 차트 행은 위험도 비율 / 탐지 추이 / 균열 위험도 의 3열이다. 비교 그래프는 같은 균열 ID를 X축에 두며 현재값(실선)과 미래값(점선)을 함께 표시한다. 미래값은 `predictedRisk`(0~1)이며 현재 fixtures의 값은 예측 모델 결과가 아닌 더미 데이터다. 누락 시 그래프에 값을 만들지 않는다.
- 도넛 반지름을 백분율로 변경하고 그래프와 로그의 높이 배분을 명시했다. 로그 본문은 내부 세로 스크롤, 표 헤더는 고정한다.
- 로봇 제어는 양쪽의 제목·미디어·위치·자동 기능·수동 조작을 같은 grid 행으로 배치한다. 공간 지도와 카메라 패널 높이를 일치시키고 지도 컨테이너의 높이 의존 순환을 제거했다.
- 매번 앱을 시작할 때 dark 테마로 시작한다. 현재 실행 중에는 테마 버튼으로 전환 가능하다.
- 로고 편집은 built-in image_gen을 사용했다. 원본은 보존하고 `src/assets/turtle-scan-logo-transparent.png`를 적용했다. PNG alpha 존재를 확인했다.

로고 편집 프롬프트:
> Edit this exact Turtle Scan logo only. Remove the entire white background to genuine alpha transparency. Preserve the turquoise, cyan and navy turtle wearing a visor, its silhouette and all original internal shapes/colors. No redesign, no text, no new elements, no shadow. Center the complete uncut logo in a square transparent canvas, equal comfortable transparent margins about 8% around the subject; make the whole turtle fully visible. Deliver PNG with real transparent alpha, not a checkerboard drawing.

### 2026-09-06 워드마크 편집 및 레이아웃
- 이미지 편집 도구: built-in imagegen. 원본: TurtleScan_logotext.png. 결과: src/assets/turtle-scan-wordmark.png.
- 편집 프롬프트: “Edit the supplied TurtleScan logo wordmark asset. Remove only the white background to true alpha transparency. Preserve the exact turtle illustration and exact TurtleScan lettering, shapes and navy/turquoise colors. Crop the large empty outer margins to a tightly fitted horizontal canvas around the entire turtle and wordmark, with a small uniform transparent margin. No clipping, no new elements, no shadow, no redesign. Output transparent PNG.”
- 기존 투명 심볼은 favicon으로 사용한다. 탐지 로그는 5행 최소 높이, 상세는 클릭형 native dialog, 로봇 제어 미디어는 최소 340px로 유지한다. 작은 화면은 페이지 스크롤을 허용한다.

### 면적 지표 및 제어 화면
- 균열 측정 필드는 areaM2(m²)이며 평균은 유효한 면적만 집계한다. 샘플 면적은 독립적인 더미 값이다.
- 상세 정보는 중앙 modal dialog에서 사진 영역과 측정 정보를 표시한다. 닫기·Escape를 지원한다.
- 데스크톱 제어 패널은 수동 조작과 자율주행/회수를 가로 배치하고 미디어 행 높이를 공유한다. 작은 화면에서는 세로 배치와 스크롤을 허용한다.

자율주행·회수는 이 UI 커밋에서는 비활성 버튼이다. 자율주행 진행률은 실제 값이 없으면 예시 64%를 표시한다. 명령 연동 코드는 별도 변경으로 분리한다.
