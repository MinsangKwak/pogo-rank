# ─────────────────────────────────────────────────────────────────────────────
# dex_build.py — 상세 팝업·도감 페이지용 데이터(data/dex.json) 생성
#
# 역할
#   랭킹 표에는 이름·기술·점수만 있고, 행을 눌렀을 때 뜨는 상세 팝업(타입 상성, 종족값,
#   배울 수 있는 기술, 진화 계보, CP 계산)에 필요한 재료가 없다. 그 재료를 게임마스터와
#   PokeAPI CSV에서 모아 한 파일로 묶는 것이 이 스크립트다.
#
# 입력
#   data/pm.json                          나이앤틱 원본 게임마스터 (templateId + data)
#   data/species_names.csv                PokeAPI 종 한글 이름
#   data/move_names.csv                   PokeAPI 기술 이름 (영문 → id, id → 한글)
#   data/pokemon.csv                      PokeAPI 폼 목록 (스프라이트 id → 종 id)
#   data/pokemon_species.csv              PokeAPI 종 목록 (진화 체인 id, 진화 이전 종)
#   data/pvp.json · pve.json · …          앞선 빌드 결과 — 어떤 스프라이트가 실제로 쓰이는지 수집용
#   backend/config/dex_released_extra.txt 출시 여부 수동 보정 목록
#
# 출력 (data/dex.json 최상위 키)
#   chart  타입 상성표: 공격타입 → 방어타입 → 배율. 상세 팝업의 약점·내성 표시에 쓴다
#   cpm    주요 레벨의 CP 배율 (l20/l25/l30/l35/l50) — "레이드 보상 개체 CP" 같은 요약 표시용
#   cpms   레벨 1~50 전체 CP 배율 배열 — CP 계산기용
#   dex    스프라이트 id → 도감번호. 폼 스프라이트(예: 메가)에서 기본 종을 되찾는 역방향 표
#   names  도감번호 → 한글 이름. 진화 계보와 도감 목록의 이름 표시용
#   evo    도감번호 → 진화 단계 [[1단계 dex...], [2단계...], ...]. 가족 구성원이면 모두 같은 배열을 가리킨다
#   forms  스프라이트 id → { name, types, atk, def, hp, fast[[한글, 엘리트]], charged[[한글, 엘리트]] }
#          상세 팝업 본문(타입·종족값·기술 목록). 엘리트 플래그 1은 이벤트 한정 기술
#   megas  도감번호 → [{ sprite, label }, ...] 메가/원시 진화 폼 (label: 메가/메가X/메가Y/원시)
#          랭킹 등장 여부와 무관하게 항상 채운다 — 도감에서 "메가 있음"을 보여줘야 하기 때문
#   cls    도감번호 → 클래스 (L 전설 / M 환상 / U 울트라비스트). 보스 티어 자동 판정용
#   rel    출시된 도감번호 목록 — 도감의 [미구현] 태그 판단용
#
# 파이프라인에서의 위치 (scripts/build.sh)
#   pve_build.py → build.py(1차) → value_build.py → sheet_build.py → **dex_build.py** → build.py(2차).
#   앞선 스크립트들이 만든 랭킹 JSON을 읽어 "실제로 화면에 나오는 스프라이트"만 골라내므로
#   반드시 그 뒤에 실행돼야 하고, 결과 dex.json은 build.py 2차가 data.js에 실어 보낸다.
# ─────────────────────────────────────────────────────────────────────────────
import json, csv, re, os
from sprite import sprite_id, LOCAL_FORMS
from names import label_from_gm, released_dex

# 2026-09-03 PvPoke released는 PvP 사용 가능 기준이라 실출시 종(메타몽 등)이 빠짐 → 수동 보정 파일로 보완
# 파일 형식: 한 줄에 도감번호 하나, '#' 뒤는 주석
extra_rel = set()
if os.path.exists('backend/config/dex_released_extra.txt'):
    for line in open('backend/config/dex_released_extra.txt', encoding='utf-8'):
        line = line.split('#')[0].strip()
        if line.isdigit():
            extra_rel.add(int(line))

# 타입 상성표를 만들 때 배율 배열의 인덱스 순서 — 게임마스터 attackScalar가 이 순서로 들어온다
TYPES = ['NORMAL','FIGHTING','FLYING','POISON','GROUND','ROCK','BUG','GHOST','STEEL','FIRE','WATER','GRASS','ELECTRIC','PSYCHIC','ICE','DRAGON','DARK','FAIRY']
TYPE_KO = {'normal':'노말','fire':'불꽃','water':'물','grass':'풀','electric':'전기','ice':'얼음','fighting':'격투','poison':'독','ground':'땅','flying':'비행','psychic':'에스퍼','bug':'벌레','rock':'바위','ghost':'고스트','dragon':'드래곤','dark':'악','steel':'강철','fairy':'페어리'}

