import json, re, csv
from sprite import sprite_id, gmax_sprite_id
ko_species = {int(r['pokemon_species_id']): r['name'] for r in csv.DictReader(open('data/species_names.csv', encoding='utf-8')) if r['local_language_id']=='3'}
# 다이맥스/거다이맥스 랭킹과 가성비 티어를 계산한다
TYPES = ['NORMAL','FIGHTING','FLYING','POISON','GROUND','ROCK','BUG','GHOST','STEEL','FIRE','WATER','GRASS','ELECTRIC','PSYCHIC','ICE','DRAGON','DARK','FAIRY']
BOSS_DEF, STAB = 200.0, 1.2
# 맥스 기술 위력: 게임마스터에 없어 공개 수치를 상수로 둔다 (레벨 3 기준)
MAX_ATTACK_POWER, GMAX_POWER = 350, 450
TOP = 30

gm = json.load(open('data/pm.json'))
T = {x['templateId']: x['data'] for x in gm}
moves = {x['data']['moveSettings']['movementId']: x['data']['moveSettings'] for x in gm if 'moveSettings' in x['data']}
eff = {}
for x in gm:
    if 'typeEffective' in x['data']:
        t = x['data']['typeEffective']; eff[t['attackType'].replace('POKEMON_TYPE_','')] = t['attackScalar']
def type_mult(atk, def_types):
    r = 1.0
    for t in def_types: r *= eff[atk][TYPES.index(t)]
    return r

full = json.load(open('data/pve_full.json', encoding='utf-8'))
meta, scores = full['meta'], full['scores']

# ---------- 다이맥스 ----------
# 출시 목록은 검증된 외부 소스(max_released.txt)를 따르고, 거다이맥스 기술 타입만 게임마스터에서 읽는다
dyna, gmax_ok = set(), set()
for line in open('backend/config/max_released.txt', encoding='utf-8'):
    line = line.split('#')[0].strip()
    if not line: continue
    kind, pid, *form = line.split()
    (dyna if kind == 'D' else gmax_ok).add((pid, form[0] if form else None))
gmax = {}
for m in T['SOURDOUGH_MOVE_MAPPING_SETTINGS']['sourdoughMoveMappingSettings']['mappings']:
    gmax[(m['pokemonId'], m.get('form'))] = moves[m['move']]['pokemonType'].replace('POKEMON_TYPE_','')

def in_set(st, pid, form):
    form = form or None
    return (pid, form) in st or (pid, None) in st or (pid, f'{pid}_NORMAL') in st or (form is None and any(p == pid for p, _ in st))
def is_dyna(pid, form): return in_set(dyna, pid, form)
def gmax_type(pid, form):
    if not in_set(gmax_ok, pid, form): return None
    return gmax.get((pid, form or None)) or gmax.get((pid, None)) or gmax.get((pid, f'{pid}_NORMAL')) or next((t for (p, _), t in gmax.items() if p == pid), None)

def damage(power, atk, mult):
    return int(0.5 * power * (atk / BOSS_DEF) * mult) + 1

