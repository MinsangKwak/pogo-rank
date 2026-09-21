# ─────────────────────────────────────────────────────────────────────────────
# schedule_build.py — 월 일정표를 ScrapedDuck(LeekDuck 스크랩) 원본에서 굽는다 (2026-09-21 v4.7.0 WBS-224)
#
# 왜 필요한가
#   일정표(SCHEDULE_MONTHS)는 v2.13.0 이후로도 매달 사람이 적었다. 레이드 보스·알 부화는 v2.25.0 에
#   같은 원본으로 자동화됐고 sd_events.json 까지 이미 받아 두는데, 일정만 손에 남아 있었다.
#   안 적으면 달력이 비고, 이번 주 보스 카드도 서지 않는다.
#
# 무엇을 하나
#   sd_events.json 의 이벤트를 달별 { ym, note, items[{ s, e, cat, label, t, auto }] } 로 굽는다.
#   손으로 적은 표와 같은 모양이라 화면은 그대로다. 합치는 일은 frontend-v4/scripts/extract-data.mjs 가 한다 —
#   같은 분류·같은 날짜면 손으로 적은 한글이 이긴다.
#
# 한글 이름은 지어내지 않는다 (CLAUDE.md §3)
#   종 이름은 dex.json 이름표와 species_names.csv(영문 → 도감번호)에서만 온다. 폼 라벨은 names.py FORM_KO 에
#   있는 것만 붙인다. 이름을 못 찾는 이벤트(수확 축제 같은 일반 이벤트)는 **영문 원제를 그대로** 둔다 —
#   "무엇인지 모르는 한글" 보다 "무엇인지 아는 영문" 이 정직하다.
#
# 지난 일정은 스냅샷으로 남긴다
#   ScrapedDuck 은 끝난 이벤트를 지운다. 이 달 1일이 이미 지났다면 원본에 없다. snapshot/schedule_auto.json 에
#   본 적 있는 이벤트를 누적해 두고(운영 워크플로가 snapshot/ 을 커밋한다), 그것까지 합쳐 달을 채운다.
#
# 입력
#   data/sd_events.json          fetch_data.sh 가 받은 원본 (없으면 스냅샷만으로 굽는다)
#   data/dex.json                names(스프라이트 번호 → 한글) · forms(타입 — 맥스 먼데이 보스 속성)
#   data/species_names.csv       PokeAPI 종 이름표 (영문 = local_language_id 9)
#   snapshot/schedule_auto.json  누적된 이벤트 (없으면 새로 만든다)
#
# 출력
#   data/schedule.json           { fetched, months: { 'YYYY-MM': { ym, note, items } } }
#   snapshot/schedule_auto.json  { 'event id': 정규화한 이벤트 }
#
# 관계
#   dex_build.py 뒤에 돈다 (이름표·타입이 필요하다). gameday_build.py 와 같은 원본을 읽지만 서로 모른다.
# ─────────────────────────────────────────────────────────────────────────────

import csv
import json
import os
import re
import sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from names import FORM_KO, normalize_form_token  # noqa: E402

OUT = 'data/schedule.json'
SNAPSHOT = 'snapshot/schedule_auto.json'
# 이보다 오래 끝난 이벤트는 스냅샷에서 지운다 — 달력은 지난 몇 달만 보면 된다
KEEP_DAYS = 120

# 달력에 올리지 않는 유형 — 매주 도는 GO배틀리그 로테이션·패스·시즌은 일정이라기보다 상시 안내다
SKIP_TYPES = {'go-battle-league', 'go-pass', 'season'}

