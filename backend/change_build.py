# change_build.py — 시즌 기술 변경 안내 데이터(data/move_changes.json) 생성
#
# 왜 필요한가
#   포켓몬 GO는 시즌마다 기술 위력·에너지를 조정하고 일부 종에게 새 기술을 준다.
#   조정이 적용되면 게임마스터 값이 바뀌므로 우리 티어표는 다음 빌드에서 저절로 따라간다.
#   하지만 "무엇이 왜 바뀌었는지"와 "적용 전에 미리 알기"는 계산으로 나오지 않으므로,
#   변경 목록만 사람이 적어 두고(backend/config/move_changes.txt) 나머지는 여기서 자동으로 채운다.
#
# 사람이 적는 것   기술 id · 이전/이후 위력 · 적용일 (공식 공지에서 옮겨 적는다)
# 자동으로 채우는 것 한글 기술명 · 한글 포켓몬명 · 스프라이트 id ·
#                  "그 기술을 쓰는 포켓몬이 누구인가" (게임마스터에서 역인덱스)
#
# 입력
#   backend/config/move_changes.txt  시즌 변경 목록 (수동 관리)
#   data/pm.json                     게임마스터 덤프 (종별 기술 목록·기술 타입)
#   data/move_names.csv              PokeAPI 기술 이름 (영문 → id, id → 한글)
#   data/species_names.csv           PokeAPI 종 이름 (names.py 가 읽어 ko_species 로 제공)
#
# 출력 (data/move_changes.json)
#   season    시즌 이름                    date     적용일 'YYYY-MM-DD'
#   moves     위력·에너지가 바뀐 기술 목록   newMoves 새로 배우는 기술 목록
#   affected  스프라이트 id → 그 포켓몬에 걸린 변경 요약 (프론트 뱃지가 이 표만 본다)
#
# 파이프라인 위치
#   dex_build.py 다음, build.py(2차) 앞. 게임마스터만 있으면 되므로 앞뒤 순서에 예민하지 않지만,
#   결과가 data.js 에 실려야 하므로 최종 빌드보다는 앞이어야 한다.

import json
import csv
import re
import os

from names import ko_species
from sprite import sprite_id
from names import label_from_gm

CONFIG_PATH = 'backend/config/move_changes.txt'
OUTPUT_PATH = 'data/move_changes.json'

# 설정 파일이 없으면 "이번 시즌 변경 없음"으로 빈 파일을 만들고 끝낸다.
# (시즌 사이 기간에는 파일을 지워 두면 사이트에서 안내가 통째로 사라진다)
if not os.path.exists(CONFIG_PATH):
    json.dump({}, open(OUTPUT_PATH, 'w', encoding='utf-8'), ensure_ascii=False)
    print('move_changes: 설정 파일이 없어 건너뜀')
    raise SystemExit

game_master = json.load(open('data/pm.json'))

# ── 기술 한글 이름 ────────────────────────────────────────────────────────────
# move_names.csv 는 (기술 id, 언어 id, 이름) 형태다. 영문 이름을 영숫자만 남긴 슬러그로
# 정규화해 PokeAPI move_id 를 찾고, 그 id 로 한국어(언어 3) 이름을 얻는다.
move_id_by_english_slug, korean_move_names = {}, {}
for row in csv.DictReader(open('data/move_names.csv', encoding='utf-8')):
    if row['local_language_id'] == '9':
        move_id_by_english_slug[re.sub(r'[^a-z0-9]', '', row['name'].lower())] = row['move_id']
    if row['local_language_id'] == '3':
        korean_move_names[row['move_id']] = row['name']

def korean_move_name(game_master_move_id):
    # 게임마스터 기술 id → 한글 기술명. 못 찾으면 원본 id 를 그대로 돌려준다(빌드 로그에서 눈에 띄도록)
    base = re.sub(r'_FAST$', '', game_master_move_id)
    korean = korean_move_names.get(move_id_by_english_slug.get(re.sub(r'[^a-z0-9]', '', base.lower())))
    return korean or game_master_move_id

# ── 게임마스터에 실제로 존재하는 기술 id ─────────────────────────────────────
# 설정 파일에는 접미사 없이 'TAKE_DOWN' 이라고 적어도 되게 하려고, 실제 id 로 맞춰 주는 표를 만든다
existing_move_ids = set()
for template in game_master:
    data = template.get('data', {})
    if 'combatMove' in data:
        existing_move_ids.add(data['combatMove']['uniqueId'])
    if 'moveSettings' in data:
        existing_move_ids.add(data['moveSettings']['movementId'])

def resolve_move_id(written_id):
    # 적힌 그대로 있으면 그대로, 없으면 빠른 기술 접미사를 붙여 다시 찾는다
    if written_id in existing_move_ids:
        return written_id
    if f'{written_id}_FAST' in existing_move_ids:
        return f'{written_id}_FAST'
    return written_id   # 못 찾아도 진행하고 아래에서 경고를 남긴다

