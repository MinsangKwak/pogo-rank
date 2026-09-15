# ---------------------------------------------------------------------------
# 다이맥스/거다이맥스 랭킹 + 가성비 + 활용처 빌더
#
# 무엇을 계산하나
#   1) 다이맥스 랭킹 (data/dynamax.json)
#      맥스어택/거다이맥스 기술 1발의 피해량과 내구(bulk)를 합성해 보스 속성별로 정렬한다.
#   2) 다이맥스 티어표 (data/dynamax_tier.json)
#      맥스무브 한 방 화력 x 내구 보정 — 공격 x 맥스무브 위력 x 자속 x 내구^0.25.
#      2026-09-14 v3.30.0 까지는 내구를 아예 빼고 화력만 봤다(pogomate 방식). 그랬더니 진화 단계가
#      더 긴 개체가 밀렸다 — 땅 탭에서 다이맥스 몰드류(2단, 공격 213 내구 23)가 거대코뿌리
#      (3단, 공격 202 내구 34)를 눌렀다. 맥스 배틀은 버텨서 맥스 페이즈를 여러 번 도는 싸움이라
#      내구를 통째로 버린 화력표는 "누구 데려갈까"에 반만 답한다. 딜러 표(dynamax.json)의 sqrt 보다
#      약한 네제곱근을 쓴다 — 화력이 여전히 주인공이되 진화 단계 차이는 드러나게.
#   3) 가성비 (data/value.json 의 pvp/pve/both)
#      전설·환상·울트라비스트·메가·섀도우를 뺀 "흔한" 포켓몬 중에서
#      PvP 여러 리그와 PvE 여러 보스에서 동시에 상위인 개체를 뽑는다.
#   4) 활용처 (data/value.json 의 usage)
#      포켓몬 한 마리가 어느 랭킹(PvP 리그 / PvE 보스 / 맥스 배틀)에서 몇 위인지 모아 준다.
#      여기는 전설도 포함한다.
#
# 입력
#   data/pm.json                     게임마스터 덤프 (기술 정보·상성표·거다이 기술 매핑)
#   data/pve_full.json               pve_build.py 산출물 — 개체 메타(meta)와 보스별 점수(scores)
#   backend/config/max_released.txt  실제 출시된 다이맥스/거다이맥스 목록 (Bulbapedia 기준 수동 관리)
#   data/gm.json                     PvPoke 게임마스터 (legendary/mythical/ultrabeast 태그, 종 정보)
#   data/r500|r1500|r2500|r10000.json  리그별 PvPoke 랭킹 (리틀·슈퍼·하이퍼·마스터)
#   data/pvp_all.json                build.py 산출물 — 리그별 전체 순위
#   data/species_names.csv           PokeAPI 종 이름 (한국어 = local_language_id 3)
#
# 출력
#   data/dynamax.json       {'overall' | 보스속성: [행]} — sprite/name/en/types/fast/charged/
#                           dmg/bulk/score/gmax
#   data/dynamax_tier.json  {'overall' | 맥스무브속성: [행]} — ... /atk/power/stab/score/gmax/tier
#   data/value.json         {'pvp': [...], 'pve': [...], 'both': [...], 'usage': [...], 'usage_places': {이름: [[곳, 순위], ...]}}
#   data/dynamax_tank.json  {'overall' | 보스속성: [행]} — 탱커(EHP) 순위 (v2.13.0 QA-43)
#                           (앞 세 개를 먼저 쓴 뒤, 파일을 다시 읽어 usage 를 덧붙인다)
#
# 파이프라인 위치 (scripts/build.sh)
#   pve_build.py → build.py → value_build.py → sheet_build.py → ...
#   pve_build.py 의 pve_full.json 과 build.py 의 pvp_all.json 을 둘 다 입력으로 받으므로
#   이 두 스크립트보다 반드시 뒤에 돌아야 한다.
# ---------------------------------------------------------------------------
import json
import re
import csv
from sprite import sprite_id, gmax_sprite_id
korean_species_names = {int(row['pokemon_species_id']): row['name'] for row in csv.DictReader(open('data/species_names.csv', encoding='utf-8')) if row['local_language_id']=='3'}
# 다이맥스/거다이맥스 랭킹과 가성비 티어를 계산한다
# 게임마스터 상성표(attackScalar)의 열 순서. 인덱스가 곧 방어 타입이므로 순서를 바꾸면 안 된다.
TYPES = ['NORMAL','FIGHTING','FLYING','POISON','GROUND','ROCK','BUG','GHOST','STEEL','FIRE','WATER','GRASS','ELECTRIC','PSYCHIC','ICE','DRAGON','DARK','FAIRY']
# BOSS_DEFENSE 200 = 레이드 보스의 대표 방어력(고정 가정, pve_build.py 와 동일 기준)
# STAB = Same Type Attack Bonus(자속 보정) 1.2배
BOSS_DEFENSE, STAB = 200.0, 1.2
# 맥스 기술 위력: 게임마스터에 없어 공개 수치를 상수로 둔다 (레벨 3 기준)
MAX_ATTACK_POWER, GMAX_POWER = 350, 450
# 각 랭킹 탭에 노출할 상위 개체 수
TOP = 30