# 영문 폼 표기(괄호 안) → FORM_KO 키. 여기 없는 괄호는 라벨 없이 종 이름만 쓴다
FORM_IN_PAREN = {
    'incarnate forme': 'incarnate', 'therian forme': 'therian', 'origin forme': 'origin', 'altered forme': 'altered',
    'attack forme': 'attack', 'defense forme': 'defense', 'speed forme': 'speed',
    # 보스 목록(extraData)은 'Forme' 없이 적는다
    'incarnate': 'incarnate', 'therian': 'therian', 'origin': 'origin', 'altered': 'altered',
    'hero of many battles': 'hero', 'crowned sword': 'crownedsword', 'crowned shield': 'crownedshield',
    'alolan': 'alolan', 'galarian': 'galarian', 'hisuian': 'hisuian', 'paldean': 'paldean',
}
# 이름 앞에 붙는 영문 접두어 → FORM_KO 키. 'Mega Charizard X' 처럼 뒤에 X/Y 가 붙으면 megax/megay
PREFIX = {'Mega': 'mega', 'Shadow': 'shadow', 'Primal': 'primal', 'Gigantamax': 'gmax', 'Dynamax': 'dmax'}
# 이름 앞에 서는 라벨 — 나머지 폼은 뒤 괄호로 간다
FRONT_LABELS = {'메가', '메가X', '메가Y', '섀도우', '원시', '거다이맥스', '다이맥스', '알로라', '가라르', '히스이', '팔데아'}
# FORM_KO 에 없는 접두어의 한글 — 맥스 폼 라벨은 build.py 가 FORM_LABELS 에 같은 글자로 싣는다
PREFIX_KO = {'gmax': '거다이맥스', 'dmax': '다이맥스'}
# 스포트라이트 아워 보너스 — 원문이 몇 가지뿐이라 표로 둔다. 없는 문구는 붙이지 않는다
BONUS_KO = {
    '2× catch candy': '포획 사탕 2배', '2× catch stardust': '포획 별의모래 2배', '2× catch xp': '포획 XP 2배',
    '2× evolution xp': '진화 XP 2배', '2× transfer candy': '전송 사탕 2배',
}
MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
# 분류 순서 — 손으로 적은 표(components/schedule.js SCHEDULE_CATS)와 같다
CAT_ORDER = ['event', 'raid5', 'mega', 'dmax', 'hour', 'shadow']


def load_json(path):
    if not os.path.exists(path):
        return None
    try:
        return json.load(open(path, encoding='utf-8'))
    except Exception as error:
        print(f'  {path} 파싱 실패 — 건너뜀 ({error})')
        return None


def english_index(path='data/species_names.csv'):
    # 영문 종 이름(소문자) → 도감번호. 'Mr. Mime' 같은 구두점은 원문 그대로 맞춘다
    index = {}
    if not os.path.exists(path):
        return index
    for row in csv.DictReader(open(path, encoding='utf-8')):
        if row['local_language_id'] == '9':
            index[row['name'].lower()] = int(row['pokemon_species_id'])
    return index


class Namer:
    """영문 이름 한 조각 → 한글 이름. 못 찾으면 None (지어내지 않는다)"""

    def __init__(self, names, forms, english):
        self.names, self.forms, self.english = names, forms, english

    def parse(self, text):
        # 'Shadow Thundurus (Incarnate Forme)' → (['섀도우', '화신폼'], 642)
        labels, rest = [], text.strip()
        paren = re.search(r'\(([^)]*)\)\s*$', rest)
        if paren:
            rest = rest[:paren.start()].strip()
            key = FORM_IN_PAREN.get(paren.group(1).strip().lower())
            if key and FORM_KO.get(key):
                labels.append(FORM_KO[key])
        while True:
            head, _, tail = rest.partition(' ')
            if head not in PREFIX or not tail:
                break
            key = PREFIX[head]
            rest = tail
            # 'Mega Charizard X' — 종 이름 뒤의 X/Y 를 메가 쪽으로 끌어온다
            if key == 'mega' and re.search(r' [XY]$', rest):
                key, rest = 'mega' + rest[-1].lower(), rest[:-2]
            labels.append(PREFIX_KO.get(key) or FORM_KO.get(key, ''))
        # 'Alolan Raichu' 처럼 폼이 앞에 오는 리전 표기
        head, _, tail = rest.partition(' ')
        if head.lower() in FORM_IN_PAREN and tail:
            labels.append(FORM_KO[FORM_IN_PAREN[head.lower()]])
            rest = tail
        dex = self.english.get(rest.lower())
        if dex is None:
            return None, None
        return [label for label in labels if label], dex

    def korean(self, text):
        # 접두어(메가·섀도우·다이맥스)는 앞에, 폼(오리진폼·화신폼)은 손으로 적던 표처럼 뒤 괄호에 — '기라티나 (오리진폼)'
        labels, dex = self.parse(text)
        if dex is None:
            return None
        base = self.names.get(str(dex))
        if not base:
            return None
        front = [label for label in labels if label in FRONT_LABELS]
        back = [label for label in labels if label not in FRONT_LABELS]
        name = ' '.join(front + [base])
        return (f'{name} ({" ".join(back)})' if back else name), dex

    def type_of(self, dex):
        form = self.forms.get(str(dex)) or {}
        types = form.get('types') or []
        return types[0] if types else None


def split_names(text):
    # 'Articuno, Zapdos, and Moltres' → ['Articuno', 'Zapdos', 'Moltres']
    parts = re.split(r'\s*,\s*(?:and\s+)?|\s+and\s+', text)
    return [part.strip() for part in parts if part.strip()]


