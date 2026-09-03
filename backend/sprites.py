import json, base64, os, subprocess
# 랭킹에 등장하는 스프라이트만 내려받아 base64로 묶는다.
# 시트 목록(sheet.json)처럼 중첩 구조도 있으므로 'sprite' 키를 재귀로 수집한다
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
# 상세 팝업의 진화 계보에 나오는 종의 기본 스프라이트도 포함
if os.path.exists('data/dex.json'):
    dx = json.load(open('data/dex.json', encoding='utf-8'))
    for family in dx['evo'].values():
        for stage in family: ids |= set(stage)
    # 2026-09-03 도감 페이지: 전 종 기본 스프라이트 포함
    ids |= {int(k) for k in dx.get('names', {})}
os.makedirs('data/sprites', exist_ok=True)
# 2026-09-03 v2.0.0: 없는 것만 16개씩 병렬 다운로드 (CI는 actions/cache로 대부분 재사용)
from concurrent.futures import ThreadPoolExecutor
missing = [i for i in ids if not os.path.exists(f'data/sprites/{i}.png')]
def fetch(i):
    subprocess.run(['curl', '-sSL', '-o', f'data/sprites/{i}.png', f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{i}.png'])
if missing:
    with ThreadPoolExecutor(16) as ex: list(ex.map(fetch, missing))
    print(f'downloaded {len(missing)} new sprites')
out, failed = {}, []
for i in ids:
    b = open(f'data/sprites/{i}.png', 'rb').read()
    if b[:4] == b'\x89PNG': out[str(i)] = 'data:image/png;base64,' + base64.b64encode(b).decode()
    else: failed.append(i)
json.dump(out, open('data/sprites.json', 'w'))
print(len(out), 'sprites', ('/ failed: ' + str(sorted(failed)) if failed else ''))
