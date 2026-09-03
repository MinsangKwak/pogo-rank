import json, csv, re
from sprite import sprite_id
from names import released_names, label_from_gm
from collections import Counter

TYPES = ['NORMAL','FIGHTING','FLYING','POISON','GROUND','ROCK','BUG','GHOST','STEEL','FIRE','WATER','GRASS','ELECTRIC','PSYCHIC','ICE','DRAGON','DARK','FAIRY']
TYPE_KO = {'normal':'노말','fire':'불꽃','water':'물','grass':'풀','electric':'전기','ice':'얼음','fighting':'격투','poison':'독','ground':'땅','flying':'비행','psychic':'에스퍼','bug':'벌레','rock':'바위','ghost':'고스트','dragon':'드래곤','dark':'악','steel':'강철','fairy':'페어리'}
LEVEL_IDX, IV = 39, 15
BOSS_DEF, BOSS_DPS = 200.0, 30.0
STAB, SHADOW_ATK, SHADOW_DEF = 1.2, 1.2, 0.8333
TOP = 30

gm = json.load(open('data/pm.json'))
cpm = [x for x in gm if 'playerLevel' in x['data']][0]['data']['playerLevel']['cpMultiplier'][LEVEL_IDX]
eff = {}
for x in gm:
    if 'typeEffective' in x['data']:
        t = x['data']['typeEffective']
        eff[t['attackType'].replace('POKEMON_TYPE_','')] = t['attackScalar']
moves = {x['data']['moveSettings']['movementId']: x['data']['moveSettings'] for x in gm if 'moveSettings' in x['data']}

# PvPoke released 목록으로 미출시 포켓몬 제외 (도감번호 기준)
pv = json.load(open('data/gm.json'))
released_dex = {p['dex'] for p in pv['pokemon'] if p.get('released')}
# 일반 티어표용: 전설·환상·울트라비스트 도감번호
rare_dex = {p['dex'] for p in pv['pokemon'] if any(t in p.get('tags', []) for t in ('legendary', 'mythical', 'ultrabeast'))}

# 한글 이름
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
    return (ko + suffix) if ko else mid

def type_mult(atk, def_types):
    r = 1.0
    for t in def_types: r *= eff[atk][TYPES.index(t)]
    return r

def damage(power, atk, dfn, mult):
    return int(0.5 * power * (atk / dfn) * mult) + 1