def join_ko(names):
    return ' · '.join(names)


def local_date(value):
    # '2026-09-21T06:00:00.000' 은 현지 시각(KST 기준 표기). 'Z' 가 붙은 것은 UTC 라 하루가 밀릴 수 있어 날짜만 쓴다
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace('Z', '')).date()
    except ValueError:
        return None


def normalize(item, namer):
    """원본 이벤트 하나 → { id, type, start, end, cat, label, t } 또는 None"""
    kind = item.get('eventType') or ''
    if kind in SKIP_TYPES:
        return None
    start, end = local_date(item.get('start')), local_date(item.get('end'))
    if not start:
        return None
    end = end or start
    name = (item.get('name') or '').strip()
    # LeekDuck 이 아직 이름을 못 붙인 자리표시자는 싣지 않는다
    if not name or set(name) <= set('?'):
        return None
    extra = item.get('extraData') or {}
    row = {'id': item.get('eventID') or name, 'type': kind, 'start': start.isoformat(), 'end': end.isoformat(), 'cat': 'event', 'label': name}

    if kind == 'raid-battles':
        bosses = [boss.get('name', '') for boss in (extra.get('raidbattles') or {}).get('bosses') or []]
        found = [namer.korean(boss) for boss in bosses]
        korean = [ko for ko, _ in found if ko] if all(found) and found else []
        if 'Shadow Raids' in name:
            # 보스 목록에는 'Shadow' 접두어가 없다 — 이벤트 이름이 섀도우 레이드라 하면 붙인다
            korean = [ko if ko.startswith('섀도우') else f'섀도우 {ko}' for ko in korean]
            row['cat'] = 'shadow'
            row['label'] = f'주말 섀도우 레이드: {join_ko(korean)}' if korean else name
        elif 'Mega Raids' in name:
            row['cat'] = 'mega'
            row['label'] = join_ko(korean) if korean else name
        elif '5-star' in name or '5-Star' in name:
            row['cat'] = 'raid5'
            row['label'] = join_ko(korean) if korean else name
        else:
            row['label'] = join_ko(korean) if korean else name
    elif kind == 'max-mondays':
        # 'Dynamax Sobble during Max Monday' — 그 주(월~일)의 보스로 적는다. 손으로 적던 표와 같은 뜻이다
        subject = re.sub(r'\s+during Max Monday$', '', name)
        found = [namer.korean(part) for part in split_names(subject)]
        korean = [ko for ko, _ in found if ko] if all(found) and found else []
        row['cat'] = 'dmax'
        row['end'] = (start + timedelta(days=6)).isoformat()
        if korean:
            # 'D-MAX ' 접두어는 weekBoss 가 떼어 읽는다. 라벨 안의 폼 접두어(다이맥스)는 D-MAX 와 겹쳐 뺀다
            plain = [re.sub(r'^다이맥스 ', '', ko) for ko in korean]
            row['label'] = f'D-MAX {join_ko(plain)} (맥스 먼데이 {start.month}/{start.day})'
            boss_type = namer.type_of(found[0][1])
            if boss_type:
                row['t'] = boss_type
        else:
            row['label'] = name
    elif kind == 'max-battles':
        subject = re.sub(r'\s+Max Battle Day$', '', name)
        korean = namer.korean(subject) if subject and subject != 'Dynamax' else None
        row['label'] = f'{korean[0]} 맥스 배틀 데이' if korean else '맥스 배틀 데이'
    elif kind == 'raid-hour':
        subject = re.sub(r'\s+Raid Hour$', '', name)
        found = [namer.korean(part) for part in split_names(subject)]
        korean = [ko for ko, _ in found if ko] if all(found) and found else []
        row['cat'] = 'hour'
        row['label'] = f'레이드 아워: {join_ko(korean)}' if korean else name
    elif kind == 'pokemon-spotlight-hour':
        spot = extra.get('spotlight') or {}
        korean = namer.korean(spot.get('name') or re.sub(r'\s+Spotlight Hour$', '', name))
        bonus = BONUS_KO.get((spot.get('bonus') or '').strip().lower())
        row['cat'] = 'hour'
        if korean:
            row['label'] = f'스포트라이트: {korean[0]}' + (f' — {bonus}' if bonus else '')
        else:
            row['label'] = name
    elif kind == 'community-day':
        spawns = [spawn.get('name', '') for spawn in (extra.get('communityday') or {}).get('spawns') or []]
        found = [namer.korean(spawn) for spawn in spawns]
        korean = [ko for ko, _ in found if ko] if all(found) and found else []
        month_name = re.match(r'^(January|February|March|April|May|June|July|August|September|October|November|December) Community Day$', name)
        if korean:
            row['label'] = f'커뮤니티 데이: {join_ko(korean)}'
        elif month_name:
            row['label'] = f'{MONTHS_EN.index(month_name.group(1)) + 1}월 커뮤니티 데이'
    elif kind == 'raid-day':
        match = re.match(r'^(.*?)\s*(Super Mega|Mega|Shadow)?\s*Raid Day$', name)
        korean = namer.korean(match.group(1)) if match and match.group(1) else None
        if match and (korean or not match.group(1)):
            grade = {'Super Mega': '슈퍼 메가 ', 'Mega': '메가 ', 'Shadow': '섀도우 '}.get(match.group(2) or '', '')
            row['label'] = f'{korean[0]} {grade}레이드 데이' if korean else f'{grade}레이드 데이'
    # 그 밖의 유형(event · research · wild-area …)은 영문 원제 그대로 — 한글을 지어내지 않는다
    return row


