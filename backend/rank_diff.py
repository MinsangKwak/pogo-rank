# rank_diff.py — 직전 빌드와 순위를 비교해 "▲3 · ▼5" 변동 표시를 만든다 (build.py 2차가 사용)
#
# 왜 필요한가
#   시즌마다 기술 위력이 조정되면 우리 티어표는 게임마스터를 다시 읽는 것만으로 저절로 바뀐다.
#   문제는 "무엇이 얼마나 움직였는지"를 사람이 알 수 없다는 것이다. 그래서 빌드마다 순위를
#   snapshot/ranks.json 에 남겨 두고, 다음 빌드에서 같은 자리끼리 비교해 변동 폭을 뽑는다.
#   손으로 "상향 예정" 같은 표시를 붙이지 않아도 모든 시즌에 계속 작동하는 게 이 방식의 이유다.
#
# 왜 스냅샷을 매번 덮어쓰지 않는가
#   같은 데이터로 하루에 여러 번 빌드하는 일이 잦다(화면만 고쳐서 다시 빌드 등).
#   그때마다 스냅샷을 갱신하면 순위가 실제로 바뀐 적이 없어도 변동 폭이 0으로 지워진다.
#   그래서 "순위가 실제로 달라졌을 때만" 스냅샷을 갱신하고, 그렇지 않으면 직전 변동을 그대로 유지한다.
#   즉 화면에 보이는 ▲▼ 는 "마지막으로 순위가 움직였을 때의 변동"이다.
#
# 왜 오래된 변동은 숨기는가
#   두 달 전 변동이 계속 붙어 있으면 표시의 뜻이 흐려진다. 기록한 날짜를 함께 남겨,
#   프론트가 FRESH_DAYS 안쪽일 때만 뱃지를 그린다.
#
# 입출력
#   snapshot/ranks.json       {표키: {스프라이트id: 순위}} — 직전 "순위가 바뀐 시점"의 순위
#   snapshot/rank_delta.json  {'date': 'YYYY-MM-DD', 'delta': {표키: {스프라이트id: 변동}}}
#     변동은 양수가 상승(순위 숫자가 작아짐), 음수가 하락이다.
#   두 파일 모두 저장소에 커밋된다(.github/workflows/deploy.yml). 커밋되지 않으면 CI 빌드마다
#   직전 순위를 잃어버려 변동이 영원히 비어 있게 된다.

import json
import os
from datetime import date

RANKS_PATH = 'snapshot/ranks.json'
DELTA_PATH = 'snapshot/rank_delta.json'

# 이 일수가 지난 변동은 프론트가 뱃지를 그리지 않는다 (프론트도 같은 값을 쓴다)
FRESH_DAYS = 14

# 이 계단 수 미만의 움직임은 기록하지 않는다.
# PvPoke 랭킹은 매일 조금씩 흔들려 ±1 계단은 늘 생긴다. 그걸 다 뱃지로 만들면
# "변동 표시"가 상시 표시가 돼 버려서 정작 시즌 조정 같은 큰 변화가 묻힌다.
MIN_MOVE = 2


def row_key(row):
    # 섀도우와 일반은 스프라이트 그림이 같아 id 도 같다. 스프라이트만으로 묶으면
    # "섀도우 뮤츠"의 변동이 "뮤츠"의 것으로 잘못 붙으므로 이름까지 합쳐 구분한다.
    return f"{row.get('sprite')}|{row.get('name')}"


def collect_ranks(tables):
    # tables: {표키: [행...]} — 행은 순위 순서대로 들어온 dict 이고 sprite·name 을 가진다
    # 같은 키가 한 표에 두 번 나오면(시트에 변형이 중복 등재된 경우) 먼저 나온 쪽이 그 표에서의 순위다
    ranks = {}
    for table_key, rows in tables.items():
        table = {}
        for index, row in enumerate(rows):
            table.setdefault(row_key(row), index + 1)
        ranks[table_key] = table
    return ranks


def apply(tables):
    """각 행에 'd'(변동 폭)를 붙이고 (변동 기록일, 변동이 있는 표 수)를 돌려준다.

    build.py 2차에서 모든 순위표가 메모리에 있을 때 한 번 호출한다."""
    ranks = collect_ranks(tables)
    previous = json.load(open(RANKS_PATH, encoding='utf-8')) if os.path.exists(RANKS_PATH) else None
    stored = json.load(open(DELTA_PATH, encoding='utf-8')) if os.path.exists(DELTA_PATH) else {}

    if previous is None:
        # 첫 빌드: 비교 대상이 없으므로 변동 없이 기준만 남긴다
        os.makedirs('snapshot', exist_ok=True)
        json.dump(ranks, open(RANKS_PATH, 'w', encoding='utf-8'), ensure_ascii=False)
        json.dump({'date': str(date.today()), 'delta': {}}, open(DELTA_PATH, 'w', encoding='utf-8'), ensure_ascii=False)
        return '', 0

    if ranks == previous:
        # 순위가 그대로면 직전 변동을 그대로 쓴다 (스냅샷도 건드리지 않는다)
        delta = stored.get('delta', {})
        _attach(tables, delta)
        return stored.get('date', ''), sum(1 for table in delta.values() if table)

    # 순위가 달라졌다: 같은 표·같은 스프라이트끼리만 비교한다.
    # 새로 들어온 항목(직전에 없던 스프라이트)은 비교 대상이 없으므로 변동을 만들지 않는다.
    delta = {}
    for table_key, table in ranks.items():
        previous_table = previous.get(table_key, {})
        moved = {}
        for key, rank in table.items():
            previous_rank = previous_table.get(key)
            if previous_rank is not None and abs(previous_rank - rank) >= MIN_MOVE:
                moved[key] = previous_rank - rank   # 양수 = 상승
        if moved:
            delta[table_key] = moved

    today = str(date.today())
    os.makedirs('snapshot', exist_ok=True)
    json.dump(ranks, open(RANKS_PATH, 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump({'date': today, 'delta': delta}, open(DELTA_PATH, 'w', encoding='utf-8'), ensure_ascii=False)
    _attach(tables, delta)
    return today, len(delta)


def _attach(tables, delta):
    # 행 dict 에 'd' 를 직접 심는다. 프론트의 row() 가 pokemon.d 하나만 보면 되도록 하기 위해서다
    # (표마다 다른 변동 값을 전역 표에서 다시 찾게 하면 뷰마다 표 키를 넘겨야 해서 번거롭다).
    for table_key, rows in tables.items():
        moved = delta.get(table_key, {})
        if not moved:
            continue
        for row in rows:
            change = moved.get(row_key(row))
            if change:
                row['d'] = change
