# ---------------------------------------------------------------------------
# PvE(레이드) 딜러 랭킹 빌더
#
# 무엇을 계산하나
#   게임마스터의 종족값·기술·상성 데이터로 "레이드에서 얼마나 좋은 공격수인가"를
#   점수화해서 보스 속성별 상위 랭킹을 만든다. 점수의 두 축은
#     - DPS (Damage Per Second, 초당 피해량)
#     - TDO (Total Damage Output, 쓰러지기 전까지 누적으로 넣는 총 피해량)
#   이고, 최종 점수는 이 둘을 합성한 값이다 (아래 SCORE 설명 참조).
#
# 입력 (앞 단계 스크립트가 data/ 에 내려받아 둔다)
#   data/pm.json            포켓몬고 게임마스터 덤프 (종족값·기술·상성표·CPM 표)
#   data/gm.json            PvPoke 게임마스터 (released 여부, legendary 등 태그)
#   data/species_names.csv  PokeAPI 종 이름 (한국어 = local_language_id 3)
#   data/move_names.csv     PokeAPI 기술 이름 (영어 9 / 한국어 3)
#   backend/names.py        폼 한글 라벨, 출시된 종의 한글 이름 집합
#   backend/sprite.py       도감번호+폼 라벨 → PokeAPI 스프라이트 id
#
# 출력
#   data/pve.json       {'overall' | 보스속성: [상위 TOP개 행]}
#                       행 키: sprite, name, en, types, fast, charged, dps, tdo, score
#   data/pve_easy.json  같은 구조의 "일반" 티어표. 전설·환상·울트라비스트·메가·섀도우를
#                       뺀 목록이며 행에 ratio(같은 속성 최강 대비 %)와 tier(S/A/B/C)가 더 붙는다
#   data/pve_full.json  {'meta': {개체키: 개체정보}, 'scores': {보스속성: {개체키: 점수}}}
#                       — value_build.py 가 가성비·활용처 계산에 그대로 읽어 쓴다
#   data/bosses.json    솔플 계산기의 보스 검색용 목록 (출시된 전 종의 이름·타입·종족값)
#
# 파이프라인 위치 (scripts/build.sh)
#   dex_build.py → pve_build.py → sheet_build.py → value_build.py → ...
#   value_build.py 가 data/pve_full.json 을 입력으로 받으므로 반드시 그보다 먼저 돌아야 한다.
# ---------------------------------------------------------------------------
import json
import csv
import re
from sprite import sprite_id
from names import released_names, label_from_gm
from collections import Counter

# 게임마스터 상성표(attackScalar)의 열 순서. 인덱스가 곧 방어 타입이므로 순서를 바꾸면 안 된다.
TYPES = ['NORMAL','FIGHTING','FLYING','POISON','GROUND','ROCK','BUG','GHOST','STEEL','FIRE','WATER','GRASS','ELECTRIC','PSYCHIC','ICE','DRAGON','DARK','FAIRY']
# 기술 이름 뒤에 붙일 타입 한글 표기 (날씨볼·잠재파워처럼 타입이 이름에 들어가는 기술용)
TYPE_KO = {'normal':'노말','fire':'불꽃','water':'물','grass':'풀','electric':'전기','ice':'얼음','fighting':'격투','poison':'독','ground':'땅','flying':'비행','psychic':'에스퍼','bug':'벌레','rock':'바위','ghost':'고스트','dragon':'드래곤','dark':'악','steel':'강철','fairy':'페어리'}
# LEVEL_INDEX: cpMultiplier 배열의 0-based 인덱스 39 = 레벨 40 (랭킹의 기준 레벨)
# INDIVIDUAL_VALUE: IV(개체값) 15/15/15 최대치를 가정해 종족값에 더한다
LEVEL_INDEX, INDIVIDUAL_VALUE = 39, 15
# 보스는 게임마스터에 개체별 수치가 없어 고정값을 가정한다.
#   BOSS_DEFENSE 200 = 레이드 보스의 대표 방어력, BOSS_DPS 30 = 보스가 우리에게 주는 초당 피해량
# 이 두 값은 모든 후보에 똑같이 적용되므로 랭킹의 상대 순서에는 영향이 적다.
BOSS_DEFENSE, BOSS_DPS = 200.0, 30.0
# STAB = Same Type Attack Bonus(자속 보정) 1.2배
# 섀도우 보정: 공격 1.2배, 방어 0.8333배 (게임 내 공개 수치)
STAB, SHADOW_ATTACK_MULT, SHADOW_DEFENSE_MULT = 1.2, 1.2, 0.8333
# 각 랭킹 탭에 노출할 상위 개체 수
TOP = 30

