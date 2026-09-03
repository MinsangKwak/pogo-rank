import json, csv, re, os
from sprite import sprite_id
from names import label_from_gm, released_dex

# 2026-09-03 PvPoke released는 PvP 사용 가능 기준이라 실출시 종(메타몽 등)이 빠짐 → 수동 보정 파일로 보완
extra_rel = set()
if os.path.exists('backend/config/dex_released_extra.txt'):
    for line in open('backend/config/dex_released_extra.txt', encoding='utf-8'):
        line = line.split('#')[0].strip()
        if line.isdigit(): extra_rel.add(int(line))

# 상세 팝업용 도감 데이터 → data/dex.json
# - chart: 타입 상성표 (공격타입 → 방어타입 → 배율)
# - dex: 스프라이트 id → 도감번호 (폼 스프라이트 포함)
# - names: 도감번호 → 한글 이름 (진화 계보 표시용)
# - evo: 도감번호 → 진화 단계 [[1단계 dex...], [2단계...], ...] (랭킹 등장 종의 가족만)
# - forms: 스프라이트 id → { types, atk, def, hp, fast[[한글, 엘리트]], charged[[한글, 엘리트]] }

TYPES = ['NORMAL','FIGHTING','FLYING','POISON','GROUND','ROCK','BUG','GHOST','STEEL','FIRE','WATER','GRASS','ELECTRIC','PSYCHIC','ICE','DRAGON','DARK','FAIRY']
TYPE_KO = {'normal':'노말','fire':'불꽃','water':'물','grass':'풀','electric':'전기','ice':'얼음','fighting':'격투','poison':'독','ground':'땅','flying':'비행','psychic':'에스퍼','bug':'벌레','rock':'바위','ghost':'고스트','dragon':'드래곤','dark':'악','steel':'강철','fairy':'페어리'}

gm = json.load(open('data/pm.json'))
eff = {}
for x in gm:
    if 'typeEffective' in x['data']:
        t = x['data']['typeEffective']
        eff[t['attackType'].replace('POKEMON_TYPE_','')] = t['attackScalar']
chart = {a.lower(): {TYPES[i].lower(): round(eff[a][i], 3) for i in range(len(TYPES))} for a in eff}

ko_species = {int(r['pokemon_species_id']): r['name'] for r in csv.DictReader(open('data/species_names.csv', encoding='utf-8')) if r['local_language_id']=='3'}
en_move, ko_move = {}, {}
for r in csv.DictReader(open('data/move_names.csv', encoding='utf-8')):
    if r['local_language_id']=='9': en_move[re.sub(r'[^a-z0-9]','',r['name'].lower())] = r['move_id']
    if r['local_language_id']=='3': ko_move[r['move_id']] = r['name']
def move_ko(mid):
    base = re.sub(r'_FAST$','',mid)
    m = re.match(r'^(.*)_(FIRE|WATER|ICE|ROCK|NORMAL)$', base)
    suffix = ''
    if m and base.startswith(('WEATHER_BALL','HIDDEN_POWER')):
        base, suffix = m.group(1), f"({TYPE_KO[m.group(2).lower()]})"
    ko = ko_move.get(en_move.get(re.sub(r'[^a-z0-9]','',base.lower())))
    return (ko + suffix) if ko else mid.replace('_',' ').title()

# 랭킹 데이터 전체에서 등장하는 스프라이트 id 수집
ids = set()
def collect(v):
    if isinstance(v, list):
        for x in v: collect(x)
    elif isinstance(v, dict):
        s = v.get('sprite')
        if isinstance(s, int) or (isinstance(s, str) and s.isdigit()): ids.add(int(s))
        for x in v.values(): collect(x)
for f in ('data/pvp.json', 'data/pve.json', 'data/pve_easy.json', 'data/dynamax.json', 'data/dynamax_tier.json', 'data/value.json', 'data/sheet.json'):
    if os.path.exists(f): collect(json.load(open(f, encoding='utf-8')))

# 스프라이트 id → 도감번호 (PokeAPI pokemon.csv)
sprite_dex = {}
for r in csv.DictReader(open('data/pokemon.csv', encoding='utf-8')):
    sprite_dex[int(r['id'])] = int(r['species_id'])
ranked_dex = {sprite_dex.get(i, i) for i in ids}
ids |= ranked_dex  # 폼 스프라이트의 기본 폼도 포함해 forms 폴백이 항상 가능하게
# 2026-09-03 도감 페이지용: 게임마스터에 종족값이 있는 전 종의 기본 폼을 포함
all_dex = {int(x['templateId'][1:5]) for x in gm
           if x['data'].get('pokemonSettings', {}).get('stats', {}).get('baseAttack')}
ids |= all_dex

# 진화 계보: evolution_chain_id 로 가족을 묶고 evolves_from 로 단계를 계산
chain_members, parent = {}, {}
for r in csv.DictReader(open('data/pokemon_species.csv', encoding='utf-8')):
    sid, chain = int(r['id']), int(r['evolution_chain_id'])
    chain_members.setdefault(chain, []).append(sid)
    if r['evolves_from_species_id']: parent[sid] = int(r['evolves_from_species_id'])

