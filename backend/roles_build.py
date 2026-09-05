# roles_build.py — "이 포켓몬은 PvE 쪽인가 PvP 쪽인가"를 판정할 근거표(data/roles.json) 생성
#
# 왜 필요한가
#   즐겨찾기(★)는 "내가 가진 것"이라는 사실 하나만 담는다. 거기에 PvE용/PvP용이라는 용도까지
#   사람이 직접 태그하게 하면 별이 두 개가 되고 "보유"의 뜻이 흐려진다.
#   그래서 용도는 사람에게 묻지 않고 이미 계산해 둔 순위표에서 끌어낸다.
#
#   기존에 쓰던 VALUE_DATA.usage 는 각 표 상위 30만 담아 80종밖에 커버하지 못한다.
#   즐겨찾기 목록 대부분이 "기타"로 떨어지면 분류가 무의미하므로, 더 깊은 원본에서 다시 뽑는다.
#
# 입력
#   data/pve_full.json   PvE 전 종 점수 {표: {'도감번호|폼라벨': 점수}} — 19개 표
#   data/pvp_all.json    PvP 리그별 전체 순위 (build.py 1차 산출)
#
# 출력 (data/roles.json)
#   pve      '도감번호|폼라벨' → [표 키, 순위]      그 폼이 가장 높이 오른 PvE 표와 순위
#   pvp      '도감번호|폼라벨' → [리그 키, 순위]    그 폼이 가장 높이 오른 리그와 순위
#   dexPve   '도감번호' → [표 키, 순위, 폼라벨]     종 단위 최고 (즐겨찾기 목록이 종 단위라서 필요)
#   dexPvp   '도감번호' → [리그 키, 순위, 폼라벨]
#   cut      {'pve': N, 'pvp': N}                  어디까지를 "쓸모 있음"으로 봤는지 (화면 각주용)
#
# 키를 '도감번호|폼라벨' 로 두는 이유
#   pve_full.json 이 이미 이 형식을 쓴다. 새 규칙을 만들지 않고 그대로 따라가면
#   아머드 뮤츠('150|아머드')와 일반 뮤츠('150|')가 자연히 갈린다.
#
# 파이프라인 위치
#   value_build.py 다음(=pve_full.json 이 있고), build.py 2차 앞.

import json
import os

# 여기까지 든 것만 "그 분야에서 쓸모 있다"로 본다.
# 너무 좁으면 즐겨찾기가 죄다 '기타'가 되고, 너무 넓으면 분류가 의미를 잃는다.
# 배포 후 '기타' 비율을 보고 조정할 값이라 상수로 빼 둔다.
PVE_CUT = 60
PVP_CUT = 100

OUTPUT_PATH = 'data/roles.json'


def better(current, rank):
    # 이미 담긴 것보다 순위가 앞서면 교체한다 (숫자가 작을수록 앞)
    return current is None or rank < current[1]


# ── PvE: 표마다 점수 내림차순으로 세워 순위를 매긴다 ──────────────────────────
# pve_full.json 은 순위가 아니라 점수를 담고 있어서 여기서 정렬해 순위로 바꾼다.
pve_best = {}
if os.path.exists('data/pve_full.json'):
    pve_full = json.load(open('data/pve_full.json', encoding='utf-8'))
    for table_key, scores in pve_full.get('scores', {}).items():
        ranked = sorted(scores.items(), key=lambda item: -item[1])
        for rank, (form_key, _score) in enumerate(ranked[:PVE_CUT], start=1):
            if better(pve_best.get(form_key), rank):
                pve_best[form_key] = [table_key, rank]

# ── PvP: 리그별 전체 순위에서 컷 안쪽만 ───────────────────────────────────────
# pvp_all 의 행은 폼 라벨(form)을 따로 갖고 있고, 섀도우는 이름 앞에 '섀도우 '가 붙는다.
# pve_full 의 키 형식('19|섀도우 알로라')과 맞추려면 섀도우를 라벨 앞에 다시 붙여야 한다.
pvp_best = {}
if os.path.exists('data/pvp_all.json'):
    pvp_all = json.load(open('data/pvp_all.json', encoding='utf-8'))
    for league_key, rows in pvp_all.items():
        for row in rows:
            if row['rank'] > PVP_CUT:
                continue
            label = row.get('form') or ''
            if row['name'].startswith('섀도우'):
                label = f'섀도우 {label}'.strip()
            form_key = f"{row['dex']}|{label}"
            if better(pvp_best.get(form_key), row['rank']):
                pvp_best[form_key] = [league_key, row['rank']]


def rollup(form_map):
    # 폼별 최고를 종 단위로 접는다. 즐겨찾기 목록은 종 단위(도감번호)라서 이 표를 본다.
    # 값에 폼 라벨을 함께 담아 "메가Y가 1위" 처럼 어느 폼 덕분인지 화면에 적을 수 있게 한다.
    by_dex = {}
    for form_key, (where, rank) in form_map.items():
        dex_number, _, label = form_key.partition('|')
        current = by_dex.get(dex_number)
        if current is None or rank < current[1]:
            by_dex[dex_number] = [where, rank, label]
    return by_dex


output = {
    'pve': pve_best,
    'pvp': pvp_best,
    'dexPve': rollup(pve_best),
    'dexPvp': rollup(pvp_best),
    'cut': {'pve': PVE_CUT, 'pvp': PVP_CUT},
}
json.dump(output, open(OUTPUT_PATH, 'w', encoding='utf-8'), ensure_ascii=False)
size_kb = os.path.getsize(OUTPUT_PATH) // 1024
print(f'roles: PvE {len(pve_best)}폼/{len(output["dexPve"])}종 · PvP {len(pvp_best)}폼/{len(output["dexPvp"])}종 · {size_kb}KB')
