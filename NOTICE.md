# NOTICE — 라이선스 범위와 제3자 저작물 고지

[← README](README.md) · [기여 안내](CONTRIBUTING.md) · **NOTICE** · [SECURITY](SECURITY.md)

**저장소 코드의 이용 조건은 [LICENSE](LICENSE), 포켓몬과 제3자 데이터의 이용 조건은 각 권리자의 조건을 따릅니다.** 코드의 포크·재배포는 허용하지 않습니다.

| 확인할 내용 | 바로가기 |
| --- | --- |
| 파일별 적용 범위 | [1. 경로별 라이선스](#1-경로별-라이선스-범위) |
| 데이터·이미지의 출처와 조건 | [3. 출처별 조건](#3-데이터이미지-출처별-조건) |
| 포크·재배포 제한 | [4. 포크·재배포](#4-포크재배포) |
| 권리자의 삭제 요청 | [5. 삭제 요청 정책](#5-takedown삭제-요청-정책) |

문서 신설: 2026-09-07 · 라이선스 전환: 2026-09-16 (`v3.48.2`).

## 1. 경로별 라이선스 범위

| 경로 | 내용 | 라이선스 |
|---|---|---|
| `backend/` · `frontend/` · `scripts/` · `docs/` · `.github/` · 루트 설정 파일 | 빌드 파이프라인, 화면 코드, 문서 | **저작권자 소유 · 포크·재배포 금지** |
| `backend/config/*.txt` · `sheets.conf` | 수동 보정 목록 (출시 여부·기술 변경 등) | 저작권자 소유 (사실 정보 목록) |
| `snapshot/` | 순위 스냅샷 — PvPoke·hawaii 시트·게임마스터에서 파생한 데이터 | **저장소 조건과 별개** — 각 원 출처의 조건 |
| `data/` (빌드 산출, 커밋되지 않음) | 게임마스터 원본·가공 JSON·스프라이트 | **저장소 조건과 별개** — 각 원 출처의 조건 |
| `dist/` (빌드 산출) | 배포 결과. 코드는 저장소 조건, 포함된 데이터·스프라이트는 위와 같음 | 혼합 |
| `frontend/static/icon-*.png` | 서비스 아이콘 | 저작권자 소유 · 재사용 금지 |

## 2. 포켓몬 지식재산

Pokémon 및 관련 명칭·캐릭터·이미지의 권리는 **The Pokémon Company · Nintendo · Creatures Inc. · GAME FREAK inc.** 에, Pokémon GO 는 **Scopely Explore, Inc.** 에 있습니다. 이 프로젝트는 권리자와 무관한 비공식 팬 프로젝트이며, 수익을 목적으로 하지 않습니다.

권리자의 요청이 있으면 해당 이미지·데이터를 즉시 내립니다 (아래 5. takedown).

## 3. 데이터·이미지 출처별 조건

| 출처 | 쓰는 것 | 라이선스·조건 | 이 저장소에서의 취급 |
|---|---|---|---|
| [PvPoke](https://github.com/pvpoke/pvpoke) | PvP 순위·점수·추천 기술, 출시 여부 | MIT | 파생 데이터에 출처 표기 |
| [PokeMiners game_masters](https://github.com/PokeMiners/game_masters) | 종족값·기술·상성·CPM·다이맥스 매핑 | 명시 라이선스 없음 (게임 추출 데이터) | 원본(`gm.json`·`pm.json`)은 **배포물(dist)에 포함하지 않음**. 가공 결과만 `data.js` 로 배포 |
| [PokeAPI](https://github.com/PokeAPI/pokeapi) | 한글 종·기술 이름, 폼 인덱스 | BSD-3-Clause (코드) / 데이터는 fair use 고지 | CSV 원본 미배포, 이름만 사용 |
| [PokeAPI sprites](https://github.com/PokeAPI/sprites) | 공식 일러스트(other/official-artwork) · B/W 애니메이션 GIF | 이미지 자체는 권리자 소유, 저장소 라이선스 없음 | 서비스용 축소본(최대 256px, 평균 11KB)만 배포. 원본(475px) 미포함 |
| [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) | 국가별 검색 순위 지도의 국경 (1:110m Admin 0) | 퍼블릭 도메인 | `frontend-v4/src/lib/world-map.json` 으로 단순화해 포함. 남극 제외, 경계는 참고용 |
| [Pokémon Showdown sprites](https://play.pokemonshowdown.com/sprites/) | PokeAPI 에 없는 종의 애니메이션 GIF (6~8세대·메가·리전 폼) | 팬 제작 스프라이트, 이미지 속 캐릭터의 권리는 권리자 소유 | 표시용으로만 사용. 서비스 안에서 판매·재배포하지 않음 |
| [ScrapedDuck](https://github.com/bigfoott/ScrapedDuck) (LeekDuck) | 레이드 보스·알 부화 풀·이벤트 일정 | MIT (스크랩 결과) | 빌드가 자동 수집(`backend/gameday_build.py`) — 레이드·알 화면에 반영, 이벤트 일정표는 여전히 수동. 화면 하단에 출처 표기 |
| hawaii 레이드 성능표 (구글 시트) | 속성별 레이드 DPS·TDO 평가 | 개인 공개 문서, 별도 라이선스 없음 | 출처 표기. 작성자 허락 확인 절차 진행 중 — 거절 시 해당 열 제거 |
| [Bulbapedia](https://bulbapedia.bulbagarden.net/) | 다이맥스·거다이맥스 출시 목록 | CC BY-NC-SA 2.5 | 목록 사실만 사용, 문장 인용 없음 |
| pogomate | D-MAX 티어 공식 기준점 | 참고 | 공식만 참고, 데이터 미사용 |
| [Pretendard](https://github.com/orioncactus/pretendard) | 한글 웹폰트 | SIL OFL 1.1 | CDN 참조 |
| [Galmuri](https://github.com/quiple/galmuri) | 픽셀 웹폰트 (칩·탭·버튼·제목) | SIL OFL 1.1 | CDN 참조 |
| Firebase SDK · Google Analytics | 로그인·저장소·통계 | Google 약관 | CDN 참조 |

## 4. 포크·재배포

**포크, 재배포는 안 됩니다.** (2026-09-16 v3.48.2)

- 이 저장소는 읽고 배우라고 공개한 것이다. 사본을 공개하거나 유지하는 것, 코드 전체·일부를 다른 이름으로 배포·호스팅하는 것, 복제 서비스를 운영하는 것, 상업적 이용은 허용하지 않는다 (LICENSE).
- 기여는 이 저장소로 보내는 이슈·PR 로 한다 (CONTRIBUTING.md).
- 스프라이트·게임 데이터는 위 2·3의 권리자 조건이 별도로 적용된다. 그 데이터를 이 저장소 밖으로 옮겨 쓰는 것도 각 권리자의 조건을 따라야 한다.
- 서비스명 "moncamp" 와 아이콘은 이 프로젝트를 가리키는 표지라 다른 곳에 쓸 수 없다.

## 5. Takedown(삭제 요청) 정책

권리자 또는 데이터 작성자가 삭제를 요청하면:

1. 요청 접수 후 **72시간 안에** 해당 이미지·데이터를 `deploy` 에서 내리고 배포한다.
2. 저장소 이력에 남은 사본은 요청 범위에 따라 이력 정리(history rewrite)까지 진행한다.
3. 접수 창구는 사이트 푸터의 문의 이메일 또는 GitHub Issues (SECURITY.md 의 창구와 같다).