def month_slices(row):
    """이벤트 하나를 달별 (키, s, e) 로 자른다 — 달을 넘기는 일정은 달 안에서 끊어 적는다"""
    start, end = date.fromisoformat(row['start']), date.fromisoformat(row['end'])
    cursor = date(start.year, start.month, 1)
    while cursor <= end:
        next_month = date(cursor.year + (cursor.month == 12), cursor.month % 12 + 1, 1)
        last = next_month - timedelta(days=1)
        s = max(start, cursor).day
        e = min(end, last).day
        yield f'{cursor.year}-{cursor.month:02d}', s, e
        cursor = next_month


def build_months(rows, fetched):
    months = {}
    for row in rows.values():
        for key, s, e in month_slices(row):
            year, month = (int(part) for part in key.split('-'))
            bucket = months.setdefault(key, {
                'ym': {'y': year, 'm': month},
                'note': f'LeekDuck(ScrapedDuck) 자동 수집 · {fetched} 기준 · 한국 시간. 영문 제목은 한글 이름표에 없는 항목이에요.',
                'items': [],
            })
            # source 는 화면이 '공식 공지 ↗' 링크(href)로 그린다 — 자동분은 공지가 아니라 표식만 단다
            item = {'s': s, 'e': e, 'cat': row['cat'], 'label': row['label'], 'auto': True}
            if row.get('t'):
                item['t'] = row['t']
            bucket['items'].append(item)
    for bucket in months.values():
        bucket['items'].sort(key=lambda item: (CAT_ORDER.index(item['cat']) if item['cat'] in CAT_ORDER else 9, item['s'], item['e']))
    return dict(sorted(months.items()))


def merge_snapshot(previous, fresh, today):
    """본 적 있는 이벤트를 누적한다. 같은 id 는 새 값이 이기고, 오래 끝난 것은 지운다"""
    merged = dict(previous or {})
    merged.update(fresh)
    floor = (today - timedelta(days=KEEP_DAYS)).isoformat()
    # 지난 스냅샷에 남은 자리표시자('???')도 함께 거른다
    return {key: row for key, row in merged.items() if row.get('end', '') >= floor and not set(row.get('label', '')) <= set('?')}


def main():
    dex = load_json('data/dex.json') or {}
    names, forms = dex.get('names') or {}, dex.get('forms') or {}
    if not names:
        print('schedule: dex.json 이름표가 없어 건너뜀 (dex_build.py 를 먼저 실행)')
        return
    namer = Namer(names, forms, english_index())
    raw = load_json('data/sd_events.json') or []
    fresh = {}
    for item in raw:
        row = normalize(item, namer)
        if row:
            fresh[row['id']] = row
    today = date.today()
    rows = merge_snapshot(load_json(SNAPSHOT), fresh, today)
    os.makedirs('snapshot', exist_ok=True)
    json.dump(rows, open(SNAPSHOT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    months = build_months(rows, today.isoformat())
    json.dump({'fetched': today.isoformat(), 'months': months}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    english = sum(1 for bucket in months.values() for item in bucket['items'] if re.search(r'[A-Za-z]{3,}', item['label']) and not re.search(r'[가-힣]', item['label']))
    print(f'schedule: 원본 {len(raw)}건 → 정규화 {len(fresh)}건, 누적 {len(rows)}건, 달 {len(months)}개 ({", ".join(months)}), 영문 그대로 {english}건')


if __name__ == '__main__':
    main()
