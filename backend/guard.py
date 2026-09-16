# ─────────────────────────────────────────────────────────────────────────────
# guard.py — 빌드 산출물 검문 · 전날 데이터 폴백 (2026-09-16 v3.47.0)
#
# 왜 필요한가
#   원본(PvPoke · PokeAPI · ScrapedDuck · 구글 시트)이 내려받아지긴 했는데 **내용이 비거나 줄어든** 날이 있다.
#   지금까지는 그 결과가 그대로 실렸다 — 표가 통째로 비면 그 화면은 아예 안 나온다.
#   다운로드 실패(fetch_data.sh, exit 1)와 달리 "받았는데 이상한" 경우는 아무도 막지 않았다.
#
# 어떻게 하나
#   빌드 마지막 단계에서 data.js 에 실릴 표를 하나씩 **직전 정상본**(snapshot/tables/<이름>.json)과 견준다.
#     · 잎 개수(문자열·숫자 개수)가 직전의 70% 미만이거나 0 → 직전 정상본으로 대체하고 경고
#     · 직전 정상본이 없는데 비었다 → 필수 표면 빌드를 멈춘다 (Pages 는 직전 배포를 그대로 보여 준다 = 그것이 폴백이다)
#     · 정상 → 직전 정상본을 이번 것으로 갱신
#   대체된 표 이름은 data.js 의 DATA_STALE · build.json 의 stale 에 남는다.
#
# 왜 잎 개수인가
#   표마다 모양이 다르다 ({타입: [행]} · [행] · {id: {...}}). 잎을 세면 모양을 몰라도 "내용의 양" 이 나온다.
#   줄어드는 것만 본다 — 늘어나는 것은 새 포켓몬·새 이벤트라 정상이다.
#
# 왜 저장소가 아니라 캐시인가
#   표 전체는 1.6MB 라 매일 커밋하면 저장소가 해마다 수십 MB 씩 자란다. 직전 정상본은 소스가 아니라 운영 산출물이다 —
#   순위 스냅샷(snapshot/ranks.json)과 달리 잃어도 화면이 틀려지지 않는다(폴백이 한 번 없을 뿐).
#   그래서 snapshot/tables/ 는 gitignore 하고 CI 는 스프라이트처럼 actions/cache 로 이어 받는다.
#
# 켜는 법
#   BUILD_GATE=1 일 때만 돈다 (scripts/build.sh 가 마지막 build.py 호출에 준다).
#   1차 build.py(데이터가 아직 없다)와 테스트의 단독 실행에서는 돌지 않는다.
# ─────────────────────────────────────────────────────────────────────────────
import json
import os
import sys

LAST_GOOD_DIR = 'snapshot/tables'
MIN_RATIO = 0.7

# (이름, 필수 여부). 필수 표가 비면 그 화면만이 아니라 홈까지 무너진다.
# 보조 표(시트·보스·일정·기술 변경)는 원래부터 "없으면 그 화면을 비운다" 로 설계돼 있다 (fetch_data.sh 참고)
TABLES = [
    ('pvp', True), ('pve', True), ('pve_easy', False), ('dynamax', True), ('dynamax_tank', True),
    ('dynamax_tier', True), ('value', True), ('dex', True), ('max_pool', False), ('move_changes', False),
    ('roles', False), ('sheet', False), ('bosses', False), ('gameday', False),
]

def enabled():
    return os.environ.get('BUILD_GATE') == '1'

def leaves(obj):
    # 문자열·숫자·불리언 하나가 잎 하나. 컨테이너 자체는 세지 않는다
    if isinstance(obj, dict):
        return sum(leaves(v) for v in obj.values())
    if isinstance(obj, list):
        return sum(leaves(v) for v in obj)
    return 0 if obj is None else 1

def _last_good_path(name):
    return f'{LAST_GOOD_DIR}/{name}.json'

def load_last_good(name):
    try:
        return json.load(open(_last_good_path(name), encoding='utf-8'))
    except Exception:
        return None

def save_last_good(name, table):
    os.makedirs(LAST_GOOD_DIR, exist_ok=True)
    with open(_last_good_path(name), 'w', encoding='utf-8') as f:
        json.dump(table, f, ensure_ascii=False, separators=(',', ':'))

def judge(name, table, last_good):
    # 표 하나의 판정 — (실을 표, 상태). 상태는 ok · fallback · empty
    now, before = leaves(table), leaves(last_good)
    if now > 0 and (before == 0 or now >= before * MIN_RATIO):
        return table, 'ok'
    if before > 0:
        return last_good, 'fallback'
    return table, 'empty'

def warn(text):
    # GitHub Actions 요약에 노란 줄로 뜬다. 로컬에서는 그냥 한 줄
    print(f'::warning::{text}' if os.environ.get('GITHUB_ACTIONS') else f'경고: {text}')

def apply(tables):
    # tables: {이름: 표 또는 None}. 판정에 따라 바꿔 넣고, 대체된 이름 목록을 돌려준다.
    # 필수 표가 비었는데 폴백도 없으면 여기서 멈춘다 — 빈 화면을 배포하느니 직전 배포를 그대로 두는 편이 낫다
    stale, fatal = [], []
    for name, required in TABLES:
        table, status = judge(name, tables.get(name), load_last_good(name))
        now, before = leaves(tables.get(name)), leaves(load_last_good(name))
        if status == 'ok':
            tables[name] = table
            save_last_good(name, table)
        elif status == 'fallback':
            tables[name] = table
            stale.append(name)
            warn(f'{name}: 내용이 {now:,} 잎으로 직전 {before:,} 의 {now / before:.0%} — 직전 정상본으로 대체')
        elif required:
            fatal.append(name)
        else:
            warn(f'{name}: 비어 있고 직전 정상본도 없다 — 그 화면은 비워서 나간다')
    if fatal:
        sys.exit(f'필수 표가 비어 있고 폴백도 없다: {", ".join(fatal)} — 배포를 멈춘다 (직전 배포가 그대로 남는다)')
    return stale

def selftest():
    # python3 backend/guard.py --selftest — 판정 규칙만 확인한다 (파일을 건드리지 않는다)
    big = {'a': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
    assert leaves(big) == 10 and leaves(None) == 0 and leaves({}) == 0 and leaves([[], {}]) == 0
    assert judge('x', big, None)[1] == 'ok'                       # 첫 빌드: 견줄 것이 없으면 통과
    assert judge('x', {'a': [1, 2, 3, 4, 5, 6, 7]}, big)[1] == 'ok'   # 70% 는 통과
    assert judge('x', {'a': [1, 2, 3, 4, 5, 6]}, big) == (big, 'fallback')   # 60% 는 대체
    assert judge('x', {}, big) == (big, 'fallback')
    assert judge('x', None, big) == (big, 'fallback')
    assert judge('x', {'a': list(range(30))}, big)[1] == 'ok'       # 늘어난 것은 정상
    assert judge('x', {}, None) == ({}, 'empty')
    print('guard selftest ok')

if __name__ == '__main__':
    if '--selftest' in sys.argv:
        selftest()
