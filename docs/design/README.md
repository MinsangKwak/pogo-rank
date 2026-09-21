# moncamp 디자인 구현

`dev`의 `f292a06`에서 분기한 `design` 전용 작업입니다. 아래 내용은 해당 작업 당시의 기록이며, 현재 배포 상태를 뜻하지 않습니다.

## 적용 범위

| 영역 | 변경 |
|---|---|
| 포켓몬 팝업 | PC 프로필·정보 분할, 최대 CP·실제 활용 순위 요약, 포획 CP 접기, 모바일 압축 프로필 |
| 하단 행동 | 공유·도감·CP 계산기 고정, 계산기 복귀·초기화 유지 |
| 접근성 | 탭과 패널 연결, 방향키·Home·End 이동, 포커스 표시 |
| 홈 | 기존 기능 그룹·추천·소식 카드에 공통 테두리·여백·도트 배경 적용 |
| 도감·랭킹 | 기존 목록/그리드를 유지하며 카드·이미지·페이지 제목 스타일 통일 |
| 브랜드 | 텐트와 볼을 결합한 SVG 심벌, 대비를 높인 React·볼 표식 |
| OG | 도트 캠프 공유 이미지 신규 제작, OG·Twitter·구조화 데이터 이미지 참조 변경 |

## 화면 확인

- [PC 팝업](popup-desktop.png) / [모바일 팝업](popup-mobile.png) / [다크 팝업](popup-dark.png)
- [PC 홈](home-desktop.png) / [모바일 홈](home-mobile.png)
- [도감](dex-desktop.png) / [다이맥스](dmax-desktop.png) / [PvE](pve-desktop.png) / [PvP](pvp-desktop.png)
- [OG 이미지](../../frontend/static/og-design.png) / [SVG 심벌](../../frontend/static/logo.svg)

캡처는 design 코드의 로컬 빌드 결과입니다. 데이터는 기존 로컬 수집본을 사용했으며 실시간 게임 데이터 갱신 결과가 아닙니다.

## 구현 기준

- `frontend-v4/src/design.css`에서 간격·표면·테두리·그림자·팝업 폭을 공통 변수로 관리합니다. 색상은 기존 테마 토큰을 사용합니다.
- 기존 `.detail__*`, `.home__*`, `.dex__*`, `.row` 클래스를 재사용합니다. React 전용 스타일은 기존 CSS 다음에 한 번만 불러옵니다.
- 로고·버전 표식·팝업 탭·포획 CP·활용 순위·공유를 개별 React 컴포넌트로 분리했습니다.
- 데이터 계산·인증·권한 정책과 제보 URL은 변경하지 않습니다. 계정·관리자·계산 도구의 전체 재설계는 이 작업 범위에 포함되지 않습니다.
- 공유 썸네일은 새 파일명 `og-design.png`를 사용합니다. 현재 운영 URL에는 배포되지 않았으므로 실제 공유 카드 교체는 추후 승인된 배포 이후 적용됩니다.

## 확인 결과

- TypeScript 검사와 Vite 빌드 성공.
- 360·390·480·768·1440px: 가로 넘침 및 팝업 하단 계산기 버튼 영역 확인.
- 방향키 탭 이동, 포획 CP 펼치기, 계산기 진입·복귀, 닫기, 도감 이동 통과.
- 홈·도감·다이맥스·PvE·PvP, 팝업 라이트·다크 화면 캡처. 확인 중 JavaScript 오류 0건.
- 브라우저에서는 Galmuri를 같은 버전의 로컬 패키지로 제공하고 한국어 시스템 폰트를 설치하여 외부 CDN 제한을 보완했습니다. 서비스의 폰트 URL은 변경하지 않았습니다.
- 실제 Firebase 로그인과 회원 권한 회귀 검사는 수행하지 않았습니다. 로컬 Firebase 설정 없이 디자인을 검토했습니다.
- 기존 Legal.tsx 정적/동적 import 경고와 큰 Firebase 청크 경고는 남아 있습니다.

## 로컬 실행

원본 데이터가 준비된 저장소 루트에서 `python3 backend/build.py`를 실행한 뒤 아래 순서로 실행합니다.

```bash
cd frontend-v4
npm ci
BUILD_CHANNEL=dev npm run build
cp -R ../dist/sprites dist/sprites
cp -R ../dist/sprites-anim dist/sprites-anim
npm run preview -- --host 127.0.0.1
```

스프라이트 디렉터리가 없는 환경에서는 먼저 기존 프로젝트의 데이터·스프라이트 수집 절차를 실행해야 합니다.