def best_dps(atk, own_types, quick, charged, boss_types):
    best = None
    for q in quick:
        fm = moves.get(q)
        if not fm or fm.get('energyDelta',0) <= 0: continue
        for c in charged:
            cm = moves.get(c)
            if not cm or 'energyDelta' not in cm or 'power' not in cm or 'power' not in fm: continue
            ft, ct = fm['pokemonType'].replace('POKEMON_TYPE_',''), cm['pokemonType'].replace('POKEMON_TYPE_','')
            fmult = (STAB if ft in own_types else 1) * type_mult(ft, boss_types)
            cmult = (STAB if ct in own_types else 1) * type_mult(ct, boss_types)
            fd, cd = damage(fm['power'], atk, BOSS_DEF, fmult), damage(cm['power'], atk, BOSS_DEF, cmult)
            n = -(-abs(cm['energyDelta']) // fm['energyDelta'])
            dps = (fd*n + cd) / ((fm['durationMs']*n + cm['durationMs'])/1000)
            if not best or dps > best[0]: best = (dps, q, c)
    return best

# 후보 목록 구성 (일반 / 섀도우 / 메가), 중복 폼 제거
seen, cands, dropped, bosses = set(), [], [], []
for x in gm:
    ps = x['data'].get('pokemonSettings')
    if not ps or 'stats' not in ps or not ps['stats'].get('baseAttack'): continue
    dex = int(x['templateId'][1:5])
    if dex not in released_dex: continue
    form = ps.get('form','')
    if form.endswith('_S') and ps['pokemonId'] not in ('HO_OH','LUGIA'): continue
    if any(k in form for k in ('ETERNAMAX','SHADOW','PURIFIED','COPY','COSTUME','FALL_2019','_2020','_2021','_2022','_2023','_2024','_2025','NOEVOLVE','GOFEST','ADVENTURE','FASHION','HOLIDAY','SPRING','SUMMER','WINTER')): continue
    types = [t.replace('POKEMON_TYPE_','') for t in (ps.get('type'), ps.get('type2')) if t]
    quick = [m for m in ps.get('quickMoves',[]) + ps.get('eliteQuickMove',[]) if isinstance(m,str)]
    charged = [c for c in ps.get('cinematicMoves',[]) + ps.get('eliteCinematicMove',[]) if isinstance(c,str) and c not in ('FRUSTRATION','RETURN')]
    if not quick or not charged: continue
    label = label_from_gm(ps['pokemonId'], form)
    if label is None: continue
    base_ko = ko_species.get(dex, ps['pokemonId'].title())
    variants = [(label, ps['stats'], types, 1.0, 1.0)]
    if 'shadow' in ps: variants.append((f'섀도우 {label}'.strip(), ps['stats'], types, SHADOW_ATK, SHADOW_DEF))
    for te in ps.get('tempEvoOverrides',[]):
        if 'stats' not in te: continue
        mega = te['tempEvoId'].replace('TEMP_EVOLUTION_','').replace('MEGA_','메가').replace('MEGA','메가').replace('PRIMAL','원시')
        mtypes = [t.replace('POKEMON_TYPE_','') for t in (te.get('typeOverride1'), te.get('typeOverride2')) if t] or types
        variants.append((f'{mega} {label}'.strip(), te['stats'], mtypes, 1.0, 1.0))
    for lbl, st, ty, am, dm in variants:
        # PvPoke 출시 목록에 없는 이름(미출시 메가·폼·섀도우)은 제외
        if f'{lbl} {base_ko}'.strip() not in released_names:
            dropped.append(f'{lbl} {base_ko}'.strip()); continue
        sig = (dex, lbl, st['baseAttack'], st['baseDefense'], tuple(ty), tuple(sorted(quick)), tuple(sorted(charged)))
        if sig in seen: continue
        seen.add(sig)
        # 2026-09-02 솔플 계산기 보스 검색용: 출시된 전 종(메가·폼 포함) 이름·타입·종족값
        bosses.append({'name': f'{lbl} {base_ko}'.strip(), 'sprite': sprite_id(dex, lbl), 'types': [t.lower() for t in ty], 'ba': st['baseAttack'], 'bd': st['baseDefense'], 'bs': st['baseStamina']})
        cands.append({'form': form, 'pid': ps['pokemonId'], 'key': f'{dex}|{lbl}', 'sprite': sprite_id(dex, lbl), 'name': f'{lbl} {base_ko}'.strip(), 'en': (lbl and lbl+' ' or '')+ps['pokemonId'].title(), 'dex': dex,
                      'atk': (st['baseAttack']+IV)*cpm*am, 'def': (st['baseDefense']+IV)*cpm*dm, 'hp': int((st['baseStamina']+IV)*cpm),
                      'types': ty, 'quick': quick, 'charged': charged})

def rank_for(boss_types, full=None, pool=None):
    out = []
    for c in (pool if pool is not None else cands):
        b = best_dps(c['atk'], c['types'], c['quick'], c['charged'], boss_types)
        if not b: continue
        dps, q, ch = b
        ttf = c['hp'] / (BOSS_DPS * (100/c['def']))
        tdo = dps * ttf
        if full is not None: full[c['key']] = round(dps**3*tdo/1000)
        out.append({'sprite': c['sprite'], 'name': c['name'], 'en': c['en'], 'types': [t.lower() for t in c['types']], 'fast': move_ko(q), 'charged': move_ko(ch),
                    'dps': round(dps,1), 'tdo': round(tdo), 'score': round(dps**3*tdo/1000)})
    out.sort(key=lambda r: -r['score'])
    return out[:TOP]

full = {}
pve = {'overall': rank_for([], full.setdefault('overall', {}))}
for t in TYPES: pve[t.lower()] = rank_for([t], full.setdefault(t.lower(), {}))
json.dump(pve, open('data/pve.json','w'), ensure_ascii=False)

# ---------- PvE 일반: 전설·환상·UB·메가·섀도우를 뺀 티어표 ----------
# 속성 탭 = 그 속성 포켓몬만 모아 정렬 (기술 제한 없이 최적 조합, 중립 보스 상대)
easy_keys = {c['key'] for c in cands if c['dex'] not in rare_dex and not re.match(r'^(섀도우|메가|원시)', c['name'])}
def rel_tier(lst):
    # 티어는 목록 안 상대 등급 (일반 개체만으로는 절대 기준 S·A가 성립하지 않음)
    for i, r in enumerate(lst):
        f = i / len(lst)
        r['tier'] = 'S' if f < 0.12 else 'A' if f < 0.35 else 'B' if f < 0.65 else 'C'
def rank_neutral(pool):
    out = []
    for c in pool:
        b = best_dps(c['atk'], c['types'], c['quick'], c['charged'], [])
        if not b: continue
        dps, q, ch = b
        tdo = dps * (c['hp'] / (BOSS_DPS * (100/c['def'])))
        out.append({'key': c['key'], 'sprite': c['sprite'], 'name': c['name'], 'en': c['en'], 'types': [t.lower() for t in c['types']],
                    'fast': move_ko(q), 'charged': move_ko(ch), 'dps': round(dps,1), 'tdo': round(tdo), 'score': round(dps**3*tdo/1000)})
    out.sort(key=lambda r: -r['score'])
    return out
pve_easy = {}
for key, tfilter in [('overall', None)] + [(t.lower(), t) for t in TYPES]:
    pool = cands if tfilter is None else [c for c in cands if tfilter in c['types']]
    rows_all = rank_neutral(pool)
    if not rows_all: continue
    top_all = rows_all[0]['score']  # 같은 속성 최강(전설·메가 포함) 대비 %
    rows = [r for r in rows_all if r['key'] in easy_keys][:TOP]
    for r in rows:
        r['ratio'] = round((r['score'] / top_all) ** 0.25 * 100)
        del r['key']
    rel_tier(rows)
    pve_easy[key] = rows
json.dump(pve_easy, open('data/pve_easy.json','w'), ensure_ascii=False)
meta = {c['key']: {'name': c['name'], 'en': c['en'], 'dex': c['dex'], 'sprite': c['sprite'], 'types': [t.lower() for t in c['types']],
                   'atk': c['atk'], 'def': c['def'], 'hp': c['hp'], 'quick': c['quick'], 'form': c['form'], 'pid': c['pid']} for c in cands}
json.dump({'meta': meta, 'scores': full}, open('data/pve_full.json','w'), ensure_ascii=False)
json.dump(bosses, open('data/bosses.json','w'), ensure_ascii=False)  # 2026-09-02 보스 검색 목록
print(len(cands), 'candidates;', len(dropped), 'dropped (not released in PvPoke), e.g.', dropped[:12])
for k in ('overall','dragon','water'):
    print(k, [(r['name'], r['fast'], r['charged'], r['dps']) for r in pve[k][:6]])
bad = {m for k in pve for r in pve[k] for m in (r['fast'], r['charged']) if re.search('[A-Z_]', m)}
print('unmatched moves:', bad)
print('english names:', {r['name'] for k in pve for r in pve[k] if re.search('[a-z]', r['name'])})
