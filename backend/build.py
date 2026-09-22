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
#
# 읽는 순서 (2026-09-12 v3.14.0 단계별 함수로 나눴다 — 한 덩어리 502줄이었다)
#   설정 → PvP 표 가공 → 주석 걷어내기·번들 → 스프라이트 복사 → 순위 변동 → data.js → index.html → 부속 파일
#   main() 이 그 순서대로 부른다. 어느 단계가 무엇을 받아 무엇을 내는지는 함수 서명이 말한다.
# ─────────────────────────────────────────────────────────────────────────────
import json, csv, re, os, shutil, hashlib
from datetime import date
from sprite import sprite_id
from names import name_ko, species, FORM_KO
import guard

# ── 설정 ─────────────────────────────────────────────────────────────────────
# 2026-09-22 v5 Phase 1 — 판 번호의 원본은 release/version.json 하나다.
# 전에는 이 상수와 components/release.js 와 패치노트 본문 셋이 각자 적고 있어, 하나만 빠져도
# 화면과 문서가 어긋났다 (CLAUDE.md §5 의 '여섯 곳').
APP_VERSION = json.loads(open('release/version.json', encoding='utf-8').read())['app']
# 2026-09-14 v3.28.0 index.html 의 색인 허용 줄 — dev 빌드가 이 줄을 noindex 로 바꿔 끼운다
ROBOTS_INDEX_META = '<meta name="robots" content="index, follow, max-image-preview:large">'
# 2026-09-05 v2.7.3 빌드 채널 — 'prod'(기본) / 'dev'. dev 브랜치 워크플로(.github/workflows/deploy-dev.yml)가 BUILD_CHANNEL=dev 로 부른다.
# dev 빌드는 (1) 버전 배지에 -dev 를 붙여 화면에서 구분되고 (2) GA 스니펫을 넣지 않아 통계가 섞이지 않고
# (3) robots.txt 를 전부 차단 + <meta name="robots" content="noindex"> 로 검색 색인을 막는다. 나머지는 prod 와 동일
BUILD_CHANNEL = os.environ.get('BUILD_CHANNEL', 'prod')
if BUILD_CHANNEL == 'dev':
    APP_VERSION += '-dev'
# 2026-09-08 v2.27.0 정식 주소 — canonical · og:url · og:image · sitemap 이 모두 여기서 나온다.
# 커스텀 도메인을 붙이면 이 두 줄만 고치면 된다 (index.html 에 흩어 두지 않은 이유)
SITE_URL = 'https://moncamp.kr/'            # 2026-09-14 v3.27.0 커스텀 도메인 (전: minsangkwak.github.io/pogo-rank/)
DEV_SITE_URL = 'https://dev.moncamp.kr/'    # 미리보기 (전: minsangkwak.github.io/pogo-rank-dev/)
# 2026-09-03 v2.0.0: 데이터는 dist/data.js 별도 파일, 스프라이트는 개별 png + lazy 로딩
# SPRITE_INLINE=1 환경변수면 옛 방식(단일 HTML, base64 인라인) — 채팅 미리보기용
INLINE = os.environ.get('SPRITE_INLINE') == '1'
TOP = 40  # 리그별 상세 표(기술·점수)에 싣는 순위 수
# (CP 상한, 리그 키). 리그 키는 프론트의 리그 탭 식별자로 그대로 쓰인다
LEAGUES = [(500, 'little'), (1500, 'great'), (2500, 'ultra'), (10000, 'master')]

TYPE_KO = {'normal':'노말','fire':'불꽃','water':'물','grass':'풀','electric':'전기','ice':'얼음','fighting':'격투','poison':'독','ground':'땅','flying':'비행','psychic':'에스퍼','bug':'벌레','rock':'바위','ghost':'고스트','dragon':'드래곤','dark':'악','steel':'강철','fairy':'페어리'}
TYPE_EN = {english_type: english_type.capitalize() for english_type in TYPE_KO}  # 2026-09-08 v2.29.0 다국어 — 게임 표기가 곧 대문자 한 글자 차이라 표를 따로 적지 않는다

# 2026-09-11 v2.57.0 data.js 의 공백을 줄인다. json.dumps 는 기본이 `", "` · `": "` 라
# 항목마다 공백 두 개가 붙는데, 1,172종 × 필드 수만큼 쌓이면 실측 194KB 다.
# 값은 한 글자도 바뀌지 않는다 — 사이의 공백만 없앤다.
JSON_TIGHT = (',', ':')

def tight(obj):
    # 공백 없는 JSON 문자열 (data.js 에 싣는 모든 표가 이 모양이다)
    return json.dumps(obj, ensure_ascii=False, separators=JSON_TIGHT)