def depth(sid):
    d = 0
    while sid in parent: sid = parent[sid]; d += 1
    return d

evo, names = {}, {}
for chain, members in chain_members.items():
    if not (set(members) & ranked_dex): continue
    stages = {}
    for m in sorted(members): stages.setdefault(depth(m), []).append(m)
    family = [stages[d] for d in sorted(stages)]
    for m in members:
        evo[m] = family
        names[m] = ko_species.get(m, str(m))

# 폼별 상세 (랭킹에 등장하는 스프라이트만): 타입·종족값·배울 수 있는 기술
forms = {}
def put(sid, types, st, quick, elite_q, charged, elite_c):
    if sid not in ids or sid in forms: return
    forms[sid] = {
        'types': [t.lower() for t in types],
        'atk': st['baseAttack'], 'def': st['baseDefense'], 'hp': st['baseStamina'],
        'fast': [[move_ko(m), 1 if m in elite_q else 0] for m in quick],
        'charged': [[move_ko(m), 1 if m in elite_c else 0] for m in charged],
    }
for x in gm:
    ps = x['data'].get('pokemonSettings')
    if not ps or 'stats' not in ps or not ps['stats'].get('baseAttack'): continue
    dex = int(x['templateId'][1:5])
    form = ps.get('form','')
    if any(k in form for k in ('COPY','COSTUME','FALL_2019','_2020','_2021','_2022','_2023','_2024','_2025','NOEVOLVE','GOFEST','ADVENTURE','FASHION','HOLIDAY','SPRING','SUMMER','WINTER')): continue
    label = label_from_gm(ps['pokemonId'], form)
    if label is None: continue
    types = [t.replace('POKEMON_TYPE_','') for t in (ps.get('type'), ps.get('type2')) if t]
    elite_q, elite_c = set(ps.get('eliteQuickMove',[])), set(ps.get('eliteCinematicMove',[]))
    quick = [m for m in ps.get('quickMoves',[]) + ps.get('eliteQuickMove',[]) if isinstance(m,str)]
    charged = [c for c in ps.get('cinematicMoves',[]) + ps.get('eliteCinematicMove',[]) if isinstance(c,str) and c not in ('FRUSTRATION','RETURN')]
    if not quick or not charged: continue
    put(sprite_id(dex, label), types, ps['stats'], quick, elite_q, charged, elite_c)
    for te in ps.get('tempEvoOverrides',[]):
        if 'stats' not in te or 'tempEvoId' not in te: continue
        mega = te['tempEvoId'].replace('TEMP_EVOLUTION_','').replace('MEGA_','메가').replace('MEGA','메가').replace('PRIMAL','원시')
        mtypes = [t.replace('POKEMON_TYPE_','') for t in (te.get('typeOverride1'), te.get('typeOverride2')) if t] or types
        put(sprite_id(dex, f'{mega} {label}'.strip()), mtypes, te['stats'], quick, elite_q, charged, elite_c)

# 2026-09-03 도감 페이지용: 전 종 이름 보강 (진화 계보에 없던 종 포함)
for d in all_dex:
    names.setdefault(d, ko_species.get(d, str(d)))

# 2026-09-02 보스 티어 자동 판정용: 도감번호 → 클래스 (L 전설 / M 환상 / U 울트라비스트)
cls_map = {}
for x in gm:
    ps = x['data'].get('pokemonSettings', {})
    pc = ps.get('pokemonClass')
    if not pc: continue
    m = re.match(r'^V(\d{4})_POKEMON_', x['templateId'])
    if m: cls_map[str(int(m.group(1)))] = {'POKEMON_CLASS_LEGENDARY': 'L', 'POKEMON_CLASS_MYTHIC': 'M', 'POKEMON_CLASS_ULTRA_BEAST': 'U'}[pc]

# 2026-09-02 CP 계산용 CP 배율 (만렙 50 · 야생 최대 30 · 날씨부스트 최대 35)
cpm_arr = [x for x in gm if 'playerLevel' in x['data']][0]['data']['playerLevel']['cpMultiplier']
cpm = {'l30': cpm_arr[29], 'l35': cpm_arr[34], 'l50': cpm_arr[49]}
cpms = [round(x, 6) for x in cpm_arr[:51]]  # CP 계산기: 레벨 n = 인덱스 n-1, 반레벨은 프론트에서 보간

out = {'chart': chart, 'cpm': cpm, 'cpms': cpms, 'dex': {str(i): sprite_dex[i] for i in ids if i in sprite_dex and sprite_dex[i] != i},
       'names': names, 'evo': {str(k): v for k, v in evo.items()}, 'forms': {str(k): v for k, v in forms.items()},
       'cls': cls_map,
       'rel': sorted(released_dex | extra_rel)}  # 2026-09-03 도감 [미구현] 태그용 — PvPoke released + 수동 보정
json.dump(out, open('data/dex.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('dex.json:', len(evo), 'evo species /', len(forms), 'forms /', len(ids), 'sprites referenced')
