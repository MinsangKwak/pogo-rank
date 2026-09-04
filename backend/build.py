# ─────────────────────────────────────────────────────────────────────────────
# build.py — PvP 랭킹 가공 + 프론트엔드 번들 조립
#
# 역할
#   (1) PvPoke 리그별 랭킹을 한글 이름·한글 기술명·스프라이트 id가 붙은 표로 가공한다.
#   (2) frontend/ 의 CSS·JS 조각을 정해진 순서로 이어붙여 단일 dist/index.html을 만들고,
#       빌드가 만들어낸 데이터는 dist/data.js로 따로 뽑는다.
#
# 입력
#   data/gm.json          PvPoke 게임마스터 (pokemon · moves · timestamp)
#   data/move_names.csv   PokeAPI 기술 이름 (영문 → 기술 id, 기술 id → 한글)
#   data/r{cp}.json       리그별 PvPoke 랭킹 (500 / 1500 / 2500 / 10000)
#   data/pve.json 등      다른 빌드 스크립트가 만든 데이터 (dist/data.js에 그대로 실어 보낸다)
#   data/sprites/*.png    개별 스프라이트 이미지
#   frontend/**           index.html 템플릿 · styles/*.css · scripts/*.js · static/*
#
# 출력
#   data/pvp.json         리그별 상위 TOP위 상세 표 (기술·점수 포함)
#   data/pvp_all.json     리그별 전체 순위 (검색·필터용 최소 정보)
#   dist/index.html       CSS·JS가 모두 인라인된 단일 페이지
#   dist/data.js          프론트가 읽는 전역 데이터 (미리보기 모드에서는 HTML에 인라인)
#   dist/sprites/*.png    스프라이트 복사본
#   dist/*                PWA 정적 파일 (manifest · 아이콘 · 서비스워커)
#
# 파이프라인에서의 위치 (scripts/build.sh) — 이 스크립트는 **두 번 실행된다**
#   1차: pve_build.py 직후. 이때 data/pvp.json이 만들어져야 뒤따르는
#        value_build.py · sheet_build.py · dex_build.py가 그것을 읽을 수 있다.
#        아직 존재하지 않는 데이터(value / sheet / dex / sprites)는 빈 값으로 들어간다.
#   2차: 모든 빌드가 끝난 뒤. 이번에는 완성된 데이터가 전부 실려
#        최종 dist/index.html · dist/data.js가 만들어진다.
# ─────────────────────────────────────────────────────────────────────────────
import json, csv, re, os
from sprite import sprite_id
from names import name_ko, species, ko_species

# PvPoke 게임마스터: 종 목록(pokemon) · 기술 목록(moves) · 데이터 기준일(timestamp)
game_master = json.load(open('data/gm.json'))
# 기술 id → 기술 정보. name 필드에는 영문 표기가 들어 있고,
# 웨더볼·히든파워처럼 타입이 갈리는 기술은 "Hidden Power (Fire)" 식으로 괄호가 붙는다
moves = {move['moveId']: move for move in game_master['moves']}


# 한국어 기술 이름: 영문명(소문자) → 한글
# move_names.csv는 (기술 id, 언어 id, 이름) 형태라 방향이 다른 두 개의 표를 만든다.
#   local_language_id == '9' (영어)  : 영문 이름 → 기술 id
#   local_language_id == '3' (한국어): 기술 id → 한글 이름
en_move, ko_move = {}, {}
for row in csv.DictReader(open('data/move_names.csv', encoding='utf-8')):
    if row['local_language_id'] == '9':
        en_move[row['name'].lower()] = row['move_id']
    if row['local_language_id'] == '3':
        ko_move[row['move_id']] = row['name']

# PvPoke와 PokeAPI의 표기 차이(공백·하이픈·아포스트로피 등)를 무시하고 맞추기 위한 정규화.
# 영소문자와 숫자만 남긴다
def normalize_name(name):
    return re.sub(r'[^a-z0-9]', '', name.lower())