base_meta = {k: m for k, m in meta.items() if not re.search('섀도우|메가|원시', m['name'])}
def dyna_rank(boss_types, limit=TOP):
    out = []
    for k, m in base_meta.items():
        if m['form'] and m['form'].endswith('_S'): continue
        gt = gmax_type(m['pid'], m['form'])
        if not is_dyna(m['pid'], m['form']) and not gt: continue
        own = [t.upper() for t in m['types']]
        # 맥스어택 타입 = 보유 스피드기 타입 중 최선
        best = None
        for q in (m['quick'] if is_dyna(m['pid'], m['form']) else []):
            mv = moves.get(q)
            if not mv: continue
            t = mv['pokemonType'].replace('POKEMON_TYPE_','')
            d = damage(MAX_ATTACK_POWER, m['atk'], (STAB if t in own else 1) * type_mult(t, boss_types))
            if not best or d > best[0]: best = (d, t, '맥스어택')
        if gt:
            d = damage(GMAX_POWER, m['atk'], (STAB if gt in own else 1) * type_mult(gt, boss_types))
            if not best or d > best[0]: best = (d, gt, '거다이맥스')
        if not best: continue
        bulk = m['def'] * m['hp'] / 1000
        score = best[0] * bulk ** 0.5
        out.append({'sprite': gmax_sprite_id(m['dex'], m['form']) if best[2] == '거다이맥스' else m['sprite'], 'name': m['name'], 'en': m['en'], 'types': m['types'],
                    'fast': best[2], 'charged': f"{best[1].lower()}", 'dmg': best[0], 'bulk': round(bulk), 'score': round(score), 'gmax': best[2] == '거다이맥스'})
    out.sort(key=lambda r: -r['score'])
    return out[:limit] if limit else out
dmax = {'overall': dyna_rank([])}
for t in TYPES: dmax[t.lower()] = dyna_rank([t])
json.dump(dmax, open('data/dynamax.json','w'), ensure_ascii=False)

# ---------- 다이맥스 티어표: 속성 탭 = 그 속성 포켓몬만 ----------
# 2026-09-02 pogomate 기준으로 변경: 공격 종족값 × 맥스무브 위력(거다이 450·다이 350) × 자속 1.2
# 내구 미반영, 같은 종의 다이맥스/거다이맥스는 별도 행 (pogomate 수치 역산으로 검증)
def rel_tier(lst):
    # 목록 안 상대 등급
    for i, r in enumerate(lst):
        f = i / len(lst)
        r['tier'] = 'S' if f < 0.12 else 'A' if f < 0.35 else 'B' if f < 0.65 else 'C'

def tier_rows():
    # 2026-09-03 pogomate 대조 보정 2: 이중 자속(예: 연격 우라오스 물·격투)은 자속 타입마다 행 생성
    # — 각 타입 탭에 그 타입 맥스무브 딜러로 올라간다. 자속 스피드기가 없으면 최고 타입 1행만
    out = []
    for k, m in base_meta.items():
        if m['form'] and m['form'].endswith('_S'): continue
        own = [t.upper() for t in m['types']]
        gt = gmax_type(m['pid'], m['form'])
        if is_dyna(m['pid'], m['form']):
            atk = round(m['atk'])
            move_types = set()
            for q in m['quick']:
                mv = moves.get(q)
                if mv: move_types.add(mv['pokemonType'].replace('POKEMON_TYPE_',''))
            stab = [t for t in own if t in move_types]
            targets = stab or (sorted(move_types)[:1] if move_types else [])
            for t in targets:
                sc = atk * 350 * (1.2 if t in own else 1)
                out.append({'sprite': m['sprite'], 'name': m['name'], 'en': m['en'], 'types': m['types'],
                            'fast': '맥스어택', 'charged': t.lower(), 'atk': atk, 'power': 350,
                            'stab': t in own, 'score': round(sc), 'gmax': False})
        if gt:
            atk = round(m['atk'])
            sc = atk * 450 * (1.2 if gt in own else 1)
            out.append({'sprite': gmax_sprite_id(m['dex'], m['form']), 'name': m['name'], 'en': m['en'], 'types': m['types'],
                        'fast': '거다이맥스', 'charged': gt.lower(), 'atk': atk, 'power': 450,
                        'stab': gt in own, 'score': round(sc), 'gmax': True})
    out.sort(key=lambda r: -r['score'])
    return out

