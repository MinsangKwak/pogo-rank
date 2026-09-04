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
import subprocess

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
for data_path in ('data/pvp.json', 'data/pve.json', 'data/pve_easy.json', 'data/dynamax.json', 'data/dynamax_tier.json', 'data/value.json', 'data/sheet.json'):
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
os.makedirs('data/sprites', exist_ok=True)
# 2026-09-03 v2.0.0: 없는 것만 16개씩 병렬 다운로드 (CI는 actions/cache로 대부분 재사용)
from concurrent.futures import ThreadPoolExecutor
missing_ids = [sprite_identifier for sprite_identifier in sprite_ids
               if not os.path.exists(f'data/sprites/{sprite_identifier}.png')]


# 스프라이트 png 한 장을 PokeAPI 저장소에서 내려받아 캐시 폴더에 저장한다 (실패해도 멈추지 않는다)
def download_sprite(sprite_identifier):
    subprocess.run(['curl', '-sSL', '-o', f'data/sprites/{sprite_identifier}.png', f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{sprite_identifier}.png'])


if missing_ids:
    with ThreadPoolExecutor(16) as executor:
        # map 은 지연 평가라서 list() 로 감싸 모든 다운로드가 끝나게 한다
        list(executor.map(download_sprite, missing_ids))
    print(f'downloaded {len(missing_ids)} new sprites')
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