# 정규화한 영문 기술명 → 기술 id
en_move_norm = {normalize_name(english_name): move_id for english_name, move_id in en_move.items()}

def move_ko(move_id):
    # PvPoke 기술 id → 한글 기술명. 게임마스터에 없는 id는 그대로 돌려준다
    move = moves.get(move_id)
    if not move:
        return move_id
    name = move['name']
    # 괄호 안의 타입(예: "Hidden Power (Fire)")은 이름 본체와 분리해 따로 한글화한다
    paren = re.search(r'\((\w+)\)', name)
    base = re.sub(r'\s*\(.*\)', '', name)
    # 한글 이름을 못 찾으면 영문 본체(base)를 그대로 노출한다
    korean_move_name = ko_move.get(en_move_norm.get(normalize_name(base)), base)
    return f"{korean_move_name}({TYPE_KO.get(paren.group(1).lower(), paren.group(1))})" if paren else korean_move_name

TYPE_KO = {'normal':'노말','fire':'불꽃','water':'물','grass':'풀','electric':'전기','ice':'얼음','fighting':'격투','poison':'독','ground':'땅','flying':'비행','psychic':'에스퍼','bug':'벌레','rock':'바위','ghost':'고스트','dragon':'드래곤','dark':'악','steel':'강철','fairy':'페어리'}

TOP = 40
pvp, pvp_all = {}, {}
# (CP 상한, 리그 키). 리그 키는 프론트의 리그 탭 식별자로 그대로 쓰인다
for cp_cap, league_id in [(500,'little'),(1500,'great'),(2500,'ultra'),(10000,'master')]:
    rankings = json.load(open(f'data/r{cp_cap}.json'))
    rows = []
    # 전체 순위: 이름·스프라이트·타입만 담는다 (기술까지 실으면 data.js가 너무 커진다)
    all_rows = []
    for index, entry in enumerate(rankings):
        pokemon = species[entry['speciesId']]
        korean_name, form_label = name_ko(entry['speciesId'])
        all_rows.append({'rank': index+1, 'name': korean_name, 'sprite': sprite_id(pokemon['dex'], form_label),
                         'types': [type_name for type_name in pokemon['types'] if type_name != 'none'], 'en': pokemon['speciesName']})
    pvp_all[league_id] = all_rows
    # 상위 TOP위: 추천 기술 구성과 점수까지 붙인 상세 표
    for index, entry in enumerate(rankings[:TOP]):
        pokemon = species[entry['speciesId']]
        # moveset은 [빠른 기술, 차징 기술...] 순서
        fast_move = entry['moveset'][0]
        charged_moves = entry['moveset'][1:]
        korean_name, form_label = name_ko(entry['speciesId'])
        rows.append({'rank': index+1, 'name': korean_name, 'en': pokemon['speciesName'], 'sprite': sprite_id(pokemon['dex'], form_label),
                     'types': [type_name for type_name in pokemon['types'] if type_name != 'none'],
                     'fast': move_ko(fast_move), 'charged': ' / '.join(move_ko(charged_move) for charged_move in charged_moves), 'score': entry['score']})
    pvp[league_id] = rows

os.makedirs('dist', exist_ok=True)
json.dump(pvp, open('data/pvp.json', 'w', encoding='utf-8'), ensure_ascii=False)
json.dump(pvp_all, open('data/pvp_all.json', 'w', encoding='utf-8'), ensure_ascii=False)