# 나이앤틱 게임마스터 원본: [{ templateId, data }, ...] 형태의 거대한 템플릿 배열
game_master = json.load(open('data/pm.json'))
# 공격타입 → 방어타입 18칸 배율 배열
effectiveness = {}
for template in game_master:
    if 'typeEffective' in template['data']:
        type_effective = template['data']['typeEffective']
        effectiveness[type_effective['attackType'].replace('POKEMON_TYPE_','')] = type_effective['attackScalar']
# 배율 배열을 방어타입 이름이 붙은 dict로 펼친다 (부동소수 오차를 없애려 소수 3자리로 반올림)
chart = {attack_type.lower(): {TYPES[index].lower(): round(effectiveness[attack_type][index], 3) for index in range(len(TYPES))} for attack_type in effectiveness}

# 도감번호 → 한글 종 이름 (PokeAPI 언어 코드 3 = 한국어)
ko_species = {int(row['pokemon_species_id']): row['name'] for row in csv.DictReader(open('data/species_names.csv', encoding='utf-8')) if row['local_language_id']=='3'}
# 기술 이름 표 두 방향: 정규화한 영문명 → 기술 id (언어 9 = 영어), 기술 id → 한글명 (언어 3)
en_move, ko_move = {}, {}
for row in csv.DictReader(open('data/move_names.csv', encoding='utf-8')):
    if row['local_language_id']=='9':
        en_move[re.sub(r'[^a-z0-9]','',row['name'].lower())] = row['move_id']
    if row['local_language_id']=='3':
        ko_move[row['move_id']] = row['name']

def move_ko(move_id):
    # 게임마스터 기술 id(예: 'MUD_SLAP_FAST') → 한글 기술명.
    # 빠른 기술은 '_FAST' 접미사가 붙어 있어 PokeAPI 이름과 맞추려면 떼어내야 한다
    base = re.sub(r'_FAST$','',move_id)
    # 웨더볼·히든파워처럼 타입별로 id가 갈리는 기술: 'WEATHER_BALL_FIRE' → 본체 + 타입 접미사
    # 정규식 r'^(.*)_(FIRE|WATER|ICE|ROCK|NORMAL)$' 로 뒤의 타입 토큰을 분리한다
    match = re.match(r'^(.*)_(FIRE|WATER|ICE|ROCK|NORMAL)$', base)
    suffix = ''
    # 타입 접미사를 가지는 기술만 대상으로 한다 (다른 기술의 이름 끝이 우연히 걸리는 것을 막음)
    if match and base.startswith(('WEATHER_BALL','HIDDEN_POWER')):
        base, suffix = match.group(1), f"({TYPE_KO[match.group(2).lower()]})"
    korean_move_name = ko_move.get(en_move.get(re.sub(r'[^a-z0-9]','',base.lower())))
    # 한글 이름을 못 찾으면 id를 사람이 읽을 수 있게 다듬어 노출한다
    return (korean_move_name + suffix) if korean_move_name else move_id.replace('_',' ').title()

# 랭킹 데이터 전체에서 등장하는 스프라이트 id 수집
# (전 종의 폼 데이터를 다 실으면 dex.json이 너무 커지므로 화면에 나오는 것만 담는다)
referenced_sprite_ids = set()
def collect_sprite_ids(value):
    # 랭킹 JSON은 파일마다 구조가 달라서(리그별 dict, 티어별 dict, 배열…) 전체를 재귀 순회해
    # 'sprite' 키만 긁어모은다
    if isinstance(value, list):
        for item in value:
            collect_sprite_ids(item)
    elif isinstance(value, dict):
        sprite_value = value.get('sprite')
        if isinstance(sprite_value, int) or (isinstance(sprite_value, str) and sprite_value.isdigit()):
            referenced_sprite_ids.add(int(sprite_value))
        for item in value.values():
            collect_sprite_ids(item)
for path in ('data/pvp.json', 'data/pve.json', 'data/pve_easy.json', 'data/dynamax.json', 'data/dynamax_tier.json', 'data/value.json', 'data/sheet.json'):
    if os.path.exists(path):
        collect_sprite_ids(json.load(open(path, encoding='utf-8')))

