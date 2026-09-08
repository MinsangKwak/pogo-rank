# ─────────────────────────────────────────────────────────────────────────────
# gameday_build.py — ScrapedDuck(LeekDuck 스크랩) 원본을 화면이 바로 쓸 모양으로 굽는다 (2026-09-08 v2.25.0)
#
# 왜 필요한가
#   일정표(components/schedule.js)가 손으로 적은 데이터였다. 달이 바뀌면 사람이 새 달을 적어야 하고,
#   안 적으면 지난 달이 그대로 보인다. 레이드 보스 예정과 알 부화 풀은 아예 화면이 없었다.
#   ScrapedDuck 이 같은 저장소에서 셋을 다 주므로 한 번 받아 셋을 동시에 채운다.
#
# 무엇을 하나
#   원본은 영문 이름만 준다. 그림 주소(pm<번호>.f<폼>.icon.png)에서 번호와 폼 토큰을 뽑아
#   dex.json 의 한글 이름표와 names.py FORM_KO 로 한글 이름을 만든다.
#   ★ 한글 이름을 새로 짓지 않는다 — 실제 데이터에 있는 것만 쓰고, 없으면 그 항목을 버린다.
#
# 입력
#   data/sd_raids.json · sd_eggs.json · sd_events.json   fetch_data.sh 가 받은 원본 (없으면 그 갈래를 비운다)
#   data/dex.json                                        스프라이트 번호 → 한글 이름 (dex_build.py)
#
# 출력
#   data/gameday.json  { raids: {티어: [...]}, eggs: {거리: [...]}, events: [...], fetched }
#
# 관계
#   dex_build.py 뒤, sprites.py 앞에 돌린다 — 여기서 나온 sprite 번호도 스프라이트 수집 대상이라서다.
# ─────────────────────────────────────────────────────────────────────────────

import json
import os
import re
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from names import FORM_KO, normalize_form_token  # noqa: E402  폼 토큰 → 한글 라벨 (원본은 한 곳뿐)

OUT = 'data/gameday.json'

# 레이드 티어 표기: 원본 문자열 → 화면 라벨. 없는 티어가 새로 생기면 원문을 그대로 쓴다
RAID_TIERS = {
    '1-Star Raids': '1성',
    '3-Star Raids': '3성',
    '4-Star Raids': '4성',
    '5-Star Raids': '5성',
    'Mega Raids': '메가',
    'Shadow Raids': '섀도우',
    'Elite Raids': '엘리트',
    'Primal Raids': '원시',
}
# 화면에 보여 줄 순서 (원본 순서는 뒤죽박죽이다)
TIER_ORDER = ['5성', '원시', '메가', '엘리트', '섀도우', '4성', '3성', '1성']
EGG_ORDER = ['2km', '5km', '7km', '10km', '12km', '1km']

# 원본 날씨 표기(소문자, 공백 포함) → 한글. 모르는 값이 오면 그 항목을 버린다 —
# 영문이 한 단어라도 섞이면 화면이 반쪽짜리로 보인다
WEATHER_KO = {
    'sunny': '맑음', 'clear': '맑음', 'rainy': '비', 'partly cloudy': '구름조금',
    'cloudy': '흐림', 'windy': '바람', 'snow': '눈', 'fog': '안개',
}


def load(path):
    if not os.path.exists(path):
        return None
    try:
        return json.load(open(path, encoding='utf-8'))
    except Exception as e:
        print(f'  {path} 파싱 실패 — 건너뜀 ({e})')
        return None


# 그림 주소에서 스프라이트 번호와 폼 토큰을 뽑는다: .../pm149.fMEGA.icon.png → (149, 'mega')
def parse_image(url):
    match = re.search(r'/pm(\d+)((?:\.f[^./]+)*)\.icon', url or '')
    if not match:
        return None, ''
    form = match.group(2).replace('.f', ' ').strip().lower()
    return int(match.group(1)), form


