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
from datetime import date
from sprite import sprite_id
from names import name_ko, species, ko_species, FORM_KO

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
TYPE_EN = {english_type: english_type.capitalize() for english_type in TYPE_KO}  # 2026-09-08 v2.29.0 다국어 — 게임 표기가 곧 대문자 한 글자 차이라 표를 따로 적지 않는다

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
        # 2026-09-05 form(폼 라벨)·dex 를 함께 남긴다 — roles_build.py 가 '도감번호|폼라벨' 키를 만들 때 쓴다
        all_rows.append({'rank': index+1, 'name': korean_name, 'sprite': sprite_id(pokemon['dex'], form_label),
                         'dex': pokemon['dex'], 'form': form_label,
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
APP_VERSION = 'v2.60.1'  # 화면을 옮겨도 상세 패널이 따라오던 것 수정
# 2026-09-05 v2.7.3 빌드 채널 — 'prod'(기본) / 'dev'. dev 브랜치 워크플로(.github/workflows/deploy-dev.yml)가 BUILD_CHANNEL=dev 로 부른다.
# dev 빌드는 (1) 버전 배지에 -dev 를 붙여 화면에서 구분되고 (2) GA 스니펫을 넣지 않아 통계가 섞이지 않고
# (3) robots.txt 를 전부 차단 + <meta name="robots" content="noindex"> 로 검색 색인을 막는다. 나머지는 prod 와 동일
BUILD_CHANNEL = os.environ.get('BUILD_CHANNEL', 'prod')
# 2026-09-08 v2.27.0 정식 주소 — canonical · og:url · og:image · sitemap 이 모두 여기서 나온다.
# 커스텀 도메인을 붙이면 이 두 줄만 고치면 된다 (index.html 에 흩어 두지 않은 이유)
SITE_URL = 'https://minsangkwak.github.io/pogo-rank/'
DEV_SITE_URL = 'https://minsangkwak.github.io/pogo-rank-dev/'
if BUILD_CHANNEL == 'dev':
    APP_VERSION += '-dev'
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
load_dotenv()
GA_ID = os.environ.get('GA_ID', '')                    # GA4 측정 ID. 비우면 추적 코드가 안 들어감
FIREBASE_CONFIG = json.loads(os.environ.get('FIREBASE_CONFIG_JSON') or '{}')   # 비우면 로그인 UI 가 안 뜬다
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '')        # ADMIN_UID 가 없을 때의 폴백 (보통 비움)
ADMIN_UID = os.environ.get('ADMIN_UID', '')            # firestore.rules 의 __ADMIN_UID__ 와 같은 값 (scripts/render_rules.sh)
CONTACT_EMAIL = os.environ.get('CONTACT_EMAIL', '')    # 푸터·개인정보처리방침 문의 이메일. 비우면 문구가 빠진다
if not FIREBASE_CONFIG:
    print('경고: FIREBASE_CONFIG_JSON 이 비어 있어 로그인 UI 없이 빌드됩니다 (.env.example 참고)')
# 2026-09-07 v2.18.0 (공개 준비 3) GA 는 동의 뒤에만 붙는다 — 여기서는 측정 ID 만 남기고, 실제 gtag 삽입은
# frontend/scripts/components/consent.js loadAnalytics() 가 localStorage pogo_consent 가 'granted' 일 때 한다.
# 배포 도메인(github.io)에서만 ID 를 노출해 로컬 미리보기·개발 중엔 동의해도 집계되지 않는다
GA_SNIPPET = '''<script>
if (location.hostname.endsWith('github.io')) window.GA_PENDING_ID = '__GA_ID__';
</script>'''

STYLES = [
    'tokens.css', 'base.css', 'layout.css',
    'components/home.css',
    'components/tabs.css', 'components/seg.css', 'components/chips.css',
    'components/list.css',
    'components/finder.css', 'components/tag.css', 'components/modal.css', 'components/search.css', 'components/drawer.css', 'components/pages.css',
    'components/planner.css',  # 2026-09-07 v2.15.0 🌱 플래너 모드 (QA-53·54)
    'components/consent.css',
    'components/app-shell.css',
    # 2026-09-10 v2.42.0 넓은 화면 전용 디자인 — 앞의 모든 규칙을 덮어써야 하므로 맨 끝
    'components/pc-theme.css',
]
SCRIPTS = [
    'data.js', 'dom.js', 'track.js',  # 2026-09-03 track: GA4 이벤트 헬퍼 (가장 먼저 정의)
    'i18n-en.js', 'i18n.js',  # 2026-09-08 v2.29.0 다국어 — 사전이 엔진보다 먼저 (엔진이 I18N_EN 을 참조)
    'router.js',              # 2026-09-08 v2.30.0 주소 표 — pages·planner·app-shell 이 모두 이 표를 본다
    'components/ui.js',       # 2026-09-08 v2.30.0 재사용 조각 (uchip · iconBtn · pageBody · footNote · hintNote)
    'components/home.js',
    'components/type-dots.js', 'components/sprite.js', 'components/name.js', 'components/changes.js', 'components/row.js',  # 2026-09-04 changes: 기술 변경·순위 변동 뱃지 (row가 사용) · 2026-09-06 name: 폼 라벨 뱃지 (row·detail·search 가 사용)
    'components/list.js', 'components/chips.js', 'components/seg.js',
    'components/history.js', 'components/modal.js', 'components/auth.js', 'components/detail.js',  # 2026-09-03 v2.2.0 auth: 로그인·즐겨찾기 (detail보다 먼저) · 2026-09-06 v2.11.0 history: 뒤로가기가 팝업·드로어를 닫게 (modal·drawer 가 사용)
    'components/schedule.js', 'components/release.js', 'components/terms.js', 'components/privacy.js', 'components/consent.js', 'components/search.js', 'components/drawer.js',  # 2026-09-07 v2.18.0 terms: 약관·동의 팝업·IP 고지 (privacy·auth 가 사용) · consent: GA 동의 배너  # 2026-09-02 9월 일정표 달력 · 업데이트 팝업
    'components/favs.js', 'components/typesearch.js', 'components/gameday.js', 'components/finder.js',  # 2026-09-11 v2.58.0 finder: 🔎 검색식 만들기 (pages 가 PAGES 에 등록하므로 그 앞) # 2026-09-05 favs: ★ 즐겨찾기 페이지 · 2026-09-06 typesearch: 🧭 상성 검색 페이지 · 2026-09-08 gameday: ⚔️ 레이드 보스 · 🥚 알 부화 (pages가 PAGES에 등록하므로 그 앞)
    'planner/shell.js', 'planner/home.js', 'planner/collection.js',  # 2026-09-07 v2.15.0 🌱 플래너 모드 (QA-53 셸 · QA-54 내 포켓몬) — pages.js 가 #/plan 라우팅에 쓰므로 그 앞
    'components/pages.js',
    'components/trainers.js', 'components/favdigest.js', 'components/totop.js',  # 2026-09-05 favdigest: 메인 즐겨찾기 카드
    'views/pvp.js', 'views/pve.js', 'views/max.js', 'views/tier.js', 'views/usage.js', 'views/ifsolo.js',  # 2026-09-02 if 탭
    'components/theme.js',  # 2026-09-10 v2.47.0 밝게/어둡게 전환 (헤더 버튼 · 계정 저장)
    'components/freshness.js',  # 2026-09-10 v2.50.0 새 데이터·새 버전 알림 (설치형 앱이 옛 데이터를 붙들지 않게)
    'app.js', 'components/app-shell.js',
]
# 2026-09-09 v2.41.0 UI 목록(#/styleguide)은 dev 미리보기에만 — 방문자에게는 쓸모가 없고 번들만 키운다.
# 라우트(ROUTES)·페이지(PAGES) 등록을 그 파일이 스스로 하므로, 빼면 주소 자체가 없는 빌드가 된다.
# 자리가 정해져 있다: PAGES(components/pages.js)가 만들어진 **뒤**, 첫 렌더(app.js)보다 **앞**.
# 맨 끝에 붙였더니 #/styleguide 로 바로 들어온 첫 화면이 라우트 등록 전에 그려져 홈으로 떨어졌다
if BUILD_CHANNEL == 'dev':
    STYLES.append('components/styleguide.css')
    SCRIPTS.insert(SCRIPTS.index('components/pages.js') + 1, 'components/styleguide.js')
# 2026-09-11 v2.57.0 data.js 의 공백을 줄인다. json.dumps 는 기본이 `", "` · `": "` 라
# 항목마다 공백 두 개가 붙는데, 1,172종 × 필드 수만큼 쌓이면 실측 194KB 다.
# 값은 한 글자도 바뀌지 않는다 — 사이의 공백만 없앤다.
JSON_TIGHT = (',', ':')

# ── 배포본에서 주석 걷어내기 (2026-09-11 v2.57.0) ───────────────────────────
# 이 저장소의 주석은 "왜 이렇게 했는가" 를 길게 적는다 — 그게 이 코드의 값어치다.
# 다만 그건 **읽는 사람**에게 값어치가 있는 것이고, 브라우저는 매번 그만큼을 더 받아 더 읽는다.
# 실측: 배포본 752KB 중 주석이 227KB(30%)였다. 원본은 그대로 두고 **나가는 것만** 걷어낸다.
#
# 안전선을 분명히 둔다 — 조금 덜 걷어내더라도 절대 깨뜨리지 않는다.
#   · JS 는 **줄 전체가 주석인 줄만** 지운다. 코드 뒤에 붙은 주석(` // …`)은 문자열 안일 수 있어
#     손대지 않는다 (실측 5.6KB 뿐이라 아낄 것도 별로 없다).
#   · 여러 줄 백틱(템플릿 리터럴) 안은 통째로 건너뛴다 — 그 안의 `//` 로 시작하는 줄은 주석이 아니라 글자다.
#   · CSS 는 문자열(' ")을 건너뛰며 /* */ 만 지운다 — content:"/*" 같은 것을 깨지 않는다.
#   · @license · @preserve 가 든 줄은 남긴다.
# 파일 머리말(`── 파일명 ──`)은 bundle() 이 **걷어낸 뒤에** 붙이므로 배포본에도 남는다 —
# 합쳐진 코드에서 어느 파일에서 왔는지는 배포본에서도 알 수 있어야 한다.

def _keep(line):
    return '@license' in line or '@preserve' in line

def strip_js_comments(src):
    out, in_block, in_tpl = [], False, False
    for line in src.split('\n'):
        stripped = line.strip()
        if in_tpl:                       # 템플릿 리터럴 안 — 글자다, 손대지 않는다
            out.append(line)
            if _backticks(line) % 2 == 1: in_tpl = False
            continue
        if in_block:
            end = line.find('*/')
            if end < 0: continue          # 아직 주석 안 — 줄째로 버린다
            in_block = False
            rest = line[end + 2:]
            if rest.strip(): out.append(rest)
            continue
        if stripped.startswith('//') and not _keep(line):
            continue
        if stripped.startswith('/*') and not _keep(line):
            end = line.find('*/', stripped.index('/*') + 2)
            if end < 0:
                in_block = True
                continue
            rest = line[end + 2:]
            if rest.strip(): out.append(rest)
            continue
        out.append(line)
        if _backticks(line) % 2 == 1: in_tpl = True
    # 걷어내고 남은 빈 줄이 잇따르면 하나로 줄인다 (읽기에도, 크기에도 낫다)
    packed, blank = [], False
    for line in out:
        if line.strip():
            packed.append(line); blank = False
        elif not blank:
            packed.append(''); blank = True
    return '\n'.join(packed)

def _backticks(line):
    # 이스케이프되지 않은 백틱 수 — 홀수면 이 줄에서 템플릿이 열리거나 닫힌다
    count, i = 0, 0
    while i < len(line):
        if line[i] == '\\': i += 2; continue
        if line[i] == '`': count += 1
        i += 1
    return count

def strip_css_comments(src):
    out, i, n, quote = [], 0, len(src), None
    while i < n:
        char = src[i]
        if quote:
            out.append(char)
            if char == '\\' and i + 1 < n: out.append(src[i + 1]); i += 2; continue
            if char == quote: quote = None
            i += 1; continue
        if char in '"\'':
            quote = char; out.append(char); i += 1; continue
        if char == '/' and i + 1 < n and src[i + 1] == '*':
            end = src.find('*/', i + 2)
            block = src[i:(n if end < 0 else end + 2)]
            if _keep(block): out.append(block)
            i = n if end < 0 else end + 2
            continue
        out.append(char); i += 1
    # 주석만 있던 줄이 빈 줄로 남는다 — 잇따른 빈 줄을 하나로
    lines, packed, blank = ''.join(out).split('\n'), [], False
    for line in lines:
        if line.strip():
            packed.append(line.rstrip()); blank = False
        elif not blank:
            packed.append(''); blank = True
    return '\n'.join(packed)


def bundle(folder, files, mark):
    # frontend/<folder>/ 의 파일들을 목록 순서 그대로 이어붙인다.
    # 조각마다 `── 파일명 ──` 머리말을 달아 합쳐진 뒤에도 어느 파일에서 온 코드인지 알 수 있게 한다.
    # mark는 그 머리말에 쓸 주석 기호 — CSS는 '/*'(닫는 '*/'까지 붙임), JS는 '//'.
    parts = []
    for filename in files:
        heading = f'{mark} ── {filename} ──{" */" if mark == "/*" else ""}\n'
        raw = open(f'frontend/{folder}/{filename}', encoding='utf-8').read().strip()
        cleaned = strip_css_comments(raw) if mark == '/*' else strip_js_comments(raw)
        parts.append(heading + cleaned.strip())
    return '\n\n'.join(parts)

# 아직 만들어지지 않은 데이터 파일(build.py 1차 실행 시점)은 빈 객체로 대체한다
def optional_json(path):
    # 2026-09-11 v2.57.0 파일을 그대로 붙이지 않고 한 번 되감아 공백을 줄인다.
    # 앞 단계(pve_build.py 등)가 만든 json 은 사람이 읽으라고 기본 구분자(`", "` · `": "`)로 저장돼 있는데,
    # 배포본에 그대로 실리면 항목마다 공백 두 개가 따라간다 — DEX_DATA·BOSS_LIST 처럼 큰 것에서 많이 쌓인다.
    # json 을 다시 읽어 다시 쓰므로 **값은 그대로고 사이의 공백만** 없어진다.
    # 깨진 json 이면 되감지 않고 원문을 그대로 넘긴다 — 여기서 배포를 막을 이유가 없다.
    if not os.path.exists(path):
        return '{}'
    raw = open(path, encoding='utf-8').read()
    try:
        return json.dumps(json.loads(raw), ensure_ascii=False, separators=JSON_TIGHT)
    except Exception:
        return raw

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
const TYPE_KO = {json.dumps(TYPE_KO, ensure_ascii=False, separators=JSON_TIGHT)};
// 2026-09-08 v2.29.0 다국어 — 타입 이름 영문. TYPE_KO 와 키가 같아야 typeName(t) 이 한 줄로 갈린다
const TYPE_EN = {json.dumps(TYPE_EN, ensure_ascii=False, separators=JSON_TIGHT)};
// 2026-09-06 v2.10.0 이름 앞에 붙는 폼 라벨 목록 (backend/names.py FORM_KO 값 + 섀도우·다이맥스·거다이맥스) — components/name.js 가 이름을 [라벨 뱃지 + 종 이름]으로 가른다
const FORM_LABELS = {json.dumps(sorted({label for label in FORM_KO.values() if label} | {'섀도우', '다이맥스', '거다이맥스'}, key=len, reverse=True), ensure_ascii=False, separators=JSON_TIGHT)};
const PVP_DATA = {json.dumps(pvp, ensure_ascii=False, separators=JSON_TIGHT)};
const PVE_DATA = {json.dumps(pve_tables, ensure_ascii=False, separators=JSON_TIGHT) if pve_tables else optional_json('data/pve.json')};
const PVE_EASY = {json.dumps(pve_easy_tables, ensure_ascii=False, separators=JSON_TIGHT) if pve_easy_tables else optional_json('data/pve_easy.json')};
const DMAX_DATA = {optional_json('data/dynamax.json')};
const DMAX_TANK = {optional_json('data/dynamax_tank.json')};   // 2026-09-07 v2.13.0 (QA-43) 보스 속성별 다이맥스 탱커(EHP) 순위
const MAX_POOL = {optional_json('data/max_pool.json')};   // 2026-09-04 맥스 배틀 포획 가능 종 (스프라이트 id → 'G'|'D')
const MOVE_CHANGES = {optional_json('data/move_changes.json')};   // 2026-09-04 시즌 기술 변경 안내 (backend/change_build.py)
const ROLES = {optional_json('data/roles.json')};                 // 2026-09-05 PvE/PvP 역할 자동 분류 근거 (backend/roles_build.py)
const RANK_DELTA_DATE = {json.dumps(rank_delta_date)};            // 2026-09-04 순위 변동을 기록한 날 (뱃지 유효기간 계산용)
const RANK_FRESH_DAYS = {rank_fresh_days};                        // 이 일수가 지나면 변동 뱃지를 감춘다
const DMAX_TIER = {json.dumps(dmax_tables, ensure_ascii=False, separators=JSON_TIGHT) if dmax_tables else optional_json('data/dynamax_tier.json')};
const VALUE_DATA = {json.dumps(value_tables, ensure_ascii=False, separators=JSON_TIGHT) if value_tables else optional_json('data/value.json')};
const SHEET_DATA = {json.dumps(sheet_tables, ensure_ascii=False, separators=JSON_TIGHT) if sheet_tables else optional_json('data/sheet.json')};
const DEX_DATA = {optional_json('data/dex.json')};
const BOSS_LIST = {optional_json('data/bosses.json') or '[]'};
const GAMEDAY = {optional_json('data/gameday.json')};              // 2026-09-08 v2.25.0 레이드 보스·알 부화 풀·이벤트 원본 (backend/gameday_build.py)
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
# dev 채널은 GA 를 끈다 (미리보기 트래픽이 실사용 통계에 섞이지 않게)
html = html.replace('__GA_SNIPPET__', GA_SNIPPET.replace('__GA_ID__', GA_ID) if GA_ID and BUILD_CHANNEL != 'dev' else '')
if BUILD_CHANNEL == 'dev':
    # 2026-09-11 v2.59.0 탭 제목 앞에 [dev] — 실서비스 탭과 미리보기 탭이 나란히 떠 있을 때
    # 둘을 제목만 보고 구분할 수 있어야 한다 (화면 안 버전 배지는 탭 목록에서 안 보인다).
    # 화면을 옮길 때마다 다시 붙이는 쪽은 components/app-shell.js 가 맡는다
    html = html.replace('<title>', '<title>[dev] ', 1)
    html = html.replace('</title>', '</title>\n<meta name="robots" content="noindex, nofollow">', 1)
    # 2026-09-08 v2.27.0 미리보기의 공유 카드가 실서비스를 가리키면 안 된다 — 주소를 dev 로 바꾼다.
    # (색인은 어차피 막지만, 링크를 붙였을 때 엉뚱한 곳으로 가는 것을 막으려는 것)
    html = html.replace(SITE_URL, DEV_SITE_URL)
# 2026-09-03 v2.2.0 앱 설정 주입
# 2026-09-10 v2.50.0 BUILD_VERSION — 지금 띄운 것이 어느 빌드인지 코드가 알아야 한다.
# 헤더에 글자로 박아 두던 것(__VERSION__)은 app-shell.js 가 헤더를 통째로 갈아 끼우면서 사라진다.
# 화면에서 긁어 오는 대신 값으로 넣는다 (components/freshness.js 가 build.json 과 견준다)
html = html.replace('__APP_CONFIG__', f"const FIREBASE_CONFIG = {json.dumps(FIREBASE_CONFIG)};\nconst ADMIN_EMAIL = {json.dumps(ADMIN_EMAIL)};\nconst ADMIN_UID = {json.dumps(ADMIN_UID)};\nconst CONTACT_EMAIL = {json.dumps(CONTACT_EMAIL)};\nconst BUILD_VERSION = {json.dumps(APP_VERSION)};")
# 2026-09-05 v2.8.0 푸터 문의 이메일 — CONTACT_EMAIL 이 비어 있으면 문구 자체를 뺀다
contact_html = f'문의·건의: <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a> · ' if CONTACT_EMAIL else ''
html = html.replace('__CONTACT__', contact_html)
if INLINE:
    # 미리보기: data.js 내용을 그대로 인라인해 단일 파일 유지
    html = html.replace('<script src="data.js"></script>', '<script>\n' + data_js + '\n</script>')
else:
    open('dist/data.js', 'w', encoding='utf-8').write(data_js)
open('dist/index.html', 'w', encoding='utf-8').write(html)
# 2026-09-10 v2.50.0 아주 작은 빌드 표식 — 앱이 "지금 보고 있는 것이 최신인가" 를 물을 때 받는 파일.
# data.js 는 1.5MB 라 확인용으로 매번 받을 수 없다. 이 파일은 100바이트도 안 된다.
#   version  앱 버전 (patch 포함)
#   fetched  데이터를 받은 날짜 (gameday.json 의 그 값 — 알 부화·레이드 보스가 이 날짜 기준이다)
_gameday_fetched = ''
try:
    _gameday_fetched = json.load(open('data/gameday.json', encoding='utf-8')).get('fetched', '')
except Exception:
    pass
json.dump({'version': APP_VERSION, 'fetched': _gameday_fetched, 'timestamp': game_master['timestamp']},
          open('dist/build.json', 'w', encoding='utf-8'), ensure_ascii=False)
# 2026-09-03 PWA 정적 파일(manifest·아이콘·서비스워커) 복사
import shutil
if os.path.isdir('frontend/static'):
    for filename in os.listdir('frontend/static'):
        shutil.copy(f'frontend/static/{filename}', 'dist/')
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
if CONTACT_EMAIL:
    os.makedirs('dist/.well-known', exist_ok=True)
    expires = date.today().replace(year=date.today().year + 1).isoformat()
    open('dist/.well-known/security.txt', 'w', encoding='utf-8').write(
        f'Contact: mailto:{CONTACT_EMAIL}\n'
        f'Expires: {expires}T00:00:00.000Z\n'
        'Preferred-Languages: ko, en\n'
        'Policy: https://github.com/minsangkwak/pogo-rank/blob/main/SECURITY.md\n')
if BUILD_CHANNEL == 'dev':
    # dev 미리보기는 검색에 잡히면 안 된다 — 정적 robots.txt 를 전부 차단으로 덮어쓴다
    open('dist/robots.txt', 'w', encoding='utf-8').write('# POGO PLAN dev 미리보기 — 색인 금지\nUser-agent: *\nDisallow: /\n')
else:
    # robots.txt 끝에 sitemap 위치를 알린다 (정적 파일에 주소를 박아 두지 않으려고 여기서 붙인다)
    with open('dist/robots.txt', 'a', encoding='utf-8') as robots:
        robots.write(f'\n# 사이트맵\nSitemap: {site_url}sitemap.xml\n')
# 404: GitHub Pages 는 없는 주소에 기본 404 를 보여 준다. 해시 라우팅이라 오타 하나로도 여기 온다 —
# 서비스 안으로 돌려보내는 문을 만들어 둔다
open('dist/404.html', 'w', encoding='utf-8').write(f'''<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>페이지를 찾을 수 없어요 — POGO PLAN</title>
<style>body{{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
background:#fff;color:#17181a;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px}}
a{{color:inherit}}p{{margin:0;color:#7a7c80;font-size:14px;line-height:1.6}}
@media(prefers-color-scheme:dark){{body{{background:#121315;color:#ecedee}}p{{color:#8c8f94}}}}</style>
</head><body>
<strong style="font-size:20px">페이지를 찾을 수 없어요</strong>
<p>주소가 바뀌었거나 없는 페이지입니다.</p>
<p><a href="{site_url}">POGO PLAN 첫 화면으로 →</a></p>
</body></html>
''')
# 리그별로 몇 줄이 실렸는지 요약 출력 (빌드 로그 확인용)
print('ok', {league_id: len(league_rows) for league_id, league_rows in pvp.items()})