# 2026-09-03 메가/원시 진화: 랭킹에 없어도 항상 폼 데이터·진화 계보 연결이 되도록 스프라이트 id를 먼저 전부 수집
megas_map = {}  # 도감번호(문자열) → [{sprite, label}, ...]
for template in game_master:
    pokemon_settings = template['data'].get('pokemonSettings')
    if not pokemon_settings or 'stats' not in pokemon_settings or not pokemon_settings.get('tempEvoOverrides'):
        continue
    # templateId는 'V0006_POKEMON_CHARIZARD' 형태 — 1~4번째 문자가 도감번호
    mega_dex = int(template['templateId'][1:5])
    mega_form = pokemon_settings.get('form','')
    # 코스튬·이벤트 한정 폼은 건너뛴다. 종족값은 기본 폼과 같은데 폼 이름만 달라서,
    # 그대로 두면 PokeAPI에 없는 스프라이트를 찾다가 기본 스프라이트로 되돌아온 중복 항목이 생긴다
    # (COPY: 흉내내기/복사 폼, COSTUME·FASHION·HOLIDAY·계절·연도 접미사: 모자 쓴 피카츄류,
    #  NOEVOLVE: 진화 못 하는 특수 개체, GOFEST·ADVENTURE: 이벤트 배포 개체)
    if any(keyword in mega_form for keyword in ('COPY','COSTUME','FALL_2019','_2020','_2021','_2022','_2023','_2024','_2025','NOEVOLVE','GOFEST','ADVENTURE','FASHION','HOLIDAY','SPRING','SUMMER','WINTER')):
        continue
    mega_form_label = label_from_gm(pokemon_settings['pokemonId'], mega_form)
    # 라벨 표에 없는 폼이면 None → 우리가 표기할 방법이 없으니 제외
    if mega_form_label is None:
        continue
    for temp_evolution in pokemon_settings['tempEvoOverrides']:
        if 'stats' not in temp_evolution or 'tempEvoId' not in temp_evolution:
            continue
        # 'TEMP_EVOLUTION_MEGA_X' → '메가X', 'TEMP_EVOLUTION_PRIMAL' → '원시'
        mega_label = temp_evolution['tempEvoId'].replace('TEMP_EVOLUTION_','').replace('MEGA_','메가').replace('MEGA','메가').replace('PRIMAL','원시')
        sprite_identifier = sprite_id(mega_dex, f'{mega_label} {mega_form_label}'.strip())
        entries = megas_map.setdefault(str(mega_dex), [])
        # 서로 다른 폼이 같은 스프라이트로 떨어지는 경우가 있어 중복을 걸러 넣는다
        if not any(entry['sprite'] == sprite_identifier for entry in entries):
            entries.append({'sprite': sprite_identifier, 'label': mega_label})
referenced_sprite_ids |= {entry['sprite'] for entry_list in megas_map.values() for entry in entry_list}

# 스프라이트 id → 도감번호 (PokeAPI pokemon.csv)
sprite_dex = {}
for row in csv.DictReader(open('data/pokemon.csv', encoding='utf-8')):
    sprite_dex[int(row['id'])] = int(row['species_id'])
# 등장한 스프라이트들의 소속 종 집합 (폼 스프라이트는 기본 종 번호로 접힌다)
ranked_dex = {sprite_dex.get(referenced_id, referenced_id) for referenced_id in referenced_sprite_ids}
referenced_sprite_ids |= ranked_dex  # 폼 스프라이트의 기본 폼도 포함해 forms 폴백이 항상 가능하게
# 2026-09-03 도감 페이지용: 게임마스터에 종족값이 있는 전 종의 기본 폼을 포함
all_dex = {int(template['templateId'][1:5]) for template in game_master
           if template['data'].get('pokemonSettings', {}).get('stats', {}).get('baseAttack')}
referenced_sprite_ids |= all_dex
# 2026-09-05 저장소가 직접 번호를 배정한 폼(아머드 뮤츠 등)은 순위표에 안 걸려도 반드시 포함한다.
# 이 번호를 빠뜨리면 상세 팝업이 forms 폴백으로 기본 폼(일반 뮤츠)의 종족값·기술을 보여 준다 — 오정보.
referenced_sprite_ids |= set(LOCAL_FORMS.values())

# 진화 계보: evolution_chain_id 로 가족을 묶고 evolves_from 로 단계를 계산
chain_members, parent = {}, {}
for row in csv.DictReader(open('data/pokemon_species.csv', encoding='utf-8')):
    species_id, chain_id = int(row['id']), int(row['evolution_chain_id'])
    chain_members.setdefault(chain_id, []).append(species_id)
    if row['evolves_from_species_id']:
        parent[species_id] = int(row['evolves_from_species_id'])