# ── frontend/ 의 CSS·JS를 순서대로 인라인해 단일 dist/index.html 조립 ──
# 순서가 곧 캐스케이드(CSS)·실행 순서(JS)이므로 새 파일은 여기 목록에 추가
APP_VERSION = 'v2.5.0'  # 2026-09-03 화면 표시용 버전 — 릴리스 때 여기만 올리면 됨
# 2026-09-03 GA4 측정 ID (G-XXXXXXXXXX) — 채우면 배포 빌드에 gtag가 삽입되고, 비우면 추적 코드 자체가 안 들어감
GA_ID = 'G-XXXXXXXXXX'
# 2026-09-03 v2.2.0 Firebase (Google 로그인 + 즐겨찾기 동기화)
# Firebase 콘솔 > 프로젝트 설정 > 내 앱 > firebaseConfig 값을 그대로 옮겨 적는다. 비우면 로그인 UI가 안 뜬다
# apiKey는 공개돼도 되는 식별자 — 접근 제어는 firestore.rules가 담당
FIREBASE_CONFIG = {
    'apiKey': 'FIREBASE_API_KEY_REDACTED',
    'authDomain': 'pogo-note.firebaseapp.com',
    'projectId': 'pogo-note',
    'storageBucket': 'pogo-note.firebasestorage.app',
    'messagingSenderId': '000000000000',
    'appId': 'FIREBASE_APP_ID_REDACTED',
}
ADMIN_EMAIL = ''  # ADMIN_UID를 쓰므로 비움 (예전 폴백 자리)
# 2026-09-03 관리자 식별을 uid로 — 배포 후 ☰ → 🔑 가입 승인에서 "내 uid 복사"로 받아 여기에 넣으면
# 공개 저장소에서 이메일이 사라진다. firestore.rules의 isAdmin()도 같은 값으로 바꿀 것
ADMIN_UID = 'ADMIN_UID_REDACTED'
GA_SNIPPET = '''<script>
// GA4: 배포 도메인(github.io)에서만 로드 — 로컬 미리보기·개발 중엔 집계 안 됨
if (location.hostname.endsWith('github.io')) {
  var gs = document.createElement('script');
  gs.async = true;
  gs.src = 'https://www.googletagmanager.com/gtag/js?id=__GA_ID__';
  document.head.appendChild(gs);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', '__GA_ID__');
}
</script>'''

STYLES = [
    'tokens.css', 'base.css', 'layout.css',
    'components/tabs.css', 'components/seg.css', 'components/chips.css',
    'components/list.css', 'components/tag.css', 'components/modal.css', 'components/search.css', 'components/drawer.css', 'components/pages.css',
]
SCRIPTS = [
    'data.js', 'dom.js', 'track.js',  # 2026-09-03 track: GA4 이벤트 헬퍼 (가장 먼저 정의)
    'components/type-dots.js', 'components/sprite.js', 'components/changes.js', 'components/row.js',  # 2026-09-04 changes: 기술 변경·순위 변동 뱃지 (row가 사용)
    'components/list.js', 'components/chips.js', 'components/seg.js',
    'components/modal.js', 'components/auth.js', 'components/detail.js',  # 2026-09-03 v2.2.0 auth: 로그인·즐겨찾기 (detail보다 먼저)
    'components/schedule.js', 'components/release.js', 'components/search.js', 'components/drawer.js', 'components/pages.js', 'components/trainers.js', 'components/totop.js',  # 2026-09-02 9월 일정표 달력 · 업데이트 팝업
    'views/pvp.js', 'views/pve.js', 'views/max.js', 'views/tier.js', 'views/usage.js', 'views/ifsolo.js',  # 2026-09-02 if 탭
    'app.js',
]
def bundle(folder, files, mark):
    # frontend/<folder>/ 의 파일들을 목록 순서 그대로 이어붙인다.
    # 조각마다 `── 파일명 ──` 머리말을 달아 합쳐진 뒤에도 어느 파일에서 온 코드인지 알 수 있게 한다.
    # mark는 그 머리말에 쓸 주석 기호 — CSS는 '/*'(닫는 '*/'까지 붙임), JS는 '//'.
    parts = []
    for filename in files:
        heading = f'{mark} ── {filename} ──{" */" if mark == "/*" else ""}\n'
        parts.append(heading + open(f'frontend/{folder}/{filename}', encoding='utf-8').read().strip())
    return '\n\n'.join(parts)