# 한글 이름을 만든다. 종 이름은 반드시 dex 이름표에서 가져오고, 폼 라벨은 FORM_KO 에 있는 것만 붙인다.
# 이름표에 없는 번호면 None 을 돌려 그 항목을 통째로 버린다 (모르는 이름을 지어내지 않는다).
def korean_name(names, sprite_id, form_token, english):
    base = names.get(str(sprite_id))
    if not base:
        return None
    labels = []
    if english.startswith('Shadow '):
        labels.append('섀도우')
    if form_token:
        label = FORM_KO.get(normalize_form_token(form_token), '')
        if label:
            labels.append(label)
    return ' '.join(labels + [base])


def build_raids(raw, names):
    groups = {}
    for boss in raw or []:
        sprite_id, form = parse_image(boss.get('image'))
        if sprite_id is None:
            continue
        name = korean_name(names, sprite_id, form, boss.get('name', ''))
        if not name:
            continue
        tier = RAID_TIERS.get(boss.get('tier'), boss.get('tier') or '기타')
        combat = boss.get('combatPower') or {}
        groups.setdefault(tier, []).append({
            'sprite': sprite_id,
            'name': name,
            'shiny': bool(boss.get('canBeShiny')),
            'types': [t.get('name') for t in boss.get('types') or [] if t.get('name')],
            'cp': combat.get('normal') or {},
            'cpBoost': combat.get('boosted') or {},
            'weather': [WEATHER_KO[key] for key in ((w.get('name') or '').lower() for w in boss.get('boostedWeather') or []) if key in WEATHER_KO],
        })
    # 티어 순서를 화면 순서로 맞춘다. TIER_ORDER 에 없는 티어는 뒤에 원본 순서로 붙인다
    ordered = {tier: groups.pop(tier) for tier in TIER_ORDER if tier in groups}
    ordered.update(groups)
    return ordered


def build_eggs(raw, names):
    groups = {}
    for egg in raw or []:
        sprite_id, form = parse_image(egg.get('image'))
        if sprite_id is None:
            continue
        name = korean_name(names, sprite_id, form, egg.get('name', ''))
        if not name:
            continue
        distance = (egg.get('eggType') or '').replace(' ', '')
        combat = egg.get('combatPower') or {}
        groups.setdefault(distance, []).append({
            'sprite': sprite_id,
            'name': name,
            'shiny': bool(egg.get('canBeShiny')),
            'cp': combat,
            'regional': bool(egg.get('isRegional')),
            'sync': bool(egg.get('isAdventureSync')),   # 어드벤처 싱크 보상 알에서만 나온다
            'gift': bool(egg.get('isGiftExchange')),    # 선물로 받은 7km 알
        })
    ordered = {km: groups.pop(km) for km in EGG_ORDER if km in groups}
    ordered.update(groups)
    return ordered


# 이벤트는 원문이 영문이라 한글 일정표를 대신하지 못한다.
# 손으로 적은 달이 없을 때만 달력이 비지 않게 받쳐 주는 용도라, 제목은 원문 그대로 둔다.
def build_events(raw):
    events = []
    for item in raw or []:
        start, end = item.get('start'), item.get('end')
        if not start:
            continue
        events.append({
            'id': item.get('eventID'),
            'title': item.get('name'),      # 영문 원제 — 화면에서 "원문" 표시와 함께 보여 준다
            'heading': item.get('heading'),
            'type': item.get('eventType'),
            'start': start,
            'end': end or start,
        })
    events.sort(key=lambda e: e['start'])
    return events


def main():
    names = (load('data/dex.json') or {}).get('names') or {}
    if not names:
        print('gameday: dex.json 이름표가 없어 건너뜀 (dex_build.py 를 먼저 실행)')
        return
    raids = build_raids(load('data/sd_raids.json'), names)
    eggs = build_eggs(load('data/sd_eggs.json'), names)
    events = build_events(load('data/sd_events.json'))
    out = {
        'fetched': date.today().isoformat(),
        'raids': raids,
        'eggs': eggs,
        'events': events,
    }
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    raid_count = sum(len(v) for v in raids.values())
    egg_count = sum(len(v) for v in eggs.values())
    print(f'gameday: 레이드 {raid_count}종({len(raids)}티어) · 알 {egg_count}종({len(eggs)}거리) · 이벤트 {len(events)}건')


if __name__ == '__main__':
    main()