def depth(species_id):
    # 진화 이전 종을 몇 번 거슬러 올라갈 수 있는지 = 진화 단계 (기본형 0, 1차 진화 1 …)
    distance = 0
    while species_id in parent:
        species_id = parent[species_id]
        distance += 1
    return distance

evo, names = {}, {}
for chain_id, members in chain_members.items():
    # 랭킹에 한 마리도 등장하지 않는 가족은 상세 팝업에서 쓰이지 않으므로 건너뛴다
    if not (set(members) & ranked_dex):
        continue
    stages = {}
    for member in sorted(members):
        stages.setdefault(depth(member), []).append(member)
    # 단계 순으로 정렬한 2차원 배열 — 가족 구성원 모두가 같은 배열을 공유한다
    family = [stages[stage_depth] for stage_depth in sorted(stages)]
    for member in members:
        evo[member] = family
        names[member] = ko_species.get(member, str(member))

# 폼별 상세 (랭킹에 등장하는 스프라이트만): 타입·종족값·배울 수 있는 기술
forms = {}
def put(sprite_identifier, name, types, stats, quick_moves, elite_quick_moves, charged_moves, elite_charged_moves):
    # 등장하지 않는 스프라이트는 담지 않고, 이미 담은 스프라이트는 첫 번째 것을 유지한다
    # (같은 스프라이트로 접히는 폼이 여러 개일 때 앞선 게임마스터 항목이 우선)
    if sprite_identifier not in referenced_sprite_ids or sprite_identifier in forms:
        return
    forms[sprite_identifier] = {
        'name': name,
        'types': [type_name.lower() for type_name in types],
        'atk': stats['baseAttack'], 'def': stats['baseDefense'], 'hp': stats['baseStamina'],
        # [한글 기술명, 엘리트 여부(1/0)] — 엘리트는 이벤트·전용 기술머신으로만 배우는 기술
        'fast': [[move_ko(move_id), 1 if move_id in elite_quick_moves else 0] for move_id in quick_moves],
        'charged': [[move_ko(move_id), 1 if move_id in elite_charged_moves else 0] for move_id in charged_moves],
    }
for template in game_master:
    pokemon_settings = template['data'].get('pokemonSettings')
    if not pokemon_settings or 'stats' not in pokemon_settings or not pokemon_settings['stats'].get('baseAttack'):
        continue
    dex_number = int(template['templateId'][1:5])
    form = pokemon_settings.get('form','')
    # 위 메가 수집과 같은 이유로 코스튬·이벤트 한정 폼 제외 (기본 폼과 종족값이 같은 중복 항목)
    if any(keyword in form for keyword in ('COPY','COSTUME','FALL_2019','_2020','_2021','_2022','_2023','_2024','_2025','NOEVOLVE','GOFEST','ADVENTURE','FASHION','HOLIDAY','SPRING','SUMMER','WINTER')):
        continue
    label = label_from_gm(pokemon_settings['pokemonId'], form)
    if label is None:
        continue
    # 'POKEMON_TYPE_FIRE' → 'FIRE'. 단일 타입이면 type2가 없다
    types = [type_name.replace('POKEMON_TYPE_','') for type_name in (pokemon_settings.get('type'), pokemon_settings.get('type2')) if type_name]
    elite_quick_moves, elite_charged_moves = set(pokemon_settings.get('eliteQuickMove',[])), set(pokemon_settings.get('eliteCinematicMove',[]))
    quick_moves = [move_id for move_id in pokemon_settings.get('quickMoves',[]) + pokemon_settings.get('eliteQuickMove',[]) if isinstance(move_id,str)]
    # FRUSTRATION·RETURN은 섀도우/퓨리파이 전용 특수 기술이라 기술 목록에서 뺀다
    charged_moves = [move_id for move_id in pokemon_settings.get('cinematicMoves',[]) + pokemon_settings.get('eliteCinematicMove',[]) if isinstance(move_id,str) and move_id not in ('FRUSTRATION','RETURN')]
    # 기술이 하나도 없는 항목은 전투에 쓰이지 않는 자리표시자 데이터
    if not quick_moves or not charged_moves:
        continue
    put(sprite_id(dex_number, label), label, types, pokemon_settings['stats'], quick_moves, elite_quick_moves, charged_moves, elite_charged_moves)
    # 메가/원시 폼: 종족값과 타입만 덮어쓰고 기술 목록은 기본 폼과 같다
    for temp_evolution in pokemon_settings.get('tempEvoOverrides',[]):
        if 'stats' not in temp_evolution or 'tempEvoId' not in temp_evolution:
            continue
        mega_label = temp_evolution['tempEvoId'].replace('TEMP_EVOLUTION_','').replace('MEGA_','메가').replace('MEGA','메가').replace('PRIMAL','원시')
        # 타입 덮어쓰기가 없는 메가는 기본 폼 타입을 그대로 쓴다
        mega_types = [type_name.replace('POKEMON_TYPE_','') for type_name in (temp_evolution.get('typeOverride1'), temp_evolution.get('typeOverride2')) if type_name] or types
        mega_name = f'{mega_label} {label}'.strip()
        put(sprite_id(dex_number, mega_name), mega_name, mega_types, temp_evolution['stats'], quick_moves, elite_quick_moves, charged_moves, elite_charged_moves)