# ── 종 인덱스: (포켓몬ID, 폼) → 스프라이트·한글 이름·보유 기술 ────────────────
# templateId 는 'V0026_POKEMON_RAICHU' 꼴이라 앞 4자리가 도감번호다
species_index = {}
for template in game_master:
    pokemon_settings = template.get('data', {}).get('pokemonSettings')
    if not pokemon_settings:
        continue
    template_id = template.get('templateId', '')
    if not re.match(r'^V\d{4}_POKEMON_', template_id):
        continue
    dex_number = int(template_id[1:5])
    pokemon_id = pokemon_settings['pokemonId']
    form = pokemon_settings.get('form')
    form_label = label_from_gm(pokemon_id, form) or ''
    korean_name = ko_species.get(dex_number, pokemon_id)
    species_index[(pokemon_id, form)] = {
        'dex': dex_number,
        'sprite': sprite_id(dex_number, form_label),
        'name': f'{form_label} {korean_name}'.strip(),
        # 일반 기술과 전용(레거시) 기술을 나눠 둔다 — 레거시는 지금 배울 수 없어 표시를 달리한다
        'moves': set(pokemon_settings.get('quickMoves', []) or []) | set(pokemon_settings.get('cinematicMoves', []) or []),
        'legacy': set(pokemon_settings.get('eliteQuickMove', []) or []) | set(pokemon_settings.get('eliteCinematicMove', []) or []),
    }

# ── 설정 파일 파싱 ───────────────────────────────────────────────────────────
season, apply_date = '', ''
changed_moves, new_move_lines, warnings = [], [], []
for raw_line in open(CONFIG_PATH, encoding='utf-8'):
    line = raw_line.split('#')[0].strip()
    if not line:
        continue
    # 비고는 '|' 뒤에 온다
    body, _, note = (part.strip() for part in line.partition('|'))
    tokens = body.split()
    keyword = tokens[0]
    if keyword == 'SEASON':
        season = ' '.join(tokens[1:])
    elif keyword == 'DATE':
        apply_date = tokens[1]
    elif keyword == 'M':
        # M <up|down> <기술ID> <이전위력> <이후위력>
        kind, written_id, power_before, power_after = tokens[1], tokens[2], int(tokens[3]), int(tokens[4])
        move_id = resolve_move_id(written_id)
        if move_id not in existing_move_ids:
            warnings.append(f'게임마스터에 없는 기술 id: {written_id}')
        changed_moves.append({'id': move_id, 'ko': korean_move_name(move_id), 'kind': kind,
                              'from': power_before, 'to': power_after, 'note': note})
    elif keyword == 'E':
        # E <기술ID> — 위력은 그대로고 에너지만 바뀐 기술
        move_id = resolve_move_id(tokens[1])
        if move_id not in existing_move_ids:
            warnings.append(f'게임마스터에 없는 기술 id: {tokens[1]}')
        changed_moves.append({'id': move_id, 'ko': korean_move_name(move_id), 'kind': 'energy',
                              'from': 0, 'to': 0, 'note': note})
    elif keyword == 'N':
        # N <포켓몬ID> <폼|-> <기술ID>
        pokemon_id, written_form, written_move = tokens[1], tokens[2], tokens[3]
        new_move_lines.append((pokemon_id, None if written_form == '-' else written_form, resolve_move_id(written_move)))

# ── 새로 배우는 기술: 종 정보를 붙인다 ───────────────────────────────────────
new_moves = []
for pokemon_id, form, move_id in new_move_lines:
    # 폼을 안 적었으면 기본 폼('<POKEMON_ID>_NORMAL' 또는 폼 없음)을 찾는다
    entry = (species_index.get((pokemon_id, form)) if form
             else species_index.get((pokemon_id, f'{pokemon_id}_NORMAL')) or species_index.get((pokemon_id, None)))
    if not entry:
        warnings.append(f'게임마스터에 없는 종: {pokemon_id} {form or "-"}')
        continue
    new_moves.append({'sprite': entry['sprite'], 'name': entry['name'], 'dex': entry['dex'],
                      'move': korean_move_name(move_id), 'moveId': move_id})

# ── 영향받는 포켓몬 역인덱스 ─────────────────────────────────────────────────
# 스프라이트 id → {'up': [기술명...], 'down': [...], 'energy': [...], 'new': [...], 'legacy': [기술명...]}
# 프론트의 뱃지는 이 표 하나만 보고 "이 줄에 표시를 붙일지"를 정한다.
# legacy 는 "지금은 배울 수 없는 전용(레거시) 기술" 목록이다. 같은 포켓몬이 일반 기술과
# 레거시 기술 양쪽에서 영향을 받을 수 있으므로 종 단위 참·거짓이 아니라 기술 이름 목록으로 둔다.
affected = {}
def mark(sprite, bucket, move_name, is_legacy=False):
    entry = affected.setdefault(str(sprite), {})
    names = entry.setdefault(bucket, [])
    if move_name not in names:
        names.append(move_name)
    if is_legacy:
        legacy_names = entry.setdefault('legacy', [])
        if move_name not in legacy_names:
            legacy_names.append(move_name)

for change in changed_moves:
    for entry in species_index.values():
        if change['id'] in entry['moves']:
            mark(entry['sprite'], change['kind'], change['ko'])
        elif change['id'] in entry['legacy']:
            mark(entry['sprite'], change['kind'], change['ko'], is_legacy=True)
for item in new_moves:
    mark(item['sprite'], 'new', item['move'])

output = {'season': season, 'date': apply_date, 'moves': changed_moves, 'newMoves': new_moves, 'affected': affected}
json.dump(output, open(OUTPUT_PATH, 'w', encoding='utf-8'), ensure_ascii=False)

for warning in warnings:
    print(f'⚠ move_changes: {warning}')
print(f"move_changes: {season} {apply_date} · 기술 {len(changed_moves)}건 · 신규 {len(new_moves)}건 · 영향 종 {len(affected)}개")