game_master = json.load(open('data/pm.json'))
# CPM (CP Multiplier, 레벨별 종족값 배율) — 기준 레벨 하나만 뽑아 쓴다
cpm = [entry for entry in game_master if 'playerLevel' in entry['data']][0]['data']['playerLevel']['cpMultiplier'][LEVEL_INDEX]
# 상성표: 공격 타입 → 18칸 배율 배열 (효과 굉장 1.6, 별로 0.625, 효과 없음 0.390625)
type_effectiveness = {}
for entry in game_master:
    if 'typeEffective' in entry['data']:
        type_effective = entry['data']['typeEffective']
        type_effectiveness[type_effective['attackType'].replace('POKEMON_TYPE_','')] = type_effective['attackScalar']
# 기술 id → 기술 설정(위력·에너지·시간)
moves = {entry['data']['moveSettings']['movementId']: entry['data']['moveSettings'] for entry in game_master if 'moveSettings' in entry['data']}

# PvPoke released 목록으로 미출시 포켓몬 제외 (도감번호 기준)
pvpoke_gm = json.load(open('data/gm.json'))
released_dex = {pokemon['dex'] for pokemon in pvpoke_gm['pokemon'] if pokemon.get('released')}
# 일반 티어표용: 전설·환상·울트라비스트 도감번호
rare_dex = {pokemon['dex'] for pokemon in pvpoke_gm['pokemon'] if any(tag in pokemon.get('tags', []) for tag in ('legendary', 'mythical', 'ultrabeast'))}

# 한글 이름
korean_species_names = {int(row['pokemon_species_id']): row['name'] for row in csv.DictReader(open('data/species_names.csv', encoding='utf-8')) if row['local_language_id']=='3'}
# 영문 기술명을 영숫자만 남긴 슬러그로 정규화해 PokeAPI move_id 를 찾고, 그 id 로 한글 이름을 얻는다
move_id_by_english_slug, korean_move_names = {}, {}
for row in csv.DictReader(open('data/move_names.csv', encoding='utf-8')):
    if row['local_language_id']=='9': move_id_by_english_slug[re.sub(r'[^a-z0-9]','',row['name'].lower())] = row['move_id']
    if row['local_language_id']=='3': korean_move_names[row['move_id']] = row['name']
def korean_move_name(move_id):
    # 게임마스터 기술 id → 한글 기술명. 못 찾으면 원본 id 를 그대로 돌려준다(디버그에서 잡히도록).
    base = re.sub(r'_FAST$','',move_id)
    # 날씨볼·잠재파워는 타입별로 id 가 갈리지만 한글 이름은 하나뿐이라, 타입 접미사를 떼고 괄호로 붙인다
    matched = re.match(r'^(.*)_(FIRE|WATER|ICE|ROCK|NORMAL)$', base)
    suffix = ''
    if matched and base.startswith(('WEATHER_BALL','HIDDEN_POWER')):
        base, suffix = matched.group(1), f"({TYPE_KO[matched.group(2).lower()]})"
    korean = korean_move_names.get(move_id_by_english_slug.get(re.sub(r'[^a-z0-9]','',base.lower())))
    return (korean + suffix) if korean else move_id

def type_mult(attack_type, defender_types):
    # 상성 배율: 방어측 타입이 둘이면 두 배율을 곱한다 (보스 타입이 빈 목록이면 1.0 = 중립)
    multiplier = 1.0
    for defender_type in defender_types:
        multiplier *= type_effectiveness[attack_type][TYPES.index(defender_type)]
    return multiplier

def damage(power, attack, defense, multiplier):
    # 포켓몬고 피해 공식: floor(0.5 x 위력 x 공격/방어 x 각종 배율) + 1
    return int(0.5 * power * (attack / defense) * multiplier) + 1

