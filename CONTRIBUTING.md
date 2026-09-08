# 기여 안내 (CONTRIBUTING.md)

**PR 은 `dev` 브랜치로, 커밋마다 DCO 서명(`git commit -s`)을 붙여 주세요.** 나머지 규칙은 아래와 개발 문서(docs/DEVELOPMENT.md)에 있습니다. (2026-09-07 v2.18.0 신설)

## 시작하기

```bash
bash scripts/build.sh        # 원본 다운로드 + 전체 빌드 (Python 3.10+ · curl)
python3 backend/build.py     # 화면만 고쳤을 때
cd dist && python3 -m http.server 5503   # http://localhost:5503/?mock=1 → 로그인 뒤 화면을 목으로
```

의존성은 없습니다(Python 표준 라이브러리 + 바닐라 JS). `pip install` 이 필요한 변경은 받지 않습니다 — CI 가 stdlib 만 쓰는 것이 원칙입니다.

## 브랜치와 PR

| 브랜치 | 용도 |
|---|---|
| `dev` | 작업·미리보기. **PR 대상** |
| `main` | 검증된 통합 |
| `deploy` | 실서비스 (운영자만) |

1. `dev` 에서 브랜치를 따고 작업합니다.
2. PR 제목은 "무엇을 왜" 한 줄, 본문에 화면이 바뀌면 스크린샷을 붙입니다.
3. 데이터(순위·출시 여부·한글 이름)를 고치는 PR 은 **출처 링크**가 필수입니다. 창작 데이터는 받지 않습니다.
4. 버전 올리기·CHANGELOG·패치노트는 운영자가 릴리스 때 정리하므로 PR 에서 손대지 않아도 됩니다.

## DCO (Developer Certificate of Origin)

기여자 라이선스 계약(CLA) 대신 [DCO 1.1](https://developercertificate.org/) 을 씁니다. 커밋에 아래 줄이 있으면 됩니다.

```
Signed-off-by: 이름 <이메일>
```

`git commit -s` 가 자동으로 붙입니다. 이 서명은 "내가 이 코드를 MIT 로 기여할 권리가 있다"는 확인입니다.

## 코드 규칙 (요약)

- 전역 이름·`state` 키·DOM id·localStorage 키·GA 이벤트명·Firestore 필드명은 **바꾸지 않습니다**. 새로 만들 때는 접두사(`plan_` 등)를 붙입니다.
- 주석은 `//` 한 줄씩. 파일 머리말에 "제공하는 전역 / 의존하는 전역"을 적습니다.
- 한글 이름은 PokeAPI 실데이터만 씁니다. 미출시 폼·메가는 표에 올리지 않습니다.
- 트레이너 코드·친구 이름 같은 개인정보는 코드·placeholder 에 두지 않습니다 (Firestore 에만).
- 새 특수문자를 화면에 추가하면 웹폰트 서브셋을 다시 만들어야 할 수 있습니다 (docs/DEVELOPMENT.md).

## 행동 규범

서로 존중합니다. 괴롭힘·차별·비하는 어떤 채널에서도 받지 않으며, 운영자가 경고 없이 참여를 제한할 수 있습니다. 문제가 있으면 SECURITY.md 의 이메일로 알려 주세요.

## 라이선스

기여한 코드는 저장소와 같은 MIT(LICENSE) 로 배포됩니다. 데이터·이미지는 NOTICE.md 의 범위를 따릅니다.