dmax_all = tier_rows()
dmax_tier = {}
# 2026-09-03 pogomate 대조 보정: 타입 탭 분류를 "그 타입 보유"가 아니라 "그 타입 맥스무브로 때리는 딜러"로
# (할비롱이 드래곤 무브 점수로 노말 탭에 오르던 문제 — pogomate는 무브 타입 기준)
for key, tf in [('overall', None)] + [(t.lower(), t.lower()) for t in TYPES]:
    if tf is None:
        seen_o, rows = set(), []
        for r in dmax_all:
            k2 = (r['name'], r['gmax'])
            if k2 in seen_o: continue
            seen_o.add(k2); rows.append(dict(r))
            if len(rows) >= TOP: break
    else:
        rows = [dict(r) for r in dmax_all if r['charged'] == tf][:TOP]
    if not rows: continue
    rel_tier(rows)
    dmax_tier[key] = rows
json.dump(dmax_tier, open('data/dynamax_tier.json','w'), ensure_ascii=False)
print('dynamax eligible:', sum(1 for m in base_meta.values() if is_dyna(m['pid'], m['form'])), 'gmax:', sum(1 for m in base_meta.values() if gmax_type(m['pid'], m['form'])))

# ---------- 가성비 ----------
# 전설·환상·UB·메가·섀도우 제외, 여러 리그(PvP)와 여러 보스(PvE)에서 동시에 상위인 포켓몬
pv = json.load(open('data/gm.json'))
rare = set()
for p in pv['pokemon']:
    if any(t in p.get('tags', []) for t in ('legendary','mythical','ultrabeast')): rare.add(p['dex'])
pv_species = {p['speciesId']: p for p in pv['pokemon']}

# PvP: 리그별 최고 점수(섀도우 제외), 전체 랭킹 파일 사용
pvp_best = {}
for cp, lid in [(500,'little'),(1500,'great'),(2500,'ultra'),(10000,'master')]:
    for e in json.load(open(f'data/r{cp}.json')):
        sid = e['speciesId']
        if sid.endswith('_shadow') or '_mega' in sid: continue
        dex = pv_species[sid]['dex']
        if dex in rare: continue
        d = pvp_best.setdefault(dex, {})
        if e['score'] > d.get(lid, (0,))[0]: d[lid] = (e['score'], sid)

# PvE: 보스 타입별 최강 대비 비율(%)
tops = {b: max(v.values()) for b, v in scores.items()}
pve_best = {}
for k, m in base_meta.items():
    if m['dex'] in rare: continue
    ratios = {b: (scores[b][k] / tops[b]) ** 0.25 * 100 for b in scores if k in scores[b]}
    if not ratios: continue
    top3 = sorted(ratios.values(), reverse=True)[:3]
    d = pve_best.setdefault(m['dex'], {'value': 0})
    v = sum(top3) / len(top3)
    if v > d['value']:
        best_boss = max(ratios, key=ratios.get)
        d.update({'value': v, 'key': k, 'best_boss': best_boss, 'best_ratio': ratios[best_boss]})

LEAGUE_KO = {'little':'리틀','great':'슈퍼','ultra':'하이퍼','master':'마스터'}
def tier(v): return 'S' if v >= 90 else 'A' if v >= 80 else 'B' if v >= 70 else 'C'
pvp_list, pve_list, both = [], [], []
for dex in set(pvp_best) | set(pve_best):
    pb = pvp_best.get(dex, {}); eb = pve_best.get(dex)
    if eb and 'key' not in eb: eb = None
    if not pb and not eb: continue
    pvp_v = sorted((s for s, _ in pb.values()), reverse=True)[:2]
    pvp_v = sum(pvp_v) / 2 if len(pvp_v) == 2 else (pvp_v[0] * 0.8 if pvp_v else 0)
    pve_v = eb['value'] if eb else 0
    # 대표 엔트리: PvE 메타 우선(스프라이트·타입 보유), 없으면 PvP
    if eb: m = meta[eb['key']]; name, en, sprite, types = m['name'], m['en'], m['sprite'], m['types']
    else:
        sid = next(iter(pb.values()))[1]; sp = pv_species[sid]
        name, en, sprite, types = ko_species.get(dex, sp['speciesName']), sp['speciesName'], sprite_id(dex, ''), [t for t in sp['types'] if t != 'none']
    leagues = ' · '.join(f"{LEAGUE_KO[l]} {pb[l][0]:.0f}" for l in ('little','great','ultra','master') if l in pb and pb[l][0] >= 70)
    row = {'sprite': sprite, 'name': name, 'en': en, 'types': types, 'pvp': round(pvp_v, 1), 'pve': round(pve_v, 1),
           'leagues': leagues or '', 'boss_type': eb['best_boss'] if eb else '', 'boss_ratio': round(eb['best_ratio']) if eb else 0}
    if pvp_v >= 70: pvp_list.append({**row, 'value': round(pvp_v, 1), 'tier': tier(pvp_v)})
    if pve_v >= 60: pve_list.append({**row, 'value': round(pve_v, 1), 'tier': tier(pve_v)})
    if pvp_v >= 70 and pve_v >= 60:
        v = (pvp_v + pve_v) / 2; both.append({**row, 'value': round(v, 1), 'tier': tier(v)})