# 아직 만들어지지 않은 데이터 파일(build.py 1차 실행 시점)은 빈 객체로 대체한다
def optional_json(path):
    return open(path, encoding='utf-8').read() if os.path.exists(path) else '{}'

# 2026-09-03 v2.0.0: 데이터는 dist/data.js 별도 파일, 스프라이트는 개별 png + lazy 로딩
# SPRITE_INLINE=1 환경변수면 옛 방식(단일 HTML, base64 인라인) — 채팅 미리보기용
INLINE = os.environ.get('SPRITE_INLINE') == '1'
sprite_ids = []
if os.path.exists('data/sprites'):
    os.makedirs('dist/sprites', exist_ok=True)
    for filename in os.listdir('data/sprites'):
        source_path = f'data/sprites/{filename}'
        # 파일명은 "<스프라이트 id>.png". 앞 4바이트 PNG 시그니처를 확인해
        # 다운로드가 실패한 빈 파일·오류 응답이 섞여 들어가는 것을 막는다
        if filename.endswith('.png') and open(source_path, 'rb').read(4) == b'\x89PNG'[:4]:
            sprite_ids.append(int(filename[:-4]))
            # 미리보기 모드가 아니면 dist/sprites/로 복사한다
            # (shutil은 파일 아래쪽에서 import하므로 여기서는 지연 import)
            if not INLINE:
                shutil_copy = __import__('shutil').copy(source_path, f'dist/sprites/{filename}')

# ── 순위 변동(▲▼) 계산 ────────────────────────────────────────────────────
# 직전 빌드의 순위와 비교해 각 행에 'd'(변동 폭)를 심는다. 자세한 규칙은 backend/rank_diff.py 참고.
# PvE·D-MAX 표가 아직 없는 1차 실행에서는 건너뛴다 (그때 비교하면 잘못된 기준이 남는다).
rank_delta_date, changed_table_count, rank_fresh_days = '', 0, 14

def load_table_file(path):
    return json.load(open(path, encoding='utf-8')) if os.path.exists(path) else None

# 화면에 실제로 순위가 보이는 표를 전부 넣는다.
# 같은 PvE 탭이라도 시트 데이터가 있으면 시트를, 없으면 자체 계산을 그리므로 둘 다 대상이다.
pve_tables = load_table_file('data/pve.json')
pve_easy_tables = load_table_file('data/pve_easy.json')
dmax_tables = load_table_file('data/dynamax_tier.json')
sheet_tables = load_table_file('data/sheet.json')
value_tables = load_table_file('data/value.json')
if pve_tables and dmax_tables:
    import rank_diff
    all_tables = {}
    for league_id, rows in pvp.items():
        all_tables[f'pvp:{league_id}'] = rows
    for type_key, rows in pve_tables.items():
        all_tables[f'pve:{type_key}'] = rows
    for type_key, rows in (pve_easy_tables or {}).items():
        all_tables[f'pveEasy:{type_key}'] = rows
    for type_key, rows in dmax_tables.items():
        all_tables[f'dmax:{type_key}'] = rows
    for type_key, rows in ((sheet_tables or {}).get('pve') or {}).items():
        all_tables[f'sheet:{type_key}'] = rows
    if value_tables and value_tables.get('usage'):
        all_tables['usage'] = value_tables['usage']
    rank_delta_date, changed_table_count = rank_diff.apply(all_tables)
    rank_fresh_days = rank_diff.FRESH_DAYS
    print(f'순위 변동: 기준일 {rank_delta_date or "없음"} · 움직인 표 {changed_table_count}개')