# 2026-09-03 도감 페이지용: 전 종 이름 보강 (진화 계보에 없던 종 포함)
for dex_number in all_dex:
    names.setdefault(dex_number, ko_species.get(dex_number, str(dex_number)))

# 2026-09-02 보스 티어 자동 판정용: 도감번호 → 클래스 (L 전설 / M 환상 / U 울트라비스트)
cls_map = {}
for template in game_master:
    pokemon_settings = template['data'].get('pokemonSettings', {})
    pokemon_class = pokemon_settings.get('pokemonClass')
    if not pokemon_class:
        continue
    # 'V0150_POKEMON_MEWTWO' 형태의 templateId에서만 도감번호를 뽑는다 (폼 템플릿 등은 형식이 다름)
    match = re.match(r'^V(\d{4})_POKEMON_', template['templateId'])
    if match:
        cls_map[str(int(match.group(1)))] = {'POKEMON_CLASS_LEGENDARY': 'L', 'POKEMON_CLASS_MYTHIC': 'M', 'POKEMON_CLASS_ULTRA_BEAST': 'U'}[pokemon_class]

# 2026-09-03 CP 계산용 CP 배율 — 만렙 50, 레이드 보상 20/날씨부스트 25, 야생 최대 30/날씨부스트 35 (실제 게임 레벨 캡 기준)
# cpMultiplier 배열은 레벨 1부터 시작하므로 레벨 n은 인덱스 n-1
cpm_arr = [template for template in game_master if 'playerLevel' in template['data']][0]['data']['playerLevel']['cpMultiplier']
cpm = {'l20': cpm_arr[19], 'l25': cpm_arr[24], 'l30': cpm_arr[29], 'l35': cpm_arr[34], 'l50': cpm_arr[49]}
cpms = [round(multiplier, 6) for multiplier in cpm_arr[:51]]  # CP 계산기: 레벨 n = 인덱스 n-1, 반레벨은 프론트에서 보간

# 최종 산출물. 키 순서·이름은 프론트(components/detail.js · views/*.js)가 그대로 참조한다
dex_output = {
    'chart': chart,
    'cpm': cpm,
    'cpms': cpms,
    # dex: 폼 스프라이트만 담는다 (스프라이트 id와 도감번호가 같은 기본 폼은 넣을 필요가 없음)
    # 저장소 배정 번호(아머드 뮤츠 등)는 PokeAPI 표에 없으므로 여기서 직접 원종 번호를 붙인다 —
    # 이게 없으면 프런트 dexOf()가 원종을 못 찾아 진화 단계·즐겨찾기 ★·활용처가 통째로 사라진다.
    'dex': {**{str(referenced_id): sprite_dex[referenced_id] for referenced_id in referenced_sprite_ids
               if referenced_id in sprite_dex and sprite_dex[referenced_id] != referenced_id},
            **{str(local_sprite): local_dex for (local_dex, _label), local_sprite in LOCAL_FORMS.items()}},
    'names': names,
    'evo': {str(dex_number): family for dex_number, family in evo.items()},
    'forms': {str(sprite_identifier): form_data for sprite_identifier, form_data in forms.items()},
    # forms에 실제 데이터가 있는 메가만 남긴다 (스프라이트만 있고 상세가 없으면 팝업이 빈다)
    'megas': {dex_key: entries for dex_key, entries in megas_map.items() if any(entry['sprite'] in forms for entry in entries)},
    'cls': cls_map,
    'rel': sorted(released_dex | extra_rel),  # 2026-09-03 도감 [미구현] 태그용 — PvPoke released + 수동 보정
}
json.dump(dex_output, open('data/dex.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('dex.json:', len(evo), 'evo species /', len(forms), 'forms /', len(referenced_sprite_ids), 'sprites referenced')
