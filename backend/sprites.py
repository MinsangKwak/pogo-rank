# 랭킹에 등장하는 스프라이트만 내려받아 base64로 묶는다.
#
# 입력
#   data/pvp.json · pve.json · pve_easy.json · dynamax.json · dynamax_tier.json · value.json · sheet.json
#                     각 빌드 스크립트가 만든 랭킹 결과. 여기서 'sprite' 키 값을 모은다
#   data/dex.json     도감 데이터. 진화 계보(evo)와 전 종 이름표(names)의 스프라이트도 함께 모은다
#   data/sprites/*.png  PokeAPI 스프라이트 캐시 (없는 것만 새로 내려받는다)
#
# 출력
#   data/sprites/<id>.png  내려받은 원본 파일 (다음 빌드에서 캐시로 재사용)
#   data/sprites.json      { "<id>": "data:image/png;base64,..." } 프런트가 바로 쓰는 인라인 이미지 사전
#
# 관계
#   스프라이트 id 는 sprite.py 가 붙인 PokeAPI id 다. 이 스크립트는 다른 빌드 스크립트가 모두 끝난 뒤에 실행한다.

import json
import base64
import os
import shutil
import subprocess

from sprite import LOCAL_SPRITE_BASE, LOCAL_SPRITE_URL, sprite_id   # 2026-09-05 저장소 배정 번호 → 원본 번호 / 전용 그림 주소
from names import name_ko, species   # 2026-09-12 v3.19.0 Showdown 이름표를 만들 때 PvPoke 종 이름이 필요하다
import re

# 시트 목록(sheet.json)처럼 중첩 구조도 있으므로 'sprite' 키를 재귀로 수집한다
sprite_ids = set()


# JSON 값을 재귀로 훑어 'sprite' 키에 담긴 스프라이트 id 를 sprite_ids 에 모은다
def collect_sprite_ids(value):
    if isinstance(value, list):
        for item in value:
            collect_sprite_ids(item)
    elif isinstance(value, dict):
        sprite_value = value.get('sprite')
        # 빌드 스크립트에 따라 id 가 숫자 또는 숫자 문자열로 들어 있어 둘 다 받는다
        if isinstance(sprite_value, int) or (isinstance(sprite_value, str) and sprite_value.isdigit()):
            sprite_ids.add(int(sprite_value))
        # 'sprite' 를 찾았더라도 하위 구조에 다른 항목이 더 있을 수 있으므로 계속 내려간다
        for item in value.values():
            collect_sprite_ids(item)


# 랭킹 결과 파일들. 아직 만들지 않은 파일이 있을 수 있으므로 존재하는 것만 읽는다
# 2026-09-06 v2.10.0 (QA-44) bosses.json · pve_full.json · pvp_all.json 추가 — 순위표 상위권에는 없지만
# 화면에 나오는 폼(IF 탭 보스 목록의 메가 샤크니아, 도감 진화 줄의 ⚡메가 버튼, PvP 전체 순위의 리전 폼)이
# 수집 대상에서 빠져 몬스터볼 자리표시로 보이던 문제. "어디에든 sprite 로 적힌 번호는 전부 받는다"가 원칙
for data_path in ('data/pvp.json', 'data/pve.json', 'data/pve_easy.json', 'data/dynamax.json', 'data/dynamax_tier.json', 'data/dynamax_tank.json', 'data/value.json', 'data/sheet.json',
                  'data/bosses.json', 'data/pve_full.json', 'data/pvp_all.json',
                  'data/gameday.json'):   # 2026-09-08 v2.25.0 레이드 보스·알 부화 목록도 그림이 필요하다
    if os.path.exists(data_path):
        collect_sprite_ids(json.load(open(data_path, encoding='utf-8')))
# 상세 팝업의 진화 계보에 나오는 종의 기본 스프라이트도 포함
if os.path.exists('data/dex.json'):
    dex_data = json.load(open('data/dex.json', encoding='utf-8'))
    # evo 는 {계보 대표 id: [[1단계 id...], [2단계 id...], ...]} 구조다
    for family in dex_data['evo'].values():
        for stage in family:
            sprite_ids |= set(stage)
    # 2026-09-03 도감 페이지: 전 종 기본 스프라이트 포함
    sprite_ids |= {int(dex_number) for dex_number in dex_data.get('names', {})}
    # 2026-09-06 v2.10.0 상세 팝업 폼 데이터(forms)와 ⚡메가 버튼(megas)에 실린 스프라이트도 전부 —
    # 메가 샤크니아(10070)처럼 랭킹엔 없지만 도감에서 열리는 폼이 여기서만 잡힌다
    sprite_ids |= {int(sprite_key) for sprite_key in dex_data.get('forms', {})}
    sprite_ids |= {entry['sprite'] for entries in dex_data.get('megas', {}).values() for entry in entries}
