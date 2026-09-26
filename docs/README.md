# 문서 안내

[프로젝트 소개](../README.md) · [작업 지침](../.claude/CLAUDE.md) · [기여 안내](../.github/CONTRIBUTING.md) · [보안 정책](../.github/SECURITY.md)

**무엇을 보려는지에 따라 아래에서 고릅니다.** 현재 구조와 절차는 앞의 다섯 문서가 기준이고, 기록·고지·설계 자료는 그 아래입니다.

| 목적 | 문서 |
| --- | --- |
| 구조 · 계산 기준 · 실행과 검증 | [DEVELOPMENT.md](DEVELOPMENT.md) |
| 배포 · 계정 · 장애 대응 · 백업 | [OPERATIONS.md](OPERATIONS.md) |
| 인프라 구성과 비용 판단 | [INFRA.md](INFRA.md) |
| 완료된 전환과 남은 과제 | [ROADMAP.md](ROADMAP.md) · [V5-CUTOVER.md](V5-CUTOVER.md) |
| 디자인 규칙과 검증 | [design/README.md](design/README.md) |
| 개발 이력 (측정값 있는 개선 기록) | [HISTORY.md](HISTORY.md) |
| 판별 변경 이력 | [CHANGELOG.md](CHANGELOG.md) |
| 데이터 · 이미지 출처와 이용 조건 | [NOTICE.md](NOTICE.md) |

`*.html` · `*.png` 는 위 문서에서 참조하는 그림(구조도 · 타임라인 · ERD)입니다. 원본 HTML 을 고치고 `node scripts/bake_html.mjs <파일>` 로 PNG 를 다시 굽습니다.