for l in (pvp_list, pve_list, both): l.sort(key=lambda r: -r['value'])
# 일반 티어표(pvp·pve)의 티어는 절대 점수가 아니라 목록 안 상대 등급으로 매긴다
# (전설·메가를 뺀 PvE 일반은 절대 기준으로는 S·A가 아예 없어 티어표가 성립하지 않음)
def rel_tier(lst):
    for i, r in enumerate(lst):
        f = i / len(lst)
        r['tier'] = 'S' if f < 0.12 else 'A' if f < 0.35 else 'B' if f < 0.65 else 'C'
# pve는 진입 조건(60점)을 넘는 일반 개체 전부, pvp는 상위 60종
pvp_cut = pvp_list[:60]
rel_tier(pvp_cut); rel_tier(pve_list)
json.dump({'pvp': pvp_cut, 'pve': pve_list, 'both': both[:40]}, open('data/value.json','w'), ensure_ascii=False)
print('value:', len(pvp_list), len(pve_list), len(both))

print([(r['name'], r['fast'], r['charged'], r['score']) for r in dmax['overall'][:8]])

# ---------- 활용처: 포켓몬별로 상위권에 드는 곳을 모은다 (전설 포함) ----------
USE_TOP = 30
usage = {}
def add(name, sprite, en, types, place, rank):
    u = usage.setdefault(name, {'name': name, 'sprite': sprite, 'en': en, 'types': types, 'places': []})
    u['places'].append({'place': place, 'rank': rank})
pvp_all = json.load(open('data/pvp_all.json', encoding='utf-8'))
for lid, rows in pvp_all.items():
    for r in rows[:USE_TOP]: add(r['name'], r['sprite'], r['en'], r['types'], f"pvp:{lid}", r['rank'])
for boss, sc in scores.items():
    for i, (k, _) in enumerate(sorted(sc.items(), key=lambda kv: -kv[1])[:USE_TOP]):
        m = meta[k]; add(m['name'], m['sprite'], m['en'], m['types'], f"pve:{boss}", i + 1)
for boss, rows in dmax.items():
    for i, r in enumerate(rows[:USE_TOP]): add(r['name'], r['sprite'], r['en'], r['types'], f"max:{boss}", i + 1)
use_list = []
for u in usage.values():
    u['places'].sort(key=lambda p: p['rank'])
    # 점수: 상위권일수록 크게, 여러 곳일수록 크게
    u['score'] = sum(USE_TOP + 1 - p['rank'] for p in u['places'])
    u['count'] = len(u['places'])
    use_list.append(u)
use_list.sort(key=lambda u: (-u['score'], -u['count']))
v = json.load(open('data/value.json', encoding='utf-8'))
v['usage'] = use_list[:80]
json.dump(v, open('data/value.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('usage:', len(use_list), [(u['name'], u['count']) for u in use_list[:6]])