# 2026-09-15 v3.44.0 큰 표는 **JSON.parse 로 싣는다.**
#   data.js 는 1.4MB 가 전부 객체 리터럴이라, 브라우저가 이걸 **자바스크립트 문법**으로 읽는다.
#   자바스크립트 파서는 한 글자마다 "이게 함수일까 연산자일까" 를 따져야 해서 느리다.
#   같은 바이트를 JSON.parse 로 주면 파서가 "이건 데이터다" 만 알고 읽어 훨씬 빠르다
#   (실측: data.js 파싱 347ms → 아래 CHANGELOG 참고).
#   바이트 수는 거의 그대로다 — 따옴표와 이스케이프 몇 글자만 는다.
JSON_PARSE_MIN = 20000   # 이보다 작은 표는 그대로 둔다 — JSON.parse 호출 자체의 비용이 더 크다

def js_data(json_text):
    if len(json_text) < JSON_PARSE_MIN:
        return json_text
    # JS 작은따옴표 문자열 안에 JSON 원문을 넣는다. 역슬래시·작은따옴표만 막으면 된다
    # (tight() 는 줄바꿈을 만들지 않는다). '</' 는 미리보기 빌드가 이 파일을 <script> 안에
    # 인라인할 때를 대비해 끊어 둔다 — JS 에서 \/ 는 그냥 / 라 값은 바뀌지 않는다
    body = json_text.replace('\\', '\\\\').replace("'", "\\'").replace('</', '<\\/')
    return "JSON.parse('" + body + "')"

# ── 운영 설정값은 코드에 두지 않는다 (2026-09-05 v2.8.0) ──
# 로컬은 저장소 루트의 .env, GitHub Actions 는 Repository variables 에서 같은 이름으로 읽는다. 키 설명은 .env.example.
# 이 값들은 전부 dist/index.html 에 그대로 들어가 방문자에게 보이는 공개 식별자다 — 비밀이라서가 아니라
# 공개 저장소 코드에 운영 식별자를 남기지 않기 위해 분리했다. 접근 제어는 firestore.rules 가 담당한다.
def load_dotenv(path='.env'):
    # 표준 라이브러리만 쓰는 원칙에 맞춘 최소 파서: KEY=VALUE 한 줄씩, # 주석·빈 줄 무시, 따옴표 벗김.
    # 이미 있는 환경변수(CI 가 넣어 준 값)는 덮어쓰지 않는다
    if not os.path.exists(path):
        return
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

def read_config():
    load_dotenv()
    config = {
        'GA_ID': os.environ.get('GA_ID', ''),                    # GA4 측정 ID. 비우면 추적 코드가 안 들어감
        'FIREBASE_CONFIG': json.loads(os.environ.get('FIREBASE_CONFIG_JSON') or '{}'),   # 비우면 로그인 UI 가 안 뜬다
        'ADMIN_EMAIL': os.environ.get('ADMIN_EMAIL', ''),        # ADMIN_UID 가 없을 때의 폴백 (보통 비움)
        'ADMIN_UID': os.environ.get('ADMIN_UID', ''),            # firestore.rules 의 __ADMIN_UID__ 와 같은 값 (scripts/render_rules.sh)
        'CONTACT_EMAIL': os.environ.get('CONTACT_EMAIL', ''),    # 푸터·개인정보처리방침 문의 이메일. 비우면 문구가 빠진다
        # 2026-09-21 v4.7.0 수집 서버 주소 (server/). 비우면 수집이 통째로 꺼진다 —
        # 서버가 없던 때와 똑같이 돈다. 공개 식별자라 배포 HTML 에 그대로 실린다
        'COLLECT_URL': os.environ.get('COLLECT_URL', '').rstrip('/'),
    }
    if not config['FIREBASE_CONFIG']:
        print('경고: FIREBASE_CONFIG_JSON 이 비어 있어 로그인 UI 없이 빌드됩니다 (.env.example 참고)')
    return config

# 2026-09-07 v2.18.0 (공개 준비 3) GA 는 동의 뒤에만 붙는다 — 여기서는 측정 ID 만 남기고, 실제 gtag 삽입은
# v4 의 lib/consent.ts 가 localStorage pogo_consent 가 'granted' 일 때 한다.
# 배포 도메인에서만 ID 를 노출해 로컬 미리보기·개발 중엔 동의해도 집계되지 않는다
# 2026-09-15 v3.39.0 GA 를 **여기서 바로** 붙인다 (전에는 측정 ID 만 남기고 동의를 기다렸다).
#   왜 옮겼나 — 번들의 initConsent() 는 첫 렌더가 끝난 뒤에 돈다. 그 사이에 떠나는 방문(이탈)이
#   page_view 로 잡히지 않았다. head 에서 바로 붙이면 들어온 즉시 한 건이 찍힌다.
#   끄는 길은 그대로다 — localStorage 의 pogo_consent 가 'denied' 면 아무것도 안 붙는다(옵트아웃).
#   봇은 여기서도 거른다 (track.js IS_BOT_LIKE 와 같은 세 조건) — 번들보다 먼저 도므로 여기 한 벌이 더 있다.
# 2026-09-22 v5 Phase 1-C — v3 화면(HTML·CSS·JS 조립)을 걷어냈다.
# 운영은 v4.0.0 부터 React 판이고, 이 자리는 v4 빌드가 실패했을 때의 대비책으로만 남아 있었다.
# 이제 build.py 가 하는 일은 셋뿐이다 — 데이터(data.js) · 스프라이트 · 부속 파일(robots·sitemap·404·build.json).