game_master = json.load(open('data/pm.json'))
templates_by_id = {entry['templateId']: entry['data'] for entry in game_master}
# 기술 id → 기술 설정(위력·에너지·시간). 여기서는 pokemonType(맥스무브 타입 판정)만 쓴다.
moves = {entry['data']['moveSettings']['movementId']: entry['data']['moveSettings'] for entry in game_master if 'moveSettings' in entry['data']}
# 상성표: 공격 타입 → 18칸 배율 배열 (효과 굉장 1.6, 별로 0.625, 효과 없음 0.390625)
type_effectiveness = {}
for entry in game_master:
    if 'typeEffective' in entry['data']:
        type_effective = entry['data']['typeEffective']
        type_effectiveness[type_effective['attackType'].replace('POKEMON_TYPE_','')] = type_effective['attackScalar']
def type_mult(attack_type, defender_types):
    # 상성 배율: 방어측 타입이 둘이면 두 배율을 곱한다 (보스 타입이 빈 목록이면 1.0 = 중립)
    multiplier = 1.0
    for defender_type in defender_types:
        multiplier *= type_effectiveness[attack_type][TYPES.index(defender_type)]
    return multiplier

pve_full = json.load(open('data/pve_full.json', encoding='utf-8'))
# meta: 개체키 → {name, en, dex, sprite, types, atk, def, hp, quick, form, pid}
# scores: 보스속성 → {개체키: PvE 종합 점수}
meta, scores = pve_full['meta'], pve_full['scores']

# ---------- 다이맥스 ----------
# 출시 목록은 검증된 외부 소스(max_released.txt)를 따르고, 거다이맥스 기술 타입만 게임마스터에서 읽는다
# (게임마스터에는 "누가 다이맥스 가능한가"가 들어있지 않다)
dynamax_released, gmax_released = set(), set()
# 2026-09-15 v3.36.0 '예정' 블록(주석 처리된 D/G 줄)도 읽는다 — 지우지 않고 '미구현' 으로 밝히려면 목록이 필요하다
dynamax_pending = set()
for line in open('backend/config/max_released.txt', encoding='utf-8'):
    body, _, remark = line.partition('#')
    if not body.strip():
        # 주석 줄 중 "# D POKEMON_ID [FORM]" 꼴만 예정 목록으로 본다 (설명 문장은 형식이 달라 걸리지 않는다)
        tokens = remark.split('#')[0].split()
        if len(tokens) in (2, 3) and tokens[0] in ('D', 'G') and tokens[1].isupper():
            dynamax_pending.add((tokens[1], tokens[2] if len(tokens) == 3 else None))
        continue
    # 형식: "D POKEMON_ID [FORM]" = 다이맥스, "G POKEMON_ID [FORM]" = 거다이맥스
    kind, pokemon_id, *form_tokens = body.split()
    (dynamax_released if kind == 'D' else gmax_released).add((pokemon_id, form_tokens[0] if form_tokens else None))
# 거다이맥스 기술 타입: 게임마스터의 sourdough(거다이맥스) 기술 매핑에서 (종, 폼) → 기술 타입
gmax_move_types = {}
for mapping in templates_by_id['SOURDOUGH_MOVE_MAPPING_SETTINGS']['sourdoughMoveMappingSettings']['mappings']:
    gmax_move_types[(mapping['pokemonId'], mapping.get('form'))] = moves[mapping['move']]['pokemonType'].replace('POKEMON_TYPE_','')

def is_base_form(pokemon_id, form):
    # 기본 폼 표기는 소스마다 다르다: 빈 문자열 / None / 'PIKACHU_NORMAL'. 이 셋만 "원종 줄"과 같은 것으로 본다
    return not form or form == f'{pokemon_id}_NORMAL'
# 우리 데이터(pve_full meta)가 따로 갈라 둔 폼 집합. 여기 없는 폼은 기본 폼 항목이 대표한다
# (예: 스트린더는 하이한모습/로우한모습을 갈라 두지 않아 '스트린더' 한 항목이 두 폼을 대표한다)
split_forms = {(entry['pid'], entry['form']) for entry in meta.values() if entry['form']}
def base_form_matches(pokemon_id, form):
    # 기본 폼 항목이 등재 줄 (pokemon_id, form)에 해당하는가
    #   - 폼 없음 / X_NORMAL 줄 → 그대로 기본 폼
    #   - 폼이 적혀 있지만 우리 데이터에 그 폼 항목이 따로 없는 줄 → 기본 폼 항목이 그 폼을 대표하므로 인정
    #     ('D DARMANITAN DARMANITAN_STANDARD' → 불비달마, 'D TOXTRICITY TOXTRICITY_AMPED' → 스트린더)
    #   - 우리 데이터에 따로 있는 폼(MOLTRES_GALARIAN 등)의 줄 → 기본 폼과 무관
    return is_base_form(pokemon_id, form) or (pokemon_id, form) not in split_forms
def in_release_set(release_set, pokemon_id, form):
    # 2026-09-07 v2.13.0 (QA-50) 폼 매칭을 엄격하게.
    # 예전에는 (pokemon_id, None)이 등재돼 있으면 폼과 무관하게 통과시켜서 'D MOLTRES'(관동) 한 줄로
    # 가라르 파이어까지 자격을 얻었다 — 가라르 삼조·히스이 윈디·알로라 라이츄 등 미출시 리전 폼 9건이 티어표에 올랐다.
    # 규칙: 기본 폼 항목은 base_form_matches 로 판정하고, 그 밖의 폼(리전·태세 등)은 파일에 폼까지 적힌 줄만 인정한다.
    if is_base_form(pokemon_id, form):
        return any(candidate_id == pokemon_id and base_form_matches(candidate_id, candidate_form) for candidate_id, candidate_form in release_set)
    return (pokemon_id, form) in release_set
