# 2026년 10월 맥스 배틀 배너 제작 기록

[디자인 가이드](README.md) · [프로젝트 소개](../../README.md) · [저작물 고지](../NOTICE.md)

**일정별 맥스 배틀 8개 항목에 사용할 배너를 제작했습니다.** 2026-09-25~26 제작 기록이며, 일정은 당시 수집 자료 기준입니다. 이미지 자체가 공식 발표나 실제 보스 확정 근거는 아닙니다.

## 최종 구성

서비스 파일은 `web/public/images/`에 있으며 각 파일명 뒤에 `-720.webp`, `-1200.webp`를 붙입니다.

| 기간 | 표시 대상 | 파일명 접두사 |
| --- | --- | --- |
| 9/21~27 | 프리져·썬더·파이어, 프리져 중심 배틀 팀 | `max-battle-articuno-panorama` |
| 9/28~10/4 | 울머기 | `max-battle-sobble-panorama` |
| 10/3 | 거다이맥스 에이스번 | `max-battle-cinderace-panorama` |
| 10/5~11 | 태우지네 | `max-battle-sizzlipede-panorama` |
| 10/12~18 | 파라꼬 | `max-battle-rookidee-character-panorama` |
| 10/19~25 | 포푸니 | `max-battle-sneasel-panorama` |
| 10/24 | 보스 미공개, 콘셉트 알 이미지 | `max-battle-mystery-egg-panorama` |
| 10/26~11/1 | 깜까미 | `max-battle-sableye-character-panorama` |

울머기는 기존 배너를 사용하고 나머지는 새로 제작했습니다. 파라꼬·깜까미는 최종 캐릭터 버전으로 교체했습니다. 초기 경기장 대체안은 최종 구성에 포함하지 않습니다.

## 이미지 사양

| 항목 | 기준 |
| --- | --- |
| 제작 | 내장 이미지 생성 도구, 참조 이미지 기반 신규 생성·형태 수정 |
| 분위기 | 3D 애니메이션 영화풍 경기장, 마젠타 맥스 구름, 푸른 조명 |
| 구도 | 피사체는 오른쪽 중심, 왼쪽은 제목을 위한 어두운 여백 |
| 비율·크기 | 3:1, 720×240과 1200×400 |
| 서비스 포맷 | WebP, sharp 변환, quality 86 |
| 제외 | 이미지 안의 글자·워터마크 |

생성 원본은 작업 환경에서 별도 보관합니다. 개인 컴퓨터의 임시 경로는 재현 가능한 저장소 자산이 아니므로 문서에 의존 경로로 남기지 않습니다.

## 일정과 이미지 연결

[ScrapedDuck 이벤트 데이터](https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json)의 max-mondays·max-battles를 사용하고, 지나간 주간 보스는 기존 일정 자료로 보완했습니다.

- [10월 5일](https://leekduck.com/events/max-mondays-2026-10-05/)
- [10월 12일](https://leekduck.com/events/max-mondays-2026-10-12/)
- [10월 19일](https://leekduck.com/events/max-mondays-2026-10-19/)
- [10월 26일](https://leekduck.com/events/max-mondays-2026-10-26/)
- [10월 24일 맥스 배틀 데이](https://leekduck.com/events/max-battle-day-october-24-2026/)

미공개 보스는 추정하지 않습니다. 알 이미지는 해당 미공개 행사에만 연결하고, 보스가 발표되어 매핑이 생기면 발표된 보스 이미지를 우선합니다.

## 생성 방향

공통 지시문은 3:1 구도, 오른쪽 피사체, 왼쪽 제목 여백, 마젠타 구름·푸른 조명·반사 바닥을 유지하는 것입니다. 울머기 배너를 분위기 참조로 사용했습니다.

| 대상 | 구체적 시각 요소 |
| --- | --- |
| 에이스번 | 거대한 불꽃 공 위의 거다이맥스, 작은 물 타입 배틀 팀 |
| 태우지네 | 짧고 납작한 분절 몸체, 노란 열기관·수염, 작은 다리. 진화형과 혼동되지 않도록 수정 |
| 파라꼬 | 둥근 파란 몸, 검은 얼굴·노란 가슴, 펼친 날개 |
| 포푸니 | 짙은 청록색 몸, 붉은 귀·꼬리 깃, 흰 발톱 |
| 깜까미 | 보라색 몸, 푸른 보석 눈, 긴 귀, 붉은 가슴 보석 |
| 프리져 | 오른쪽의 거대한 얼음 새와 아래쪽의 작은 배틀 팀 |
| 미공개 | 식별 가능한 보스 없이 경기장 오른쪽에 빛나는 알 |

<details>
<summary>최종 생성 지시문 예시</summary>

**파라꼬**

> Create a panoramic 3:1 cinematic 3D rendition of Rookidee using the character and stadium references. Preserve its round blue body, black face, yellow chest, red eyes and small feet. Place the giant bird on the right with wings extended. Keep the left third dark for website text. Use pink storm clouds and blue stadium lighting. No text.

**깜까미**

> Translate the referenced Sableye sprite into a polished cinematic 3D character. Preserve the purple body, blue gemstone eyes, pointed ears and red chest jewel. Place it on the right of the stadium with its head and torso visible. Use magenta clouds, violet jewel lighting and an uncluttered dark left third. Panoramic 3:1, no text.

**프리져**

> Recreate the referenced battle as a cinematic 3D stadium illustration. Place giant Articuno on the right and the small team of Rhyperior, Blissey, Lugia and Excadrill low in the middle. Leave a dark navy left third for headings. Use ice crystals, soft feathers, a reflective floor, blue lights and magenta clouds. Panoramic 3:1, no text or watermark.

**미공개 행사**

> Create a panoramic 3:1 editorial illustration of a luminous pink raid egg above the right side of a nighttime Max Battle arena. Show no identifiable boss or silhouette. Use magenta energy, blue stadium lights and mist. Keep the left third dark and empty. This is a concept illustration, not an official event announcement. No lettering or watermark.

</details>

## 검증 범위

[배너 테스트](../../web/src/test/maxart.test.ts)와 [일정 테스트](../../web/src/test/maxslides.test.ts)에서 순서·이미지 연결·파일 존재·미공개 행사 제한을 확인합니다. 타입 검사와 모바일 피사체 잘림도 확인 대상입니다. 새 배너를 추가하면 파일뿐 아니라 매핑·대체 텍스트·초점 위치를 함께 검토합니다.