# ── PvP 표 가공 ───────────────────────────────────────────────────────────────
def load_move_names():
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
    # 정규화한 영문 기술명 → 기술 id
    en_move_norm = {normalize_name(english_name): move_id for english_name, move_id in en_move.items()}
    return en_move_norm, ko_move

# PvPoke와 PokeAPI의 표기 차이(공백·하이픈·아포스트로피 등)를 무시하고 맞추기 위한 정규화.
# 영소문자와 숫자만 남긴다
def normalize_name(name):
    return re.sub(r'[^a-z0-9]', '', name.lower())

def move_translator(moves):
    # 기술 id → 기술 정보. name 필드에는 영문 표기가 들어 있고,
    # 웨더볼·히든파워처럼 타입이 갈리는 기술은 "Hidden Power (Fire)" 식으로 괄호가 붙는다
    en_move_norm, ko_move = load_move_names()

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
    return move_ko

def build_pvp_tables(game_master):
    # 리그별 PvPoke 랭킹 → (상위 TOP 상세 표, 전체 순위 최소 표). data/pvp.json · pvp_all.json 으로도 남긴다
    move_ko = move_translator({move['moveId']: move for move in game_master['moves']})
    pvp, pvp_all = {}, {}
    for cp_cap, league_id in LEAGUES:
        rankings = json.load(open(f'data/r{cp_cap}.json'))
        rows = []
        # 전체 순위: 이름·스프라이트·타입만 담는다 (기술까지 실으면 data.js가 너무 커진다)
        all_rows = []
        for index, entry in enumerate(rankings):
            pokemon = species[entry['speciesId']]
            korean_name, form_label = name_ko(entry['speciesId'])
            # 2026-09-05 form(폼 라벨)·dex 를 함께 남긴다 — roles_build.py 가 '도감번호|폼라벨' 키를 만들 때 쓴다
            # 2026-09-13 v3.24.0 score 도 남긴다 — value_build.py 가 전 종 PvP 점수표(meter)를 만드는 데 쓴다 (data.js 에는 안 실린다)
            all_rows.append({'rank': index+1, 'name': korean_name, 'sprite': sprite_id(pokemon['dex'], form_label),
                             'dex': pokemon['dex'], 'form': form_label, 'score': entry['score'],
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
    json.dump(pvp, open('data/pvp.json', 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(pvp_all, open('data/pvp_all.json', 'w', encoding='utf-8'), ensure_ascii=False)
    return pvp


def load_table_file(path):
    if not os.path.exists(path):
        return None
    try:
        return json.load(open(path, encoding='utf-8'))
    except Exception as e:
        print(f'경고: {path} 를 읽지 못했다 ({e}) — 없는 표로 다룬다')
        return None


# ── 스프라이트 복사 ───────────────────────────────────────────────────────────
# 2026-09-12 v3.14.0 이미 같은 파일이 있으면 건너뛴다 — 1,172장 × 2벌을 매 빌드마다 다시 썼다.
# 화면(frontend/)만 고친 빌드에서 그림은 한 장도 안 바뀌는데 빌드 0.5초 중 0.2초가 그 복사였다 (실측, 4코어).
# 크기와 수정 시각이 같으면 같은 파일로 본다 (shutil.copy 는 시각을 옮기지 않으므로 copy2 로 바꿨다).
def _copy_if_changed(source_path, target_path):
    try:
        src, dst = os.stat(source_path), os.stat(target_path)
        if src.st_size == dst.st_size and int(src.st_mtime) == int(dst.st_mtime):
            return
    except FileNotFoundError:
        pass
    shutil.copy2(source_path, target_path)

def copy_sprites():
    # 정지 png — 파일명은 "<스프라이트 id>.png". 앞 4바이트 PNG 시그니처를 확인해
    # 다운로드가 실패한 빈 파일·오류 응답이 섞여 들어가는 것을 막는다
    sprite_ids = []
    if os.path.exists('data/sprites'):
        os.makedirs('dist/sprites', exist_ok=True)
        for filename in os.listdir('data/sprites'):
            source_path = f'data/sprites/{filename}'
            if filename.endswith('.png') and open(source_path, 'rb').read(4) == b'\x89PNG'[:4]:
                sprite_ids.append(int(filename[:-4]))
                # 미리보기 모드(단일 HTML)가 아니면 dist/sprites/ 로 복사한다
                if not INLINE:
                    _copy_if_changed(source_path, f'dist/sprites/{filename}')
    # 2026-09-12 v2.67.0 움직이는 그림 — 상세 화면에서만 쓴다 (backend/sprites.py 참고).
    # 목록은 정지 png 그대로다: GIF 는 png 의 13배라 100장을 한 번에 그리는 도감이 감당하지 못한다.
    # 인라인 미리보기 빌드(SPRITE_INLINE)에는 넣지 않는다 — 단일 HTML 이 수십 MB 가 된다
    sprite_anim_ids = []
    if not INLINE and os.path.exists('data/sprites-anim'):
        os.makedirs('dist/sprites-anim', exist_ok=True)
        for filename in os.listdir('data/sprites-anim'):
            source_path = f'data/sprites-anim/{filename}'
            if filename.endswith('.gif') and open(source_path, 'rb').read(6) in (b'GIF87a', b'GIF89a'):
                sprite_anim_ids.append(int(filename[:-4]))
                _copy_if_changed(source_path, f'dist/sprites-anim/{filename}')
    return sprite_ids, sprite_anim_ids


# ── 순위 변동(▲▼) 계산 ────────────────────────────────────────────────────
# 직전 빌드의 순위와 비교해 각 행에 'd'(변동 폭)를 심는다. 자세한 규칙은 backend/rank_diff.py 참고.
# PvE·D-MAX 표가 아직 없는 1차 실행에서는 건너뛴다 (그때 비교하면 잘못된 기준이 남는다).
def apply_rank_delta(tables):
    # 화면에 실제로 순위가 보이는 표를 전부 넣는다.
    # 같은 PvE 탭이라도 시트 데이터가 있으면 시트를, 없으면 자체 계산을 그리므로 둘 다 대상이다.
    rank_delta_date, changed_table_count, rank_fresh_days = '', 0, 14
    if tables['pve'] and tables['dynamax_tier']:
        import rank_diff
        all_tables = {}
        for league_id, rows in tables['pvp'].items():
            all_tables[f'pvp:{league_id}'] = rows
        for type_key, rows in tables['pve'].items():
            all_tables[f'pve:{type_key}'] = rows
        for type_key, rows in (tables['pve_easy'] or {}).items():
            all_tables[f'pveEasy:{type_key}'] = rows
        for type_key, rows in (tables['pve_by_type'] or {}).items():
            all_tables[f'pveType:{type_key}'] = rows
        for type_key, rows in tables['dynamax_tier'].items():
            all_tables[f'dmax:{type_key}'] = rows
        for type_key, rows in ((tables['sheet'] or {}).get('pve') or {}).items():
            all_tables[f'sheet:{type_key}'] = rows
        if tables['value'] and tables['value'].get('usage'):
            all_tables['usage'] = tables['value']['usage']
        rank_delta_date, changed_table_count = rank_diff.apply(all_tables)
        rank_fresh_days = rank_diff.FRESH_DAYS
        print(f'순위 변동: 기준일 {rank_delta_date or "없음"} · 움직인 표 {changed_table_count}개')
    return rank_delta_date, rank_fresh_days


# ── 게임 업데이트 기사 (2026-09-16 v3.51.0) ──────────────────────────────────
#
# 편집 원본은 backend/config/game_updates.json 한 벌이고, 여기서 **검증한 뒤 published 만** 내보낸다.
# 수집·빌드가 성공했다고 게시 승인이 되는 것이 아니다 — 확인 대기 글(draft·review)은 공개 빌드에
# 들어가지 않아야 한다. 그래서 거르는 자리를 화면이 아니라 빌드에 둔다: 안 실린 글은 열 방법이 없다.
#
# 검사에서 하나라도 걸리면 빌드를 세운다(예외). 잘못된 기사가 조용히 나가는 것보다 낫다.
GAME_UPDATE_CATEGORIES = {'gym', 'raid', 'pvp', 'catch', 'reward', 'bugfix'}
GAME_UPDATE_EDITORIAL = {'draft', 'review', 'published', 'withdrawn'}
GAME_UPDATE_EVIDENCE = {'official', 'observed', 'pending'}
GAME_UPDATE_ROLLOUT = {'planned', 'rolling', 'live', 'withdrawn', 'unknown'}
# related 에 적을 수 있는 화면 — frontend-v4/src/routes.ts 의 ROUTES id 와 같아야 한다.
# 표를 두 번 적는 셈이지만, 빌드가 프론트 소스를 파싱하게 만드는 쪽이 더 부서지기 쉽다.
# 여기 없는 id 를 적으면 빌드가 선다 — 화면에서 죽은 링크가 되는 것보다 먼저 걸린다
GAME_UPDATE_ROUTES = {'dex', 'dmax', 'pve', 'pvp', 'schedule', 'raids', 'eggs', 'finder',
                      'planner', 'ivrank', 'pvp-deck', 'dmax-deck', 'pve-solo', 'changes'}
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def _source_ids(article):
    """기사가 쓰는 출처를 아카이브 id 와 같은 모양으로 — 뉴스는 주소 끝자리, 릴리스 노트는 helpshift-<번호>"""
    ids = set()
    for source in article.get('sources') or []:
        url = source.get('url', '').rstrip('/')
        faq = re.search(r'/faq/([0-9]+)-', url)
        ids.add(f'helpshift-{faq.group(1)}' if faq else url.split('/')[-1])
    return ids


def load_game_archive(published, path='backend/config/game_update_archive.json'):
    """아카이브 색인 — 공식 제목·날짜·원문 링크·인용만. 요약이 없으니 검증 없이 내보낼 수 있다.

    **기사가 된 원문은 뺀다.** 같은 소식이 기사 하나와 아카이브 하나로 두 번 서면 안 된다 —
    사람이 요약을 쓰는 순간 아카이브 쪽은 자리를 비켜야 한다(승격).
    """
    if not os.path.exists(path):
        return []
    entries = json.load(open(path, encoding='utf-8')).get('entries', [])
    taken = set()
    for article in published:
        taken |= _source_ids(article)
    out = []
    for index, entry in enumerate(entries):
        where = f"game_update_archive.json[{index}] id={entry.get('id', '?')}"
        assert entry.get('id'), f'{where}: id 가 없다'
        assert entry.get('title'), f'{where}: 제목이 없다'
        assert entry.get('sources'), f'{where}: 출처가 없다'
        for source in entry['sources']:
            assert source.get('url', '').startswith('https://'), f'{where}: 출처 URL 은 https'
        date_value = entry.get('date', '')
        assert date_value == '' or DATE_RE.fullmatch(date_value), f'{where}: date={date_value!r} 는 YYYY-MM-DD'
        if entry['id'] in taken:
            continue
        out.append({key: value for key, value in entry.items() if not key.startswith('_')})
    out.sort(key=lambda entry: (entry.get('date') or '', entry['id']), reverse=True)
    return out


def load_game_updates(path='backend/config/game_updates.json'):
    """편집 원본을 읽어 (공개할 기사 목록, 상태별 개수) 를 돌려준다. 파일이 없으면 빈 목록."""
    if not os.path.exists(path):
        return [], {}
    raw = json.load(open(path, encoding='utf-8'))
    articles = raw.get('articles', [])
    counts = {}
    seen_ids = set()
    published = []
    for index, article in enumerate(articles):
        where = f"game_updates.json[{index}] id={article.get('id', '?')}"
        article_id = article.get('id', '')
        assert re.fullmatch(r'[a-z0-9][a-z0-9-]*', article_id), f'{where}: id 는 소문자·숫자·- 만'
        assert article_id not in seen_ids, f'{where}: id 가 겹친다'
        seen_ids.add(article_id)
        status = article.get('editorialStatus', '')
        assert status in GAME_UPDATE_EDITORIAL, f'{where}: editorialStatus={status!r}'
        counts[status] = counts.get(status, 0) + 1
        assert article.get('evidenceStatus') in GAME_UPDATE_EVIDENCE, f'{where}: evidenceStatus'
        assert article.get('rolloutStatus') in GAME_UPDATE_ROLLOUT, f'{where}: rolloutStatus'
        categories = article.get('category') or []
        assert categories and set(categories) <= GAME_UPDATE_CATEGORIES, f'{where}: category={categories}'
        assert set(article.get('related') or []) <= GAME_UPDATE_ROUTES, f'{where}: related 에 모르는 화면'
        for key in ('announcedAt', 'effectiveAt', 'checkedAt'):
            value = article.get(key, '')
            assert value == '' or DATE_RE.fullmatch(value), f'{where}: {key}={value!r} 는 YYYY-MM-DD'
        for source in article.get('sources') or []:
            assert source.get('url', '').startswith('https://'), f'{where}: 출처 URL 은 https'
            # 미리보기 그림도 https — 원본을 그대로 가리킨다(우리 저장소로 복사하지 않는다)
            image = source.get('image', '')
            assert image == '' or image.startswith('https://'), f'{where}: 출처 그림은 https'
        if status != 'published':
            continue
        # 공개하는 글에만 거는 조건 — 초안은 비어 있어도 된다
        assert article.get('title') and article.get('summary'), f'{where}: 공개 글에는 제목·요약이 필요하다'
        assert article.get('key'), f'{where}: 공개 글에는 핵심 요약이 필요하다'
        assert article.get('evidenceStatus') == 'official', f'{where}: 1차 공개 피드는 공식 출처를 확인한 글만'
        assert article.get('sources'), f'{where}: 공개 글에는 출처가 필요하다'
        # 발표일이 없는 출처가 있다 — 공식 릴리스 노트·알려진 문제는 날짜를 적지 않는다.
        # 그 경우 **우리가 확인한 날**(checkedAt) 이라도 있어야 한다. 둘 다 없으면 언제 일인지 말할 수 없다
        assert article.get('announcedAt') or article.get('checkedAt'), f'{where}: 공개 글에는 발표일이나 확인일이 필요하다'
        published.append({key: value for key, value in article.items() if not key.startswith('_')})
    # 최신이 위로. 발표일이 없는 글(공식 릴리스 노트)은 우리가 확인한 날로 센다 — 화면의 차례와 같은 기준이다
    published.sort(key=lambda article: article.get('effectiveAt') or article.get('announcedAt') or article.get('checkedAt') or '',
                   reverse=True)
    return published, counts


# ── data.js ───────────────────────────────────────────────────────────────────
def render_data_js(game_master, tables, stale, rank_delta_date, rank_fresh_days, sprite_ids, sprite_anim_ids, game_updates, game_archive):
    # 프론트가 읽는 전역 데이터. 각 상수는 대응하는 뷰가 그대로 참조한다.
    # 2026-09-16 v3.47.0 전부 main() 이 읽어 둔 표(tables)에서 싣는다 — 검문(guard.py)이 바꿔 넣은 표가 그대로 나간다.
    # 없는 표는 빈 값이라 1차 실행에서도 문법 오류가 나지 않는다.
    #
    # 2026-09-16 v3.48.0 **두 파일로 가른다** — (data.js, data-lazy.js) 를 돌려준다.
    #   홈이 쓰는 표는 data.js 에, 홈이 한 글자도 안 쓰는 여섯 표(gzip 84KB)는 data-lazy.js 에.
    #   PVE_EASY 17 · SHEET_DATA 31 · BOSS_LIST 21 · GAMEDAY 4 · MOVE_CHANGES 5 · ROLES 6 —
    #   PvE 탭 · 레이드 보스 · 알 부화 · 기술 변경 · 솔플 계산기 · 검색이 쓰고, 첫 렌더 뒤 한가할 때 미리 받는다 (scripts/lazy.js).
    #   전역 이름은 그대로다 — 어느 파일에 실리든 읽는 쪽 코드는 한 글자도 안 바뀐다.
    #   DATA_FETCHED 는 GAMEDAY.fetched 의 복사본 — freshness.js 가 지연분 없이도 "이 빌드의 데이터 날짜" 를 알아야 한다
    def t(key, empty='{}'):
        return js_data(tight(tables[key])) if tables.get(key) is not None else empty
    gameday = tables.get('gameday')
    data_fetched = gameday.get('fetched', '') if isinstance(gameday, dict) else ''
    # v3.60.0 즐겨찾기 소식 — 포켓몬이 걸린 이벤트만 추려 core 로 보낸다 (위 FAV_EVENTS)
    fav_events = [{'id': e.get('id'), 'title': e.get('title'), 'type': e.get('type'),
                   'start': e.get('start'), 'end': e.get('end'), 'dex': e['dex']}
                  for e in ((gameday or {}).get('events') or []) if e.get('dex')]
    # 긴 라벨부터 — name.js 가 앞에서부터 맞춰 보므로 '가라르 달마모드' 가 '가라르' 보다 먼저 와야 한다.
    # 2026-09-12 v3.14.0 같은 길이 안은 가나다순 — 집합 순서를 그대로 쓰면 빌드마다 data.js 가 달라졌다(해시 무작위화)
    form_labels = sorted({label for label in FORM_KO.values() if label} | {'섀도우', '다이맥스', '거다이맥스'}, key=lambda label: (-len(label), label))
    core = f'''// 빌드 생성 데이터 (backend/build.py) — 기준일 {game_master['timestamp']}
const TYPE_KO = {tight(TYPE_KO)};
// 2026-09-08 v2.29.0 다국어 — 타입 이름 영문. TYPE_KO 와 키가 같아야 typeName(t) 이 한 줄로 갈린다
const TYPE_EN = {tight(TYPE_EN)};
// 2026-09-06 v2.10.0 이름 앞에 붙는 폼 라벨 목록 (backend/names.py FORM_KO 값 + 섀도우·다이맥스·거다이맥스) — components/name.js 가 이름을 [라벨 뱃지 + 종 이름]으로 가른다
const FORM_LABELS = {tight(form_labels)};
const PVP_DATA = {t('pvp')};
const PVE_DATA = {t('pve')};
const DMAX_DATA = {t('dynamax')};
const DMAX_TANK = {t('dynamax_tank')};   // 2026-09-07 v2.13.0 (QA-43) 보스 속성별 다이맥스 탱커(EHP) 순위
const MAX_POOL = {t('max_pool')};   // 2026-09-04 맥스 배틀 포획 가능 종 (스프라이트 id → 'G'|'D')
const RANK_DELTA_DATE = {json.dumps(rank_delta_date)};            // 2026-09-04 순위 변동을 기록한 날 (뱃지 유효기간 계산용)
const RANK_FRESH_DAYS = {rank_fresh_days};                        // 이 일수가 지나면 변동 뱃지를 감춘다
const DMAX_TIER = {t('dynamax_tier')};
const VALUE_DATA = {t('value')};
const DEX_DATA = {t('dex')};
const DATA_FETCHED = {json.dumps(data_fetched)};   // 2026-09-16 v3.48.0 데이터 수집일 (GAMEDAY.fetched 와 같다 — GAMEDAY 는 data-lazy.js 에 있다)
const DATA_STALE = {json.dumps(stale)};   // 2026-09-16 v3.47.0 검문에서 직전 정상본으로 대체된 표 이름 (backend/guard.py). 비어 있으면 전부 오늘 것
// 2026-09-16 v3.51.0 게임 업데이트 기사 (backend/config/game_updates.json 에서 published 만).
// 홈의 주요 소식이 첫 화면에서 바로 필요해 core 에 둔다 — 지금 2건 ≈ 3KB.
// 글이 20건을 넘으면 목록용 요약과 본문을 갈라 본문만 data-lazy.js 로 옮긴다
const GAME_UPDATES = {js_data(tight(game_updates))};
// 2026-09-17 v3.60.0 즐겨찾기 소식용 **최소분** — 포켓몬이 걸린 이벤트만, 배지를 세는 데 필요한 것만.
//   왜 여기(core)에 두나 — 전체 일정(GAMEDAY)은 data-lazy.js 에 있어 일정 화면에 들어가야 읽힌다.
//   배지는 홈·메뉴에서 바로 보여야 하므로 그 표를 기다릴 수 없다. 지금 13건 ≈ 1KB 다.
//   맞추는 단위는 종(도감번호)이라 폼은 싣지 않는다 (components/favnews.js)
const FAV_EVENTS = {js_data(tight(fav_events))};
const SPRITE_IDS = {json.dumps(sorted(sprite_ids))};
const SPRITE_ANIM_IDS = {json.dumps(sorted(sprite_anim_ids))};
const SPRITES = {(open('data/sprites.json').read() if INLINE and os.path.exists('data/sprites.json') else 'null')};
'''
    lazy = f'''// 빌드 생성 데이터 — 첫 화면이 안 쓰는 표 (backend/build.py v3.48.0, scripts/lazy.js 가 첫 렌더 뒤에 받는다) — 기준일 {game_master['timestamp']}
const PVE_EASY = {t('pve_easy')};
const PVE_BY_TYPE = {t('pve_by_type')};
const SHEET_DATA = {t('sheet')};
const BOSS_LIST = {t('bosses', '[]')};
const GAMEDAY = {t('gameday')};              // 2026-09-08 v2.25.0 레이드 보스·알 부화 풀·이벤트 원본 (backend/gameday_build.py)
const MOVE_CHANGES = {t('move_changes')};   // 2026-09-04 시즌 기술 변경 안내 (backend/change_build.py)
const ROLES = {t('roles')};                 // 2026-09-05 PvE/PvP 역할 자동 분류 근거 (backend/roles_build.py)
// 2026-09-16 v3.54.0 게임 업데이트 **아카이브 색인** — 공식 제목·날짜·원문 링크·인용만 (요약 없음).
// 목록 화면(#/game-updates)에서만 쓰므로 지연분에 둔다. 홈의 주요 소식은 core 의 GAME_UPDATES 로 충분하다
const GAME_ARCHIVE = {js_data(tight(game_archive))};
'''
    return core, lazy


# ── 부속 파일 — build.json · PWA 정적 파일 · sitemap · security.txt · robots · 404 ──
def write_site_files(game_master, config, tables, stale=()):
    # 2026-09-10 v2.50.0 아주 작은 빌드 표식 — 앱이 "지금 보고 있는 것이 최신인가" 를 물을 때 받는 파일.
    # data.js 는 1.5MB 라 확인용으로 매번 받을 수 없다. 이 파일은 100바이트도 안 된다.
    #   version  앱 버전 (patch 포함)
    #   fetched  데이터를 받은 날짜 (GAMEDAY 의 그 값 — 알 부화·레이드 보스가 이 날짜 기준이다).
    #            2026-09-16 v3.47.0 파일이 아니라 실리는 표에서 읽는다 — 검문이 직전 정상본으로 바꿔 넣었으면 그 날짜가 맞다
    gameday_fetched = (tables.get('gameday') or {}).get('fetched', '') if isinstance(tables.get('gameday'), dict) else ''
    #   stale    2026-09-16 v3.47.0 검문에서 직전 정상본으로 대체된 표 이름 (backend/guard.py). 보통 빈 목록
    json.dump({'version': APP_VERSION, 'fetched': gameday_fetched, 'timestamp': game_master['timestamp'], 'stale': list(stale)},
              open('dist/build.json', 'w', encoding='utf-8'), ensure_ascii=False)
    # 2026-09-03 PWA 정적 파일(manifest·아이콘·서비스워커) 복사
    if os.path.isdir('assets'):
        for filename in os.listdir('assets'):
            shutil.copy(f'assets/{filename}', 'dist/')
    # 2026-09-08 v2.27.0 검색·보안 부속 파일 — 빌드가 만든다(주소·날짜가 들어가 손으로 두면 낡는다)
    site_url = DEV_SITE_URL if BUILD_CHANNEL == 'dev' else SITE_URL
    # sitemap: 해시 라우팅이라 색인되는 주소는 사실상 첫 화면 하나뿐이다. 있는 것만 정직하게 적는다
    open('dist/sitemap.xml', 'w', encoding='utf-8').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'  <url><loc>{site_url}</loc><lastmod>{date.today().isoformat()}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>\n'
        '</urlset>\n')
    # security.txt: 취약점을 발견한 사람이 어디로 알릴지 찾는 표준 위치 (RFC 9116).
    # 공개 저장소라 누구나 코드를 읽는다 — 제보 창구를 눈에 띄게 두는 편이 안전하다
    contact_email = config['CONTACT_EMAIL']
    if contact_email:
        os.makedirs('dist/.well-known', exist_ok=True)
        expires = date.today().replace(year=date.today().year + 1).isoformat()
        open('dist/.well-known/security.txt', 'w', encoding='utf-8').write(
            f'Contact: mailto:{contact_email}\n'
            f'Expires: {expires}T00:00:00.000Z\n'
            'Preferred-Languages: ko, en\n'
            'Policy: https://github.com/minsangkwak/pogo-rank/blob/main/SECURITY.md\n')
    if BUILD_CHANNEL == 'dev':
        # dev 미리보기는 검색에 잡히면 안 된다 — 정적 robots.txt 를 전부 차단으로 덮어쓴다
        open('dist/robots.txt', 'w', encoding='utf-8').write('# moncamp dev 미리보기 — 색인 금지\nUser-agent: *\nDisallow: /\n')
    else:
        # robots.txt 끝에 sitemap 위치를 알린다 (정적 파일에 주소를 박아 두지 않으려고 여기서 붙인다)
        with open('dist/robots.txt', 'a', encoding='utf-8') as robots:
            robots.write(f'\n# 사이트맵\nSitemap: {site_url}sitemap.xml\n')
    # 404: GitHub Pages 는 없는 주소에 기본 404 를 보여 준다. 해시 라우팅이라 오타 하나로도 여기 온다 —
    # 서비스 안으로 돌려보내는 문을 만들어 둔다
    open('dist/404.html', 'w', encoding='utf-8').write(f'''<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>페이지를 찾을 수 없어요 — moncamp</title>
<style>body{{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
background:#fff;color:#17181a;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px}}
a{{color:inherit}}p{{margin:0;color:#7a7c80;font-size:14px;line-height:1.6}}
@media(prefers-color-scheme:dark){{body{{background:#121315;color:#ecedee}}p{{color:#8c8f94}}}}</style>
</head><body>
<strong style="font-size:20px">페이지를 찾을 수 없어요</strong>
<p>주소가 바뀌었거나 없는 페이지입니다.</p>
<p><a href="{site_url}">moncamp 첫 화면으로 →</a></p>
</body></html>
''')


def main():
    # PvPoke 게임마스터: 종 목록(pokemon) · 기술 목록(moves) · 데이터 기준일(timestamp)
    game_master = json.load(open('data/gm.json'))
    config = read_config()
    os.makedirs('dist', exist_ok=True)
    sprite_ids, sprite_anim_ids = copy_sprites()
    # 앞 단계가 만든 표 전부 — 이름은 data/<이름>.json 과 같다 (1차 실행에서는 대부분 None)
    tables = {'pvp': build_pvp_tables(game_master)}
    for name, _required in guard.TABLES:
        if name != 'pvp':
            tables[name] = load_table_file(f'data/{name}.json')
    # 2026-09-16 v3.47.0 검문 — 비거나 줄어든 표는 직전 정상본으로 바꿔 넣는다 (BUILD_GATE=1 일 때만, backend/guard.py)
    stale = guard.apply(tables) if guard.enabled() else []
    rank_delta_date, rank_fresh_days = apply_rank_delta(tables)
    game_updates, update_counts = load_game_updates()
    game_archive = load_game_archive(game_updates)
    data_js, data_lazy_js = render_data_js(game_master, tables, stale, rank_delta_date, rank_fresh_days, sprite_ids, sprite_anim_ids, game_updates, game_archive)
    if INLINE:
        data_js += '\n' + data_lazy_js   # 미리보기는 단일 HTML — 지연분도 한 덩이로
    else:
        open('dist/data.js', 'w', encoding='utf-8').write(data_js)
        open('dist/data-lazy.js', 'w', encoding='utf-8').write(data_lazy_js)
    write_site_files(game_master, config, tables, stale)
    # 리그별로 몇 줄이 실렸는지 요약 출력 (빌드 로그 확인용)
    print('ok', {league_id: len(league_rows) for league_id, league_rows in tables['pvp'].items()})
    if update_counts:
        print('게임 업데이트:', ' · '.join(f'{status} {count}' for status, count in sorted(update_counts.items())),
              f"→ 공개 {len(game_updates)}건 · 아카이브 {len(game_archive)}건")

if __name__ == '__main__':
    main()