def is_dynamax(pokemon_id, form):
    return in_release_set(dynamax_released, pokemon_id, form)
def registered_gmax_type(pokemon_id, form):
    # 출시 여부와 무관하게 게임마스터에 등록된 거다이맥스 기술 타입
    # 기본 폼은 자신이 대표하는 폼의 키를, 그 밖의 폼은 그 폼 키만 본다
    if is_base_form(pokemon_id, form):
        return next((move_type for (candidate_id, candidate_form), move_type in gmax_move_types.items() if candidate_id == pokemon_id and base_form_matches(candidate_id, candidate_form)), None)
    return gmax_move_types.get((pokemon_id, form))
def gmax_type(pokemon_id, form):
    # 거다이맥스 가능하면 그 전용 기술의 타입, 아니면 None
    if not in_release_set(gmax_released, pokemon_id, form): return None
    return registered_gmax_type(pokemon_id, form)

# 2026-09-15 v3.36.0 (미구현) '데이터는 있는데 아직 못 쓰는' 개체를 지우지 않고 흐리게 함께 보여주기 위한 판정.
#   근거는 둘뿐이다 — ① 게임마스터에 거다이맥스 **기술 데이터**가 있는데 출시 목록에 없는 종
#   ② max_released.txt 의 '예정' 블록에 손으로 적어 둔 줄.
#   "종족값이 있다" 는 근거가 될 수 없다 (전 종이 다 걸린다). DEVELOPMENT.md 2.5 의 규칙 그대로다.
def pending_dynamax(pokemon_id, form):
    return not is_dynamax(pokemon_id, form) and in_release_set(dynamax_pending, pokemon_id, form)
def pending_gmax_type(pokemon_id, form):
    # 거다이맥스 기술은 등록돼 있는데 출시 목록에는 없는 경우 그 기술 타입
    if in_release_set(gmax_released, pokemon_id, form): return None
    return registered_gmax_type(pokemon_id, form)

# 2026-09-06 v2.10.0 (QA-44) 맥스 배틀 행의 표시 이름: 거다이맥스/다이맥스 접두어를 붙여 일반 폼과 구분한다
def max_name(name, is_gmax):
    return f"{'거다이맥스' if is_gmax else '다이맥스'} {name}"

def damage(power, attack, multiplier):
    # 포켓몬고 피해 공식: floor(0.5 x 위력 x 공격/보스방어 x 배율) + 1
    return int(0.5 * power * (attack / BOSS_DEFENSE) * multiplier) + 1

# 섀도우·메가·원시는 다이맥스가 불가능하므로 이름으로 걸러 기본 개체만 남긴다
base_meta = {key: entry for key, entry in meta.items() if not re.search('섀도우|메가|원시', entry['name'])}
# 2026-09-15 v3.36.0 자격(다이맥스 가능 여부 · 거다이맥스 기술 타입)을 받아 맥스무브 1발 최고 피해를 고른다.
# 출시분과 미구현분을 **따로** 계산하려고 떼어냈다 — 섞어서 최고값을 고르면
# '다이맥스는 나왔지만 거다이맥스는 아직' 인 종이 못 쓰는 위력 450 으로 줄에 오른다.
def best_max_hit(entry, boss_types, own_types, dynamax_ok, gmax_move_type):
    best = None
    # 맥스어택 타입 = 보유 스피드기 타입 중 최선
    for quick_id in (entry['quick'] if dynamax_ok else []):
        move = moves.get(quick_id)
        if not move: continue
        move_type = move['pokemonType'].replace('POKEMON_TYPE_','')
        dealt = damage(MAX_ATTACK_POWER, entry['atk'], (STAB if move_type in own_types else 1) * type_mult(move_type, boss_types))
        if not best or dealt > best[0]: best = (dealt, move_type, '맥스어택')
    if gmax_move_type:
        # 거다이맥스 기술은 위력이 더 높으므로(450 vs 350) 보통 이쪽이 이긴다
        dealt = damage(GMAX_POWER, entry['atk'], (STAB if gmax_move_type in own_types else 1) * type_mult(gmax_move_type, boss_types))
        if not best or dealt > best[0]: best = (dealt, gmax_move_type, '거다이맥스')
    return best

# 2026-09-15 v3.36.0 출시분으로 상위 `limit` 줄을 먼저 확정하고, 미구현분은 그 마지막 줄의 점수 이상일 때만 끼워 넣는다.
# 미구현을 같이 세면 출시분 표가 밀려 짧아진다 — 보이는 표는 그대로 두고 흐린 줄만 얹는 것이 목적이다.
def cut_with_unreleased(rows, limit, key='score'):
    if not limit: return rows
    released = [row for row in rows if not row.get('unrel')][:limit]
    keep = {id(row) for row in released}
    cutoff = released[-1][key] if len(released) == limit else 0
    return [row for row in rows if id(row) in keep or (row.get('unrel') and row[key] >= cutoff)]