def best_dps(attack, own_types, quick, charged, boss_types):
    # 가능한 (스피드기, 차지기) 조합을 모두 돌려 DPS 가 가장 높은 하나를 고른다.
    # 반환: (dps, 스피드기 id, 차지기 id) 또는 조합이 없으면 None
    best = None
    for quick_id in quick:
        fast_move = moves.get(quick_id)
        # 에너지를 벌지 못하는 기술(energyDelta <= 0)은 차지기를 못 쓰므로 제외
        if not fast_move or fast_move.get('energyDelta',0) <= 0: continue
        for charged_id in charged:
            charged_move = moves.get(charged_id)
            # 위력·에너지 정보가 빠진 기술은 계산 불가
            if not charged_move or 'energyDelta' not in charged_move or 'power' not in charged_move or 'power' not in fast_move: continue
            fast_type, charged_type = fast_move['pokemonType'].replace('POKEMON_TYPE_',''), charged_move['pokemonType'].replace('POKEMON_TYPE_','')
            # 최종 배율 = 자속 보정 x 보스 상대 상성
            fast_multiplier = (STAB if fast_type in own_types else 1) * type_mult(fast_type, boss_types)
            charged_multiplier = (STAB if charged_type in own_types else 1) * type_mult(charged_type, boss_types)
            fast_damage, charged_damage = damage(fast_move['power'], attack, BOSS_DEFENSE, fast_multiplier), damage(charged_move['power'], attack, BOSS_DEFENSE, charged_multiplier)
            # 차지기 1회를 쓰기 위해 필요한 스피드기 횟수 = ceil(소모 에너지 / 스피드기 획득 에너지)
            fast_uses = -(-abs(charged_move['energyDelta']) // fast_move['energyDelta'])
            # DPS = 한 사이클(스피드기 n회 + 차지기 1회) 총 피해 / 사이클 소요 초
            dps = (fast_damage*fast_uses + charged_damage) / ((fast_move['durationMs']*fast_uses + charged_move['durationMs'])/1000)
            if not best or dps > best[0]: best = (dps, quick_id, charged_id)
    return best

# 후보 목록 구성 (일반 / 섀도우 / 메가), 중복 폼 제거
seen, candidates, dropped, bosses = set(), [], [], []
for entry in game_master:
    pokemon_settings = entry['data'].get('pokemonSettings')
    if not pokemon_settings or 'stats' not in pokemon_settings or not pokemon_settings['stats'].get('baseAttack'): continue
    dex = int(entry['templateId'][1:5])
    if dex not in released_dex: continue
    form = pokemon_settings.get('form','')
    # _S 접미사는 에이펙스(다이맥스 레이드 전용 강화 폼). 실제 출시된 호우오우·루기아만 남긴다
    if form.endswith('_S') and pokemon_settings['pokemonId'] not in ('HO_OH','LUGIA'): continue
    # 미출시·코스튬·이벤트 한정 폼은 종족값이 원본과 같거나 게임에 없어 랭킹을 중복 오염시키므로 제외
    if any(keyword in form for keyword in ('ETERNAMAX','SHADOW','PURIFIED','COPY','COSTUME','FALL_2019','_2020','_2021','_2022','_2023','_2024','_2025','NOEVOLVE','GOFEST','ADVENTURE','FASHION','HOLIDAY','SPRING','SUMMER','WINTER')): continue
    types = [type_name.replace('POKEMON_TYPE_','') for type_name in (pokemon_settings.get('type'), pokemon_settings.get('type2')) if type_name]
    # 스피드기·차지기는 기본 기술 + 이로치머신(elite) 기술을 합친 전체 풀에서 최적 조합을 찾는다
    quick = [move_id for move_id in pokemon_settings.get('quickMoves',[]) + pokemon_settings.get('eliteQuickMove',[]) if isinstance(move_id,str)]
    # FRUSTRATION·RETURN 은 섀도우/퓨어 전용 고정 기술이라 일반 조합에서 선택할 수 없어 제외
    charged = [move_id for move_id in pokemon_settings.get('cinematicMoves',[]) + pokemon_settings.get('eliteCinematicMove',[]) if isinstance(move_id,str) and move_id not in ('FRUSTRATION','RETURN')]
    if not quick or not charged: continue
    form_label = label_from_gm(pokemon_settings['pokemonId'], form)
    # 라벨 표에 없는 폼(코스튬 등)은 None → 후보에서 뺀다
    if form_label is None: continue
    base_korean_name = korean_species_names.get(dex, pokemon_settings['pokemonId'].title())
    # 한 종에서 파생되는 변형들: (라벨, 종족값, 타입, 공격 배율, 방어 배율)
    variants = [(form_label, pokemon_settings['stats'], types, 1.0, 1.0)]
    if 'shadow' in pokemon_settings: variants.append((f'섀도우 {form_label}'.strip(), pokemon_settings['stats'], types, SHADOW_ATTACK_MULT, SHADOW_DEFENSE_MULT))
    # 메가·원시 진화는 tempEvoOverrides 에 별도 종족값(과 종종 타입 변경)으로 들어있다
    for temp_evo in pokemon_settings.get('tempEvoOverrides',[]):
        if 'stats' not in temp_evo: continue
        mega_label = temp_evo['tempEvoId'].replace('TEMP_EVOLUTION_','').replace('MEGA_','메가').replace('MEGA','메가').replace('PRIMAL','원시')
        mega_types = [type_name.replace('POKEMON_TYPE_','') for type_name in (temp_evo.get('typeOverride1'), temp_evo.get('typeOverride2')) if type_name] or types
        variants.append((f'{mega_label} {form_label}'.strip(), temp_evo['stats'], mega_types, 1.0, 1.0))
    for variant_label, variant_stats, variant_types, attack_mult, defense_mult in variants:
        # PvPoke 출시 목록에 없는 이름(미출시 메가·폼·섀도우)은 제외
        if f'{variant_label} {base_korean_name}'.strip() not in released_names:
            dropped.append(f'{variant_label} {base_korean_name}'.strip())
            continue
        # 게임마스터에 같은 개체가 여러 템플릿으로 중복 등장하므로 (도감·라벨·종족값·타입·기술) 지문으로 걸러낸다
        signature = (dex, variant_label, variant_stats['baseAttack'], variant_stats['baseDefense'], tuple(variant_types), tuple(sorted(quick)), tuple(sorted(charged)))
        if signature in seen: continue
        seen.add(signature)
        # 2026-09-02 솔플 계산기 보스 검색용: 출시된 전 종(메가·폼 포함) 이름·타입·종족값
        # 출력 키 ba/bd/bs = base attack / base defense / base stamina
        bosses.append({'name': f'{variant_label} {base_korean_name}'.strip(), 'sprite': sprite_id(dex, variant_label), 'types': [type_name.lower() for type_name in variant_types], 'ba': variant_stats['baseAttack'], 'bd': variant_stats['baseDefense'], 'bs': variant_stats['baseStamina']})
        # 후보 1건. atk/def/hp 는 (종족값 + IV) x CPM 으로 실전 능력치로 환산한 값이며
        # 섀도우·메가 배율까지 반영한다. hp 만 정수 내림(게임과 동일).
        candidates.append({'form': form, 'pid': pokemon_settings['pokemonId'], 'key': f'{dex}|{variant_label}', 'sprite': sprite_id(dex, variant_label), 'name': f'{variant_label} {base_korean_name}'.strip(), 'en': (variant_label and variant_label+' ' or '')+pokemon_settings['pokemonId'].title(), 'dex': dex,
                      'atk': (variant_stats['baseAttack']+INDIVIDUAL_VALUE)*cpm*attack_mult, 'def': (variant_stats['baseDefense']+INDIVIDUAL_VALUE)*cpm*defense_mult, 'hp': int((variant_stats['baseStamina']+INDIVIDUAL_VALUE)*cpm),
                      'types': variant_types, 'quick': quick, 'charged': charged})

def rank_for(boss_types, score_sink=None, pool=None):
    # 특정 보스 타입 상대의 딜러 랭킹. boss_types 가 빈 목록이면 중립(상성 1.0) 보스.
    # score_sink 가 주어지면 상위 TOP 컷과 무관하게 전 후보의 점수를 그 딕셔너리에 채운다(pve_full.json 용).
    out = []
    for candidate in (pool if pool is not None else candidates):
        best = best_dps(candidate['atk'], candidate['types'], candidate['quick'], candidate['charged'], boss_types)
        if not best: continue
        dps, quick_id, charged_id = best
        # 생존 시간(초) = 내 HP / 보스가 주는 초당 실피해. 보스 피해는 방어력 100 기준으로 환산한다.
        time_to_faint = candidate['hp'] / (BOSS_DPS * (100/candidate['def']))
        # TDO = 쓰러지기 전까지 누적 피해량
        tdo = dps * time_to_faint
        # 종합 점수 = DPS^3 x TDO / 1000 — 레이드에서는 순간 화력이 훨씬 중요하므로 DPS 에 3제곱 가중
        if score_sink is not None: score_sink[candidate['key']] = round(dps**3*tdo/1000)
        out.append({'sprite': candidate['sprite'], 'name': candidate['name'], 'en': candidate['en'], 'types': [type_name.lower() for type_name in candidate['types']], 'fast': korean_move_name(quick_id), 'charged': korean_move_name(charged_id),
                    'dps': round(dps,1), 'tdo': round(tdo), 'score': round(dps**3*tdo/1000)})
    out.sort(key=lambda row: -row['score'])
    return out[:TOP]

full_scores = {}
pve = {'overall': rank_for([], full_scores.setdefault('overall', {}))}
for type_name in TYPES: pve[type_name.lower()] = rank_for([type_name], full_scores.setdefault(type_name.lower(), {}))
json.dump(pve, open('data/pve.json','w'), ensure_ascii=False)

# ---------- PvE 일반: 전설·환상·UB·메가·섀도우를 뺀 티어표 ----------
# 속성 탭 = 그 속성 포켓몬만 모아 정렬 (기술 제한 없이 최적 조합, 중립 보스 상대)
easy_keys = {candidate['key'] for candidate in candidates if candidate['dex'] not in rare_dex and not re.match(r'^(섀도우|메가|원시)', candidate['name'])}
def rel_tier(rows):
    # 티어는 목록 안 상대 등급 (일반 개체만으로는 절대 기준 S·A가 성립하지 않음)
    # 상위 12% S, 35% A, 65% B, 나머지 C
    for index, row in enumerate(rows):
        fraction = index / len(rows)
        row['tier'] = 'S' if fraction < 0.12 else 'A' if fraction < 0.35 else 'B' if fraction < 0.65 else 'C'
def rank_neutral(pool):
    # 중립 보스(상성 배율 1.0) 상대 랭킹 전체. TOP 컷을 하지 않고 key 를 남겨 뒤에서 필터링에 쓴다.
    out = []
    for candidate in pool:
        best = best_dps(candidate['atk'], candidate['types'], candidate['quick'], candidate['charged'], [])
        if not best: continue
        dps, quick_id, charged_id = best
        tdo = dps * (candidate['hp'] / (BOSS_DPS * (100/candidate['def'])))
        out.append({'key': candidate['key'], 'sprite': candidate['sprite'], 'name': candidate['name'], 'en': candidate['en'], 'types': [type_name.lower() for type_name in candidate['types']],
                    'fast': korean_move_name(quick_id), 'charged': korean_move_name(charged_id), 'dps': round(dps,1), 'tdo': round(tdo), 'score': round(dps**3*tdo/1000)})
    out.sort(key=lambda row: -row['score'])
    return out
pve_easy = {}
for key, type_filter in [('overall', None)] + [(type_name.lower(), type_name) for type_name in TYPES]:
    pool = candidates if type_filter is None else [candidate for candidate in candidates if type_filter in candidate['types']]
    rows_all = rank_neutral(pool)
    if not rows_all: continue
    top_all = rows_all[0]['score']  # 같은 속성 최강(전설·메가 포함) 대비 %
    rows = [row for row in rows_all if row['key'] in easy_keys][:TOP]
    for row in rows:
        # score 는 DPS^3 x TDO 이므로 4제곱근을 취해 체감에 가까운 선형 비율(%)로 환산한다
        row['ratio'] = round((row['score'] / top_all) ** 0.25 * 100)
        del row['key']
    rel_tier(rows)
    pve_easy[key] = rows
json.dump(pve_easy, open('data/pve_easy.json','w'), ensure_ascii=False)
# value_build.py 가 그대로 받아 쓰는 개체 메타. quick 은 다이맥스 맥스어택 타입 판정에 필요하다.
meta = {candidate['key']: {'name': candidate['name'], 'en': candidate['en'], 'dex': candidate['dex'], 'sprite': candidate['sprite'], 'types': [type_name.lower() for type_name in candidate['types']],
                   'atk': candidate['atk'], 'def': candidate['def'], 'hp': candidate['hp'], 'quick': candidate['quick'], 'form': candidate['form'], 'pid': candidate['pid']} for candidate in candidates}
json.dump({'meta': meta, 'scores': full_scores}, open('data/pve_full.json','w'), ensure_ascii=False)
json.dump(bosses, open('data/bosses.json','w'), ensure_ascii=False)  # 2026-09-02 보스 검색 목록
# ---------- 빌드 로그: 이름 매칭 실패를 눈으로 잡기 위한 자체 점검 ----------
print(len(candidates), 'candidates;', len(dropped), 'dropped (not released in PvPoke), e.g.', dropped[:12])
for key in ('overall','dragon','water'):
    print(key, [(row['name'], row['fast'], row['charged'], row['dps']) for row in pve[key][:6]])
# 한글로 못 바꾼 기술(영문 대문자·밑줄이 남은 것) = move_names.csv 매칭 실패
unmatched_moves = {move_name for key in pve for row in pve[key] for move_name in (row['fast'], row['charged']) if re.search('[A-Z_]', move_name)}
print('unmatched moves:', unmatched_moves)
# 한글 이름을 못 찾아 영문이 남은 포켓몬
print('english names:', {row['name'] for key in pve for row in pve[key] if re.search('[a-z]', row['name'])})