# 프론트가 읽는 전역 데이터. 각 상수는 대응하는 뷰가 그대로 참조한다
# (없는 파일은 optional_json이 '{}'로 채우므로 1차 실행에서도 문법 오류가 나지 않는다)
data_js = f'''// 빌드 생성 데이터 (backend/build.py) — 기준일 {game_master['timestamp']}
const TYPE_KO = {json.dumps(TYPE_KO, ensure_ascii=False)};
const PVP_DATA = {json.dumps(pvp, ensure_ascii=False)};
const PVE_DATA = {json.dumps(pve_tables, ensure_ascii=False) if pve_tables else optional_json('data/pve.json')};
const PVE_EASY = {json.dumps(pve_easy_tables, ensure_ascii=False) if pve_easy_tables else optional_json('data/pve_easy.json')};
const DMAX_DATA = {optional_json('data/dynamax.json')};
const MAX_POOL = {optional_json('data/max_pool.json')};   // 2026-09-04 맥스 배틀 포획 가능 종 (스프라이트 id → 'G'|'D')
const MOVE_CHANGES = {optional_json('data/move_changes.json')};   // 2026-09-04 시즌 기술 변경 안내 (backend/change_build.py)
const RANK_DELTA_DATE = {json.dumps(rank_delta_date)};            // 2026-09-04 순위 변동을 기록한 날 (뱃지 유효기간 계산용)
const RANK_FRESH_DAYS = {rank_fresh_days};                        // 이 일수가 지나면 변동 뱃지를 감춘다
const DMAX_TIER = {json.dumps(dmax_tables, ensure_ascii=False) if dmax_tables else optional_json('data/dynamax_tier.json')};
const VALUE_DATA = {json.dumps(value_tables, ensure_ascii=False) if value_tables else optional_json('data/value.json')};
const SHEET_DATA = {json.dumps(sheet_tables, ensure_ascii=False) if sheet_tables else optional_json('data/sheet.json')};
const DEX_DATA = {optional_json('data/dex.json')};
const BOSS_LIST = {optional_json('data/bosses.json') or '[]'};
const SPRITE_IDS = {json.dumps(sorted(sprite_ids))};
const SPRITES = {(open('data/sprites.json').read() if INLINE and os.path.exists('data/sprites.json') else 'null')};
'''
# index.html 템플릿의 자리표시자를 차례로 실제 내용으로 치환한다
html = open('frontend/index.html', encoding='utf-8').read()
# CSS·JS 번들 삽입
html = html.replace('__STYLES__', bundle('styles', STYLES, '/*')).replace('__SCRIPTS__', bundle('scripts', SCRIPTS, '//'))
# 데이터 기준일과 앱 버전 표시
html = html.replace('__TIMESTAMP__', game_master['timestamp']).replace('__VERSION__', APP_VERSION)
# 2026-09-03 GA4: 측정 ID가 있으면 스니펫 삽입, 없으면 자리표시자 제거
html = html.replace('__GA_SNIPPET__', GA_SNIPPET.replace('__GA_ID__', GA_ID) if GA_ID else '')
# 2026-09-03 v2.2.0 앱 설정 주입
html = html.replace('__APP_CONFIG__', f"const FIREBASE_CONFIG = {json.dumps(FIREBASE_CONFIG)};\nconst ADMIN_EMAIL = {json.dumps(ADMIN_EMAIL)};\nconst ADMIN_UID = {json.dumps(ADMIN_UID)};")
if INLINE:
    # 미리보기: data.js 내용을 그대로 인라인해 단일 파일 유지
    html = html.replace('<script src="data.js"></script>', '<script>\n' + data_js + '\n</script>')
else:
    open('dist/data.js', 'w', encoding='utf-8').write(data_js)
open('dist/index.html', 'w', encoding='utf-8').write(html)
# 2026-09-03 PWA 정적 파일(manifest·아이콘·서비스워커) 복사
import shutil
if os.path.isdir('frontend/static'):
    for filename in os.listdir('frontend/static'):
        shutil.copy(f'frontend/static/{filename}', 'dist/')
# 리그별로 몇 줄이 실렸는지 요약 출력 (빌드 로그 확인용)
print('ok', {league_id: len(league_rows) for league_id, league_rows in pvp.items()})
