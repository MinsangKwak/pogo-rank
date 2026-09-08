# NOTICE — 라이선스 범위와 제3자 저작물 고지

**결론: 이 저장소의 코드는 MIT(LICENSE)이고, 포켓몬 데이터·이미지·명칭과 제3자 데이터는 MIT 대상이 아니다.** 저장소를 포크하거나 재배포할 때 아래 경로별 범위와 출처별 조건을 그대로 따라야 한다. (2026-09-07 v2.18.0 신설)

## 1. 경로별 라이선스 범위

| 경로 | 내용 | 라이선스 |
|---|---|---|
| `backend/` · `frontend/` · `scripts/` · `docs/` · `.github/` · 루트 설정 파일 | 빌드 파이프라인, 화면 코드, 문서 | **MIT** |
| `backend/config/*.txt` · `sheets.conf` | 수동 보정 목록 (출시 여부·기술 변경 등) | MIT (사실 정보 목록) |
| `snapshot/` | 순위 스냅샷 — PvPoke·hawaii 시트·게임마스터에서 파생한 데이터 | **MIT 아님** — 각 원 출처의 조건 |
| `data/` (빌드 산출, 커밋되지 않음) | 게임마스터 원본·가공 JSON·스프라이트 | **MIT 아님** — 각 원 출처의 조건 |
| `dist/` (빌드 산출) | 배포 결과. 코드는 MIT, 포함된 데이터·스프라이트는 위와 같음 | 혼합 |
| `frontend/static/icon-*.png` | 서비스 아이콘 | MIT |

## 2. 포켓몬 지식재산

Pokémon 및 관련 명칭·캐릭터·이미지의 권리는 **The Pokémon Company · Nintendo · Creatures Inc. · GAME FREAK inc.** 에, Pokémon GO 는 **Scopely Explore, Inc.** 에 있습니다. 이 프로젝트는 권리자와 무관한 비공식 팬 프로젝트이며, 수익을 목적으로 하지 않습니다.

권리자의 요청이 있으면 해당 이미지·데이터를 즉시 내립니다 (아래 5. takedown).

## 3. 데이터·이미지 출처별 조건

| 출처 | 쓰는 것 | 라이선스·조건 | 이 저장소에서의 취급 |
|---|---|---|---|
| [PvPoke](https://github.com/pvpoke/pvpoke) | PvP 순위·점수·추천 기술, 출시 여부 | MIT | 파생 데이터에 출처 표기 |
| [PokeMiners game_masters](https://github.com/PokeMiners/game_masters) | 종족값·기술·상성·CPM·다이맥스 매핑 | 명시 라이선스 없음 (게임 추출 데이터) | 원본(`gm.json`·`pm.json`)은 **배포물(dist)에 포함하지 않음**. 가공 결과만 `data.js` 로 배포 |
| [PokeAPI](https://github.com/PokeAPI/pokeapi) | 한글 종·기술 이름, 폼 인덱스 | BSD-3-Clause (코드) / 데이터는 fair use 고지 | CSV 원본 미배포, 이름만 사용 |
| [PokeAPI sprites](https://github.com/PokeAPI/sprites) | 96×96 도트 스프라이트 | 이미지 자체는 권리자 소유, 저장소 라이선스 없음 | 서비스용 축소본(96px, 평균 1KB)만 배포. 원본 고해상도 이미지 미포함 |
| [ScrapedDuck](https://github.com/bigfoott/ScrapedDuck) (LeekDuck) | 레이드 보스·알 부화 풀·이벤트 일정 | MIT (스크랩 결과) | 빌드가 자동 수집(`backend/gameday_build.py`) — 레이드·알 화면에 반영, 이벤트 일정표는 여전히 수동. 화면 하단에 출처 표기 |
| hawaii 레이드 성능표 (구글 시트) | 속성별 레이드 DPS·TDO 평가 | 개인 공개 문서, 별도 라이선스 없음 | 출처 표기. 작성자 허락 확인 절차 진행 중 — 거절 시 해당 열 제거 |
| [Bulbapedia](https://bulbapedia.bulbagarden.net/) | 다이맥스·거다이맥스 출시 목록 | CC BY-NC-SA 2.5 | 목록 사실만 사용, 문장 인용 없음 |
| pogomate | D-MAX 티어 공식 기준점 | 참고 | 공식만 참고, 데이터 미사용 |
| [Pretendard](https://github.com/orioncactus/pretendard) | 한글 웹폰트 | SIL OFL 1.1 | CDN 참조 |
| [Montserrat](https://fonts.google.com/specimen/Montserrat) | 영문·숫자 웹폰트 | SIL OFL 1.1 | Google Fonts 참조 |
| Firebase SDK · Google Analytics | 로그인·저장소·통계 | Google 약관 | CDN 참조 |

## 4. 포크·재배포 시 지켜야 할 것

- 코드는 MIT 조건(저작권 표시 유지)으로 자유롭게 쓸 수 있다.
- 스프라이트·게임 데이터를 함께 배포하면 위 2·3의 조건이 그대로 따라간다. 상업적 이용은 권리자 허락 없이는 불가하다.
- 서비스명 "POGO PLAN" 과 아이콘은 이 프로젝트를 가리키므로, 포크는 다른 이름을 쓰는 것을 권장한다.

## 5. Takedown(삭제 요청) 정책

권리자 또는 데이터 작성자가 삭제를 요청하면:

1. 요청 접수 후 **72시간 안에** 해당 이미지·데이터를 `deploy` 에서 내리고 배포한다.
2. 저장소 이력에 남은 사본은 요청 범위에 따라 이력 정리(history rewrite)까지 진행한다.
3. 접수 창구는 사이트 푸터의 문의 이메일 또는 GitHub Issues (SECURITY.md 의 창구와 같다).