def dyna_rank(boss_types, limit=TOP):
    # 맥스 배틀 랭킹: 맥스무브 1발 피해량 x sqrt(내구)
    out = []
    for key, entry in base_meta.items():
        # _S(에이펙스) 폼은 맥스 배틀 대상이 아니라 제외
        if entry['form'] and entry['form'].endswith('_S'): continue
        own_types = [type_name.upper() for type_name in entry['types']]
        # 출시분(unrel=False)과 미구현분(unrel=True)을 각각 한 줄씩 낸다.
        # 둘 다 있는 종(예: 다이맥스는 출시 · 거다이맥스는 미출시)은 두 줄로 갈려 서로를 가리지 않는다
        for unrel in (False, True):
            dynamax_ok = pending_dynamax(entry['pid'], entry['form']) if unrel else is_dynamax(entry['pid'], entry['form'])
            gmax_move_type = pending_gmax_type(entry['pid'], entry['form']) if unrel else gmax_type(entry['pid'], entry['form'])
            # 다이맥스도 거다이맥스도 못 하면 후보가 아니다
            if not dynamax_ok and not gmax_move_type: continue
            best = best_max_hit(entry, boss_types, own_types, dynamax_ok, gmax_move_type)
            if not best: continue
            # 내구 지표 = 방어력 x HP / 1000, 점수에는 제곱근으로 완화해 반영(딜 비중을 크게 둔다)
            bulk = entry['def'] * entry['hp'] / 1000
            score = best[0] * bulk ** 0.5
            # 2026-09-06 v2.10.0 (QA-44) 이름에 맥스 종류를 붙인다 — '거다이맥스 에이스번' / '다이맥스 에이스번'.
            # 일반 에이스번(PvE·PvP 표)과 이름이 같으면 검색 색인(이름 기준 중복 제거)·활용처(이름 기준 합산)에서
            # 서로 다른 세 항목이 하나로 뭉개졌다. 이름 자체를 갈라 두면 화면 어디서든 자연히 분리된다.
            # (rank_diff 비교 키가 '스프라이트|이름'이라 이번 빌드 한 번은 맥스 표의 ▲▼ 가 비어 있다가 다음 갱신부터 다시 붙는다)
            out.append({'sprite': gmax_sprite_id(entry['dex'], entry['form']) if best[2] == '거다이맥스' else entry['sprite'], 'name': max_name(entry['name'], best[2] == '거다이맥스'), 'en': entry['en'], 'types': entry['types'],
                        'fast': best[2], 'charged': f"{best[1].lower()}", 'dmg': best[0], 'bulk': round(bulk), 'score': round(score), 'gmax': best[2] == '거다이맥스', **({'unrel': True} if unrel else {})})
    out.sort(key=lambda row: -row['score'])
    return cut_with_unreleased(out, limit)
dynamax_ranking = {'overall': dyna_rank([])}
for type_name in TYPES: dynamax_ranking[type_name.lower()] = dyna_rank([type_name])
json.dump(dynamax_ranking, open('data/dynamax.json','w'), ensure_ascii=False)

# ---------- 2026-09-07 v2.13.0 (QA-43) 다이맥스 탱커 랭킹 (data/dynamax_tank.json) ----------
# pogomate 가 딜러 표와 탱커(EHP) 표를 따로 두듯, "이 보스 앞에서 오래 버티는 다이맥스 포켓몬"을 따로 뽑는다.
# 탱커 지표 EHP = 체력 × 방어 ÷ 1000 ÷ (보스 타입 기술이 이 포켓몬에게 주는 배율).
#   체력·방어는 pve_build 가 만든 레벨 40 실전 능력치, 배율은 보스가 자기 타입 자속 기술로 때린다고 가정한다.
#   'overall' 은 중립(배율 1) — 순수 내구 순위. 후보는 딜러 랭킹과 같은 다이맥스·거다이맥스 출시 개체뿐이다.
def tank_rank(boss_types, limit=TOP):
    out = []
    for key, entry in base_meta.items():
        if entry['form'] and entry['form'].endswith('_S'): continue   # 에이펙스 폼은 맥스 배틀 대상이 아니다
        own_types = [type_name.upper() for type_name in entry['types']]
        multiplier = max(type_mult(boss_type, own_types) for boss_type in boss_types) if boss_types else 1.0
        bulk = entry['def'] * entry['hp'] / 1000
        # 딜러 표와 같은 규칙 — 출시분과 미구현분을 각각 한 줄씩 (탱커 지표는 기술과 무관해 자격 판정만 갈린다)
        for unrel in (False, True):
            dynamax_ok = pending_dynamax(entry['pid'], entry['form']) if unrel else is_dynamax(entry['pid'], entry['form'])
            gmax_move_type = pending_gmax_type(entry['pid'], entry['form']) if unrel else gmax_type(entry['pid'], entry['form'])
            if not dynamax_ok and not gmax_move_type: continue
            is_gmax = gmax_move_type is not None
            out.append({'sprite': gmax_sprite_id(entry['dex'], entry['form']) if is_gmax else entry['sprite'], 'name': max_name(entry['name'], is_gmax), 'en': entry['en'], 'types': entry['types'],
                        'fast': '', 'charged': '', 'ehp': round(bulk / multiplier), 'mult': round(multiplier, 2), 'hp': round(entry['hp']), 'def': round(entry['def']), 'gmax': is_gmax, **({'unrel': True} if unrel else {})})
    out.sort(key=lambda row: -row['ehp'])
    return cut_with_unreleased(out, limit, 'ehp')
