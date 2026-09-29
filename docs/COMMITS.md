# 커밋 메시지 규칙

[문서 안내](README.md) · [기여 안내](../.github/CONTRIBUTING.md) · [작업 지침](../.claude/CLAUDE.md)

**제목 한 줄은 `종류(범위): 무엇이 바뀌었는지` 꼴로 쓰고, 이유는 본문에 둡니다.** 2026-09-29부터 적용하며, 그날 이후의 커밋은 이 규칙으로 다시 적었습니다. `git log --oneline` 만 읽어도 무엇이 언제 바뀌었는지 보이게 하는 것이 목적입니다.

## 형식

```text
<종류>(<범위>): <제목>

<왜 바꿨는지 · 무엇을 택했는지>
Refs: #229
```

| 자리 | 규칙 |
| --- | --- |
| 종류 | 아래 표의 값 하나. 소문자 |
| 범위 | 선택. `web` · `server` · `content` · `docs` · `infra` 중 하나. 둘 이상에 걸치면 비운다 |
| 제목 | 한국어, 결론 먼저, 72자 안, 마침표 없음. "무엇이 바뀌었는지"를 적고 "어떻게"는 본문으로 |
| 본문 | 선택. 이유가 있을 때만. 제보·리뷰·PR 이 출처면 `Refs:` 줄에 번호 |
| 꼬리표 | `Co-Authored-By:` · `Signed-off-by:` 같은 줄은 그대로 둔다 |

## 종류

| 종류 | 언제 |
| --- | --- |
| `feat` | 사용자가 보는 새 기능·동작 |
| `fix` | 잘못된 동작을 고침 |
| `style` | 디자인·CSS·문구 배치만. 동작은 그대로 |
| `refactor` | 동작은 같고 구조만 바꿈 |
| `docs` | 문서만 |
| `test` | 검사만 |
| `data` | 데이터·스냅샷·이미지 갱신 |
| `ci` | 워크플로·배포·훅 설정 |
| `release` | 판 올림. `release: v5.5.0 — 한 줄 요약` |
| `sync` | 브랜치 동기화 병합. `sync: dev → main — v5.5.0` |
| `chore` | 위에 없는 잡일. 되도록 쓰지 않는다 |

주제가 둘이면 커밋을 나눕니다. 제목을 `·`로 이어 여러 주제를 담는 것은 `release` 에만 허용합니다.

## PR 과 병합 커밋

PR 제목도 같은 꼴로 씁니다 — 병합 커밋의 제목이 PR 제목이 되기 때문입니다. 동기화 PR 은 `sync: dev → main` · `sync: main → deploy` 로 통일합니다. `git merge` 가 만든 `Merge …` 제목의 커밋은 검사에서 제외합니다.

## 예

```text
feat(web): 많이 본 포켓몬의 남은 자리를 맥스 보스로 채운다
fix(server): 많이 본 포켓몬 순위를 채널별로 센다
style(web): 많이 본 포켓몬은 어느 폭이든 열 개를 가로로 넘긴다
docs: 커밋 메시지 규칙
release: v5.5.0 — 이번 주 많이 본 포켓몬 · 상세 팝업 도감 번호 수집
sync: dev → main — v5.5.0
```

## 검사

두 겹으로 봅니다. 둘 다 제목 한 줄만 보고, 본문은 보지 않습니다.

| 어디 | 무엇 | 켜는 법 |
| --- | --- | --- |
| 로컬 `commit-msg` 훅 | 저장 전에 제목 꼴을 본다 | 저장소에서 한 번 `git config core.hooksPath .githooks` |
| PR 검사 `commit-msg.yml` | PR 의 커밋 제목을 모두 본다. 어긋나면 실패로 표시하되 병합을 막지는 않는다 | 자동 |

검사기는 `scripts/check_commit_msg.mjs` 하나입니다. 메시지 파일 하나 또는 커밋 범위를 받습니다.

```bash
node scripts/check_commit_msg.mjs .git/COMMIT_EDITMSG
node scripts/check_commit_msg.mjs --range origin/dev..HEAD
```