# 2026-09-05 저장소가 번호를 배정한 폼은 어느 랭킹에도 안 걸릴 수 있으므로 항상 포함한다
sprite_ids |= set(LOCAL_SPRITE_BASE)
os.makedirs('data/sprites', exist_ok=True)
# 2026-09-03 v2.0.0: 없는 것만 16개씩 병렬 다운로드 (CI는 actions/cache로 대부분 재사용)
from concurrent.futures import ThreadPoolExecutor
missing_ids = [sprite_identifier for sprite_identifier in sprite_ids
               if not os.path.exists(f'data/sprites/{sprite_identifier}.png')]


# 스프라이트 png 한 장을 PokeAPI 저장소에서 내려받아 캐시 폴더에 저장한다 (실패해도 멈추지 않는다)
def download_sprite(sprite_identifier):
    subprocess.run(['curl', '-sSL', '-o', f'data/sprites/{sprite_identifier}.png', f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{sprite_identifier}.png'])


# 2026-09-05 저장소가 직접 배정한 번호(90000번대)는 PokeAPI 에 없으므로 일반 다운로드 목록에서 뺀다.
# 그림은 (1) LOCAL_SPRITE_URL 에 전용 주소가 있으면 거기서 받고, (2) 없거나 실패하면 원본 폼 png 를 복사한다.
local_ids = [sprite_identifier for sprite_identifier in sprite_ids if sprite_identifier in LOCAL_SPRITE_BASE]
missing_ids = [sprite_identifier for sprite_identifier in missing_ids if sprite_identifier not in LOCAL_SPRITE_BASE]

if missing_ids:
    with ThreadPoolExecutor(16) as executor:
        # map 은 지연 평가라서 list() 로 감싸 모든 다운로드가 끝나게 한다
        list(executor.map(download_sprite, missing_ids))
    print(f'downloaded {len(missing_ids)} new sprites')


# 파일이 진짜 PNG 인지 (curl 이 404 본문을 저장한 경우를 걸러 낸다)
def is_png(path):
    return os.path.exists(path) and open(path, 'rb').read(4) == b'\x89PNG'


for sprite_identifier in local_ids:
    base_identifier = LOCAL_SPRITE_BASE[sprite_identifier]
    base_path = f'data/sprites/{base_identifier}.png'
    local_path = f'data/sprites/{sprite_identifier}.png'
    # 원본이 아직 없으면(순서 문제) 먼저 받아 둔다 — 폴백 복사에 필요하다
    if not os.path.exists(base_path):
        download_sprite(base_identifier)
    # 캐시에 있는 파일이 원본의 복사본(v2.7.0 방식)이면 전용 그림이 아니므로 다시 받을 대상으로 본다.
    # CI 의 actions/cache 가 예전 복사본을 그대로 되살리기 때문에 "파일이 있으면 통과"로는 부족하다
    is_copy_of_base = is_png(local_path) and is_png(base_path) and open(local_path, 'rb').read() == open(base_path, 'rb').read()
    needs_fetch = sprite_identifier in LOCAL_SPRITE_URL and (not is_png(local_path) or is_copy_of_base)
    if needs_fetch:
        subprocess.run(['curl', '-fsSL', '--retry', '3', '-o', local_path, LOCAL_SPRITE_URL[sprite_identifier]])
        if is_png(local_path):
            print(f'local sprite {sprite_identifier} ← 전용 그림 다운로드')
            continue
        # 실패하면 깨진 파일을 남기지 않는다 (다음 빌드에서 다시 시도되도록)
        if os.path.exists(local_path):
            os.remove(local_path)
        print(f'local sprite {sprite_identifier} 전용 그림 다운로드 실패 — 원본 복사로 대체')
    if not is_png(local_path) and is_png(base_path):
        shutil.copy(base_path, local_path)
        print(f'local sprite {sprite_identifier} ← {base_identifier} 복사')
# ── 2026-09-12 v2.67.0 움직이는 그림 (상세 화면 전용) ────────────────────────
#
# 무엇을
#   같은 PokeAPI 저장소의 B/W 애니메이션 GIF. 정지 png 와 같은 스프라이트 id 를 쓴다.
#
# 왜 상세 화면에만
#   GIF 한 장이 평균 54KB 로 정지 png(평균 4KB)의 13배다. 도감 첫 화면은 한 번에
#   100장을 그리므로 목록까지 바꾸면 화면 한 장이 400KB → 5.4MB 가 된다.
#   상세는 한 번에 한 마리라 그 값이 그대로 1장이다.
#
# 없는 종은
#   1,172개 중 949개(81%)만 있다 — 6세대 이후와 폼 변형 상당수가 없다.
#   없으면 프런트가 지금까지처럼 정지 png 를 그린다(sprite.js spriteAnimSrc → null).
#
# 없는 것을 매번 다시 묻지 않으려고 <id>.miss 빈 파일을 남긴다 —
# CI 의 actions/cache 가 이 폴더를 통째로 되살리므로 404 요청이 반복되지 않는다
#
# 2026-09-12 v3.19.0 두 번째 출처 — Pokémon Showdown 의 애니메이션 스프라이트(play.pokemonshowdown.com/sprites/ani/).
#   PokeAPI 에 없는 6~8세대·메가·리전 폼 209종 중 195종이 여기에 있다. 남는 것은 9세대(오거폰·페차런트·
#   아이언 계열)와 일부 폼 — 공개된 애니메이션이 없어 프런트가 CSS 로 살짝 흔든다(list.css sprite-idle).
#   이름표는 PvPoke 종 이름에서 만든다: 'Mr. Mime (Galarian)' → mrmime-galar, 'Charizard (Mega X)' → charizard-megax.
#   폼 이름표가 없으면(Meowstic (Female) 등) 기본 폼으로 되돌아간다.
#   표시는 그림 아래 어디에도 없지만 NOTICE.md 에 출처를 적었다.
# 표식 파일 이름을 .none → .miss 로 바꿨다 — 옛 표식은 한 출처만 물어본 결과라 지우고 다시 묻는다
ANIM_DIR = 'data/sprites-anim'
ANIM_URL = ('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
            '/versions/generation-v/black-white/animated/{}.gif')
SHOWDOWN_URL = 'https://play.pokemonshowdown.com/sprites/ani/{}.gif'
os.makedirs(ANIM_DIR, exist_ok=True)
for legacy in os.listdir(ANIM_DIR):
    if legacy.endswith('.none'):
        os.remove(f'{ANIM_DIR}/{legacy}')

SHOWDOWN_FORM = {'galarian': 'galar', 'alolan': 'alola', 'hisuian': 'hisui', 'paldean': 'paldea', 'mega x': 'megax', 'mega y': 'megay'}

def showdown_slug(species_name):
    # 'Urshifu (Rapid Strike)' → ('urshifu-rapidstrike', 'urshifu'). 섀도우는 그림이 같으니 폼에서 뺀다
    base, _, form = species_name.partition('(')
    base = re.sub(r'[^a-z0-9]', '', base.lower())
    form = re.sub(r'\s*shadow$', '', form.strip(') ').lower()).strip()
    if not form:
        return base, base
    form = SHOWDOWN_FORM.get(form, re.sub(r'[^a-z0-9]', '', form))
    return f'{base}-{form}', base

# 스프라이트 id → Showdown 이름표 후보 (폼 → 기본 폼 순). PvPoke 게임마스터에 있는 종만 만들 수 있다
showdown_slugs = {}
if os.path.exists('data/gm.json'):
    for entry in json.load(open('data/gm.json'))['pokemon']:
        if entry['speciesId'] not in species:
            continue
        _, form_label = name_ko(entry['speciesId'])
        try:
            sprite_identifier = sprite_id(entry['dex'], form_label)
        except Exception:
            continue
        showdown_slugs.setdefault(sprite_identifier, showdown_slug(entry['speciesName']))


def is_gif(path):
    return os.path.exists(path) and open(path, 'rb').read(6) in (b'GIF87a', b'GIF89a')


def download_anim(sprite_identifier):
    gif_path = f'{ANIM_DIR}/{sprite_identifier}.gif'
    urls = [ANIM_URL.format(sprite_identifier)]
    urls += [SHOWDOWN_URL.format(slug) for slug in dict.fromkeys(showdown_slugs.get(sprite_identifier, ()))]
    for url in urls:
        subprocess.run(['curl', '-fsSL', '--retry', '2', '-o', gif_path, url])
        if is_gif(gif_path):
            return
        if os.path.exists(gif_path):
            os.remove(gif_path)
    # 어느 출처에도 없으면 파일을 남기지 않고 "없음" 표시만 남긴다
    open(f'{ANIM_DIR}/{sprite_identifier}.miss', 'w').close()


anim_todo = [sprite_identifier for sprite_identifier in sprite_ids
             if not is_gif(f'{ANIM_DIR}/{sprite_identifier}.gif')
             and not os.path.exists(f'{ANIM_DIR}/{sprite_identifier}.miss')]
if anim_todo:
    with ThreadPoolExecutor(16) as executor:
        list(executor.map(download_anim, anim_todo))
    have = sum(1 for sprite_identifier in sprite_ids if is_gif(f'{ANIM_DIR}/{sprite_identifier}.gif'))
    print(f'animated: {len(anim_todo)} 시도 · 보유 {have}/{len(sprite_ids)}')

encoded_sprites = {}
failed_ids = []
for sprite_identifier in sprite_ids:
    png_bytes = open(f'data/sprites/{sprite_identifier}.png', 'rb').read()
    # PNG 시그니처 검사: 존재하지 않는 id 는 curl 이 404 본문을 그대로 저장하므로 걸러 낸다
    if png_bytes[:4] == b'\x89PNG':
        encoded_sprites[str(sprite_identifier)] = 'data:image/png;base64,' + base64.b64encode(png_bytes).decode()
    else:
        failed_ids.append(sprite_identifier)
json.dump(encoded_sprites, open('data/sprites.json', 'w'))
print(len(encoded_sprites), 'sprites', ('/ failed: ' + str(sorted(failed_ids)) if failed_ids else ''))