dynamax_tank = {'overall': tank_rank([])}
for type_name in TYPES: dynamax_tank[type_name.lower()] = tank_rank([type_name])
json.dump(dynamax_tank, open('data/dynamax_tank.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('tank:', [(row['name'], row['ehp'], row['mult']) for row in dynamax_tank['overall'][:5]])

# 2026-09-04 맥스 배틀 포획 풀: "이 종을 맥스 배틀에서 잡을 수 있나"만 담은 별도 표
# 랭킹(dynamax.json)은 상위 30만 남기므로 포획 CP 안내에는 쓸 수 없어 전체 목록을 따로 낸다.
# 값은 'G'(거다이맥스까지 가능) 또는 'D'(다이맥스만) — 상세 팝업의 포획 CP 라벨에 쓴다.
# 거다이맥스는 스프라이트 id가 따로 있어(gmax_sprite_id) 원종·거다이 두 키 모두에 넣는다.
max_pool = {}
for entry in base_meta.values():
    if entry['form'] and entry['form'].endswith('_S'): continue   # 에이펙스 폼은 맥스 배틀 대상이 아니다
    is_gmax = gmax_type(entry['pid'], entry['form']) is not None
    if not is_dynamax(entry['pid'], entry['form']) and not is_gmax: continue
    max_pool[str(entry['sprite'])] = 'G' if is_gmax else 'D'
    if is_gmax:
        max_pool[str(gmax_sprite_id(entry['dex'], entry['form']))] = 'G'
json.dump(max_pool, open('data/max_pool.json', 'w', encoding='utf-8'), ensure_ascii=False)

# ---------- 다이맥스 티어표: 속성 탭 = 그 속성 포켓몬만 ----------
# 2026-09-02 pogomate 기준으로 변경: 공격 종족값 × 맥스무브 위력(거다이 450·다이 350) × 자속 1.2
# 내구 미반영, 같은 종의 다이맥스/거다이맥스는 별도 행 (pogomate 수치 역산으로 검증)
# 2026-09-14 v3.30.0 등급을 **절대 기준**으로 바꿨다.
# 전에는 목록 안 상대 등급(상위 12% S …)이라 같은 점수가 탭마다 다른 글자를 받았다 —
# 다이맥스 거대코뿌리 84,840 이 바위 탭(7줄)에서는 1위라 S, 전체 탭(30줄)에서는 꼴찌라 C.
# 줄 수가 적은 탭은 무조건 S 가 하나 나오고, 상위 30 만 자른 전체 탭의 C 는 160여 종 중 30등이다.
# 양쪽으로 다 거짓말을 해서, 가성비 화면이 이미 쓰던 절대 경계(90/80/70)를 그대로 가져온다.
# 순위("바위 1위")는 탭 안에서 그대로 매기므로 등급과 순위가 서로 다른 질문에 답한다.
def absolute_tier(rows):
    if not rows: return
    # 2026-09-15 v3.36.0 기준선(100%)은 **출시분 1위**다. 미구현을 기준에 넣으면 아직 못 쓰는
    # 개체(거다이맥스 자시안 등) 하나가 전체 등급을 끌어내린다 — 흐린 줄은 100% 를 넘을 수 있다
    released = [row for row in rows if not row.get('unrel')]
    best = max(row['score'] for row in (released or rows))
    for row in rows:
        row['pct'] = round(row['score'] / best * 100)
        row['tier'] = 'S' if row['pct'] >= 90 else 'A' if row['pct'] >= 80 else 'B' if row['pct'] >= 70 else 'C'

def tier_rows():
    # 2026-09-03 pogomate 대조 보정 2: 이중 자속(예: 연격 우라오스 물·격투)은 자속 타입마다 행 생성
    # — 각 타입 탭에 그 타입 맥스무브 딜러로 올라간다. 자속 스피드기가 없으면 최고 타입 1행만
    out = []
    for key, entry in base_meta.items():
        # _S(에이펙스) 폼은 맥스 배틀 대상이 아니라 제외
        if entry['form'] and entry['form'].endswith('_S'): continue
        own_types = [type_name.upper() for type_name in entry['types']]
        # 내구 보정: 방어 x 체력 / 1000 의 네제곱근. 딜러 표(dyna_rank)는 같은 내구를 제곱근으로 쓴다 —
        # 티어표는 화력표에 가깝게 두려고 한 단계 약하게 건다
        bulk = entry['def'] * entry['hp'] / 1000
        bulk_mul = bulk ** 0.25
        attack = round(entry['atk'])
        # 출시분과 미구현분을 각각 낸다 (unrel 표시만 다르고 계산은 같다)
        for unrel in (False, True):
            unrel_mark = {'unrel': True} if unrel else {}
            dynamax_ok = pending_dynamax(entry['pid'], entry['form']) if unrel else is_dynamax(entry['pid'], entry['form'])
            gmax_move_type = pending_gmax_type(entry['pid'], entry['form']) if unrel else gmax_type(entry['pid'], entry['form'])
            if dynamax_ok:
                # 보유 스피드기의 타입 = 쓸 수 있는 맥스어택 타입
                move_types = set()
                for quick_id in entry['quick']:
                    move = moves.get(quick_id)
                    if move: move_types.add(move['pokemonType'].replace('POKEMON_TYPE_',''))
                stab_types = [type_name for type_name in own_types if type_name in move_types]
                # 자속 맥스어택이 있으면 자속 타입마다 한 행, 없으면 사전순 첫 타입 하나만
                targets = stab_types or (sorted(move_types)[:1] if move_types else [])
                for move_type in targets:
                    # 350 = MAX_ATTACK_POWER(다이맥스 맥스무브 위력), 1.2 = 자속 보정, 내구^0.25
                    score = attack * 350 * (1.2 if move_type in own_types else 1) * bulk_mul
                    out.append({'sprite': entry['sprite'], 'name': max_name(entry['name'], False), 'en': entry['en'], 'types': entry['types'],
                                'fast': '맥스어택', 'charged': move_type.lower(), 'atk': attack, 'power': 350,
                                'stab': move_type in own_types, 'bulk': round(bulk), 'bulkMul': round(bulk_mul, 2),
                                'score': round(score), 'gmax': False, **unrel_mark})
            if gmax_move_type:
                # 450 = GMAX_POWER(거다이맥스 전용 기술 위력), 1.2 = 자속 보정, 내구^0.25
                score = attack * 450 * (1.2 if gmax_move_type in own_types else 1) * bulk_mul
                out.append({'sprite': gmax_sprite_id(entry['dex'], entry['form']), 'name': max_name(entry['name'], True), 'en': entry['en'], 'types': entry['types'],
                            'fast': '거다이맥스', 'charged': gmax_move_type.lower(), 'atk': attack, 'power': 450,
                            'stab': gmax_move_type in own_types, 'bulk': round(bulk), 'bulkMul': round(bulk_mul, 2),
                            'score': round(score), 'gmax': True, **unrel_mark})
    out.sort(key=lambda row: -row['score'])
    return out

dmax_all = tier_rows()
# 등급은 **전 종을 통틀어** 한 번만 매긴다 — 탭을 옮겨도 글자가 바뀌지 않게 (absolute_tier)
absolute_tier(dmax_all)
dmax_tier = {}
# 2026-09-03 pogomate 대조 보정: 타입 탭 분류를 "그 타입 보유"가 아니라 "그 타입 맥스무브로 때리는 딜러"로
# (할비롱이 드래곤 무브 점수로 노말 탭에 오르던 문제 — pogomate는 무브 타입 기준)
for key, type_filter in [('overall', None)] + [(type_name.lower(), type_name.lower()) for type_name in TYPES]:
    if type_filter is None:
        # 전체 탭은 한 개체가 자속 타입마다 여러 행으로 중복되므로 (이름, 거다이여부)로 한 행만 남긴다
        seen_names, rows = set(), []
        for row in dmax_all:
            dedupe_key = (row['name'], row['gmax'])
            if dedupe_key in seen_names: continue
            seen_names.add(dedupe_key)
            rows.append(dict(row))
        rows = cut_with_unreleased(rows, TOP)
    else:
        # 'charged' 에 맥스무브 타입이 들어있으므로 그것으로 탭을 가른다
        rows = cut_with_unreleased([dict(row) for row in dmax_all if row['charged'] == type_filter], TOP)
    if not rows: continue
    dmax_tier[key] = rows   # tier·pct 는 dmax_all 에서 이미 붙었다 (탭마다 다시 매기지 않는다)
json.dump(dmax_tier, open('data/dynamax_tier.json','w'), ensure_ascii=False)
print('dynamax eligible:', sum(1 for entry in base_meta.values() if is_dynamax(entry['pid'], entry['form'])), 'gmax:', sum(1 for entry in base_meta.values() if gmax_type(entry['pid'], entry['form'])))

# ---------- 가성비 ----------
# 전설·환상·UB·메가·섀도우 제외, 여러 리그(PvP)와 여러 보스(PvE)에서 동시에 상위인 포켓몬
pvpoke_gm = json.load(open('data/gm.json'))
rare_dex = set()
for pokemon in pvpoke_gm['pokemon']:
    if any(tag in pokemon.get('tags', []) for tag in ('legendary','mythical','ultrabeast')):
        rare_dex.add(pokemon['dex'])
pvpoke_species = {pokemon['speciesId']: pokemon for pokemon in pvpoke_gm['pokemon']}

# PvP: 리그별 최고 점수(섀도우 제외), 전체 랭킹 파일 사용
# CP(Combat Power) 상한 500/1500/2500/10000 = 리틀·슈퍼·하이퍼·마스터 리그
pvp_best = {}
for cp_cap, league_id in [(500,'little'),(1500,'great'),(2500,'ultra'),(10000,'master')]:
    for ranking_entry in json.load(open(f'data/r{cp_cap}.json')):
        species_id = ranking_entry['speciesId']
        # 섀도우·메가는 "가성비"의 취지(구하기 쉬운 개체)에 안 맞아 제외
        if species_id.endswith('_shadow') or '_mega' in species_id: continue
        dex = pvpoke_species[species_id]['dex']
        if dex in rare_dex: continue
        league_best = pvp_best.setdefault(dex, {})
        # 같은 도감번호의 여러 폼 중 리그별 최고 점수만 남긴다
        if ranking_entry['score'] > league_best.get(league_id, (0,))[0]: league_best[league_id] = (ranking_entry['score'], species_id)

# PvE: 보스 타입별 최강 대비 비율(%)
boss_top_scores = {boss_type: max(boss_scores.values()) for boss_type, boss_scores in scores.items()}
pve_best = {}
for key, entry in base_meta.items():
    if entry['dex'] in rare_dex: continue
    # score 는 DPS^3 x TDO 이므로 4제곱근을 취해 체감에 가까운 선형 비율(%)로 환산한다
    ratios = {boss_type: (scores[boss_type][key] / boss_top_scores[boss_type]) ** 0.25 * 100 for boss_type in scores if key in scores[boss_type]}
    if not ratios: continue
    # 가성비의 PvE 값 = 가장 잘 통하는 보스 3종의 평균 (한 보스만 잘 잡는 편식형은 낮게)
    top3_ratios = sorted(ratios.values(), reverse=True)[:3]
    dex_best = pve_best.setdefault(entry['dex'], {'value': 0})
    average_ratio = sum(top3_ratios) / len(top3_ratios)
    # 같은 도감번호의 여러 폼 중 가장 좋은 하나만 대표로 남긴다
    if average_ratio > dex_best['value']:
        best_boss = max(ratios, key=ratios.get)
        dex_best.update({'value': average_ratio, 'key': key, 'best_boss': best_boss, 'best_ratio': ratios[best_boss]})

LEAGUE_KO = {'little':'리틀','great':'슈퍼','ultra':'하이퍼','master':'마스터'}
def tier(value):
    # 절대 점수 기준 티어 (both 목록에만 최종적으로 남는다 — pvp/pve 는 아래에서 상대 등급으로 덮어쓴다)
    return 'S' if value >= 90 else 'A' if value >= 80 else 'B' if value >= 70 else 'C'
pvp_list, pve_list, both = [], [], []
for dex in set(pvp_best) | set(pve_best):
    pvp_leagues = pvp_best.get(dex, {})
    pve_entry = pve_best.get(dex)
    # 'key' 가 없으면 setdefault 로만 만들어진 껍데기(갱신 조건을 못 넘긴 개체)라 무효 처리
    if pve_entry and 'key' not in pve_entry: pve_entry = None
    if not pvp_leagues and not pve_entry: continue
    # PvP 값 = 상위 2개 리그 점수의 평균. 리그 하나뿐이면 범용성이 낮으니 0.8배로 깎는다
    top_two_league_scores = sorted((score for score, _ in pvp_leagues.values()), reverse=True)[:2]
    pvp_value = sum(top_two_league_scores) / 2 if len(top_two_league_scores) == 2 else (top_two_league_scores[0] * 0.8 if top_two_league_scores else 0)
    pve_value = pve_entry['value'] if pve_entry else 0
    # 대표 엔트리: PvE 메타 우선(스프라이트·타입 보유), 없으면 PvP
    if pve_entry:
        pve_meta = meta[pve_entry['key']]
        name, english_name, sprite, types = pve_meta['name'], pve_meta['en'], pve_meta['sprite'], pve_meta['types']
    else:
        species_id = next(iter(pvp_leagues.values()))[1]
        species = pvpoke_species[species_id]
        name, english_name, sprite, types = korean_species_names.get(dex, species['speciesName']), species['speciesName'], sprite_id(dex, ''), [type_name for type_name in species['types'] if type_name != 'none']
    # 70점 이상 받은 리그만 "리틀 85 · 슈퍼 91" 형태로 표기
    leagues = ' · '.join(f"{LEAGUE_KO[league_id]} {pvp_leagues[league_id][0]:.0f}" for league_id in ('little','great','ultra','master') if league_id in pvp_leagues and pvp_leagues[league_id][0] >= 70)
    row = {'sprite': sprite, 'name': name, 'en': english_name, 'types': types, 'pvp': round(pvp_value, 1), 'pve': round(pve_value, 1),
           'leagues': leagues or '', 'boss_type': pve_entry['best_boss'] if pve_entry else '', 'boss_ratio': round(pve_entry['best_ratio']) if pve_entry else 0}
    # 진입 문턱: PvP 70점 / PvE 60점 (PvE 는 전설·메가를 뺀 목록이라 상한이 낮아 기준도 낮다)
    if pvp_value >= 70: pvp_list.append({**row, 'value': round(pvp_value, 1), 'tier': tier(pvp_value)})
    if pve_value >= 60: pve_list.append({**row, 'value': round(pve_value, 1), 'tier': tier(pve_value)})
    if pvp_value >= 70 and pve_value >= 60:
        # both = 양쪽 다 통과한 만능형. 값은 두 점수의 단순 평균
        combined_value = (pvp_value + pve_value) / 2
        both.append({**row, 'value': round(combined_value, 1), 'tier': tier(combined_value)})
for ranking_list in (pvp_list, pve_list, both): ranking_list.sort(key=lambda row: -row['value'])
# 일반 티어표(pvp·pve)의 티어는 절대 점수가 아니라 목록 안 상대 등급으로 매긴다
# (전설·메가를 뺀 PvE 일반은 절대 기준으로는 S·A가 아예 없어 티어표가 성립하지 않음)
def rel_tier(rows):
    # 상위 12% S, 35% A, 65% B, 나머지 C
    for index, row in enumerate(rows):
        fraction = index / len(rows)
        row['tier'] = 'S' if fraction < 0.12 else 'A' if fraction < 0.35 else 'B' if fraction < 0.65 else 'C'
# pve는 진입 조건(60점)을 넘는 일반 개체 전부, pvp는 상위 60종
pvp_cut = pvp_list[:60]
rel_tier(pvp_cut)
rel_tier(pve_list)
json.dump({'pvp': pvp_cut, 'pve': pve_list, 'both': both[:40]}, open('data/value.json','w'), ensure_ascii=False)
print('value:', len(pvp_list), len(pve_list), len(both))

print([(row['name'], row['fast'], row['charged'], row['score']) for row in dynamax_ranking['overall'][:8]])

# ---------- 활용처: 포켓몬별로 상위권에 드는 곳을 모은다 (전설 포함) ----------
# 각 랭킹의 상위 USE_TOP 위까지만 "활용처"로 인정한다
USE_TOP = 30
usage = {}
def add_usage(name, sprite, english_name, types, place, rank):
    # 같은 포켓몬의 등장을 이름 기준으로 한 항목에 모으고, 어디서 몇 위였는지를 places 에 쌓는다
    usage_entry = usage.setdefault(name, {'name': name, 'sprite': sprite, 'en': english_name, 'types': types, 'places': []})
    usage_entry['places'].append({'place': place, 'rank': rank})
pvp_all = json.load(open('data/pvp_all.json', encoding='utf-8'))
# PvP: 리그별 순위 (rank 는 파일에 이미 들어있다)
for league_id, rows in pvp_all.items():
    for row in rows[:USE_TOP]: add_usage(row['name'], row['sprite'], row['en'], row['types'], f"pvp:{league_id}", row['rank'])
# PvE: 보스 속성별로 점수 내림차순 정렬해 순위를 직접 매긴다
for boss, boss_scores in scores.items():
    for index, (key, _) in enumerate(sorted(boss_scores.items(), key=lambda item: -item[1])[:USE_TOP]):
        entry = meta[key]
        add_usage(entry['name'], entry['sprite'], entry['en'], entry['types'], f"pve:{boss}", index + 1)
# 맥스 배틀: 위에서 만든 다이맥스 랭킹 순서를 그대로 쓴다
# 2026-09-15 v3.36.0 미구현 줄은 빼고 센다 — '활용처' 는 실제로 쓸 수 있는 자리를 뜻하고,
# 흐린 줄을 같이 세면 그 아래 출시분의 순위까지 한 칸씩 밀린다
for boss, rows in dynamax_ranking.items():
    released_rows = [row for row in rows if not row.get('unrel')]
    for index, row in enumerate(released_rows[:USE_TOP]): add_usage(row['name'], row['sprite'], row['en'], row['types'], f"max:{boss}", index + 1)
use_list = []
for usage_entry in usage.values():
    usage_entry['places'].sort(key=lambda place: place['rank'])
    # 점수: 상위권일수록 크게, 여러 곳일수록 크게
    usage_entry['score'] = sum(USE_TOP + 1 - place['rank'] for place in usage_entry['places'])
    usage_entry['count'] = len(usage_entry['places'])
    use_list.append(usage_entry)
use_list.sort(key=lambda usage_entry: (-usage_entry['score'], -usage_entry['count']))
# 위에서 쓴 value.json 을 다시 읽어 usage 키만 덧붙인다 (pvp/pve/both 는 그대로 보존)
value_data = json.load(open('data/value.json', encoding='utf-8'))
value_data['usage'] = use_list[:80]
# 2026-09-07 v2.13.0 (QA-42) 순위표 행의 "활용 N곳" 배지와 상세 팝업 활용처용 — 상위 80에 못 든 항목도 어디서 몇 위인지 알아야 하므로
# 전 항목의 등재 내역을 압축 형태(이름 → [[곳, 순위], ...])로 따로 싣는다. usage(상위 80, 스프라이트·점수 포함)는 활용처 탭 전용으로 그대로 둔다
value_data['usage_places'] = {usage_entry['name']: [[place['place'], place['rank']] for place in usage_entry['places']] for usage_entry in use_list}
# 2026-09-13 v3.24.0 전 종 PvE·PvP 점수표 — meter[이름] = [PvE, PvP] (0~100, 없으면 0).
# 왜: 상세 팝업 육각형의 레이드·PvP 축과 검색 줄의 PvP/PvE 표시가 "어느 순위표 30위 안에 드는가" 로만 그려졌다.
# 대짱이(원종)는 메가·섀도우만 등재돼 축이 미등재(0.08)로 눕고, 검색 줄은 어느 쪽에서 쓰이는지 말할 수 없었다.
# 값은 위 가성비 표와 **같은 산식**이다 — PvE 는 보스 타입별 (score/최강)^0.25 의 상위 3개 평균, PvP 는 리그 점수 상위 2개 평균
# (리그 하나뿐이면 0.8배). 다만 여기는 전설·메가·섀도우도 뺀 곳 없이 전부 넣는다 (usage_places 와 같은 범위)
meter = {}
for key, entry in meta.items():
    ratios = sorted(((scores[boss_type][key] / boss_top_scores[boss_type]) ** 0.25 * 100 for boss_type in scores if key in scores[boss_type]), reverse=True)[:3]
    if not ratios: continue
    pve_score = sum(ratios) / len(ratios)
    slot = meter.setdefault(entry['name'], [0, 0])
    slot[0] = max(slot[0], round(pve_score))
league_scores = {}
for league_id, rows in pvp_all.items():
    for row in rows:
        if row.get('score') is None: continue
        league_scores.setdefault(row['name'], {})
        league_scores[row['name']][league_id] = max(league_scores[row['name']].get(league_id, 0), row['score'])
for name, by_league in league_scores.items():
    top_two = sorted(by_league.values(), reverse=True)[:2]
    pvp_score = sum(top_two) / 2 if len(top_two) == 2 else top_two[0] * 0.8
    slot = meter.setdefault(name, [0, 0])
    slot[1] = max(slot[1], round(pvp_score))
value_data['meter'] = meter
print('meter:', len(meter), '종 · 대짱이', meter.get('대짱이'), '· 메가 대짱이', meter.get('메가 대짱이'))
json.dump(value_data, open('data/value.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('usage:', len(use_list), [(usage_entry['name'], usage_entry['count']) for usage_entry in use_list[:6]])
