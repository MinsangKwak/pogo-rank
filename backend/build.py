import json, csv, re, os
from sprite import sprite_id
from names import name_ko, species, ko_species

g = json.load(open('data/gm.json'))
moves = {m['moveId']: m for m in g['moves']}


# 한국어 기술 이름: 영문명(소문자) → 한글
en_move, ko_move = {}, {}
for row in csv.DictReader(open('data/move_names.csv', encoding='utf-8')):
    if row['local_language_id'] == '9': en_move[row['name'].lower()] = row['move_id']
    if row['local_language_id'] == '3': ko_move[row['move_id']] = row['name']
def norm(n): return re.sub(r'[^a-z0-9]', '', n.lower())
en_move_norm = {norm(k): v for k, v in en_move.items()}
def move_ko(move_id):
    m = moves.get(move_id)
    if not m: return move_id
    name = m['name']
    paren = re.search(r'\((\w+)\)', name)
    base = re.sub(r'\s*\(.*\)', '', name)
    ko = ko_move.get(en_move_norm.get(norm(base)), base)
    return f"{ko}({TYPE_KO.get(paren.group(1).lower(), paren.group(1))})" if paren else ko

TYPE_KO = {'normal':'노말','fire':'불꽃','water':'물','grass':'풀','electric':'전기','ice':'얼음','fighting':'격투','poison':'독','ground':'땅','flying':'비행','psychic':'에스퍼','bug':'벌레','rock':'바위','ghost':'고스트','dragon':'드래곤','dark':'악','steel':'강철','fairy':'페어리'}

TOP = 40
pvp, pvp_all = {}, {}
for cp, lid in [(500,'little'),(1500,'great'),(2500,'ultra'),(10000,'master')]:
    r = json.load(open(f'data/r{cp}.json'))
    rows = []
    pvp_all[lid] = [{'rank': i+1, 'name': name_ko(e['speciesId'])[0], 'sprite': sprite_id(species[e['speciesId']]['dex'], name_ko(e['speciesId'])[1]),
                     'types': [t for t in species[e['speciesId']]['types'] if t != 'none'], 'en': species[e['speciesId']]['speciesName']} for i, e in enumerate(r)]
    for i, e in enumerate(r[:TOP]):
        p = species[e['speciesId']]
        fm = e['moveset'][0]; cms = e['moveset'][1:]
        nm, lbl = name_ko(e['speciesId'])
        rows.append({'rank': i+1, 'name': nm, 'en': p['speciesName'], 'sprite': sprite_id(p['dex'], lbl),
                     'types': [t for t in p['types'] if t != 'none'],
                     'fast': move_ko(fm), 'charged': ' / '.join(move_ko(c) for c in cms), 'score': e['score']})
    pvp[lid] = rows

os.makedirs('dist', exist_ok=True)
json.dump(pvp, open('data/pvp.json', 'w', encoding='utf-8'), ensure_ascii=False)
json.dump(pvp_all, open('data/pvp_all.json', 'w', encoding='utf-8'), ensure_ascii=False)

# ── frontend/ 의 CSS·JS를 순서대로 인라인해 단일 dist/index.html 조립 ──
# 순서가 곧 캐스케이드(CSS)·실행 순서(JS)이므로 새 파일은 여기 목록에 추가
APP_VERSION = 'v2.3.0'  # 2026-09-03 화면 표시용 버전 — 릴리스 때 여기만 올리면 됨
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
    'components/type-dots.js', 'components/sprite.js', 'components/row.js',  # 2026-09-03 v2.2.0 owned.js(보유 ☆) 제거 → auth.js 즐겨찾기로 대체
    'components/list.js', 'components/chips.js', 'components/seg.js',
    'components/modal.js', 'components/auth.js', 'components/detail.js',  # 2026-09-03 v2.2.0 auth: 로그인·즐겨찾기 (detail보다 먼저)
    'components/schedule.js', 'components/release.js', 'components/search.js', 'components/drawer.js', 'components/pages.js', 'components/trainers.js', 'components/totop.js',  # 2026-09-02 9월 일정표 달력 · 업데이트 팝업
    'views/pvp.js', 'views/pve.js', 'views/max.js', 'views/tier.js', 'views/usage.js', 'views/ifsolo.js',  # 2026-09-02 if 탭
    'app.js',
]
def bundle(folder, files, mark):
    parts = [f'{mark} ── {f} ──{" */" if mark == "/*" else ""}\n' + open(f'frontend/{folder}/{f}', encoding='utf-8').read().strip() for f in files]
    return '\n\n'.join(parts)

def opt(p): return open(p, encoding='utf-8').read() if os.path.exists(p) else '{}'

# 2026-09-03 v2.0.0: 데이터는 dist/data.js 별도 파일, 스프라이트는 개별 png + lazy 로딩
# SPRITE_INLINE=1 환경변수면 옛 방식(단일 HTML, base64 인라인) — 채팅 미리보기용
INLINE = os.environ.get('SPRITE_INLINE') == '1'
sprite_ids = []
if os.path.exists('data/sprites'):
    os.makedirs('dist/sprites', exist_ok=True)
    for f in os.listdir('data/sprites'):
        src = f'data/sprites/{f}'
        if f.endswith('.png') and open(src, 'rb').read(4) == b'\x89PNG'[:4]:
            sprite_ids.append(int(f[:-4]))
            if not INLINE: shutil_copy = __import__('shutil').copy(src, f'dist/sprites/{f}')

data_js = f'''// 빌드 생성 데이터 (backend/build.py) — 기준일 {g['timestamp']}
const TYPE_KO = {json.dumps(TYPE_KO, ensure_ascii=False)};
const PVP_DATA = {json.dumps(pvp, ensure_ascii=False)};
const PVE_DATA = {open('data/pve.json', encoding='utf-8').read()};
const PVE_EASY = {opt('data/pve_easy.json')};
const DMAX_DATA = {opt('data/dynamax.json')};
const DMAX_TIER = {opt('data/dynamax_tier.json')};
const VALUE_DATA = {opt('data/value.json')};
const SHEET_DATA = {opt('data/sheet.json')};
const DEX_DATA = {opt('data/dex.json')};
const BOSS_LIST = {opt('data/bosses.json') or '[]'};
const SPRITE_IDS = {json.dumps(sorted(sprite_ids))};
const SPRITES = {(open('data/sprites.json').read() if INLINE and os.path.exists('data/sprites.json') else 'null')};
'''
html = open('frontend/index.html', encoding='utf-8').read()
html = html.replace('__STYLES__', bundle('styles', STYLES, '/*')).replace('__SCRIPTS__', bundle('scripts', SCRIPTS, '//'))
html = html.replace('__TIMESTAMP__', g['timestamp']).replace('__VERSION__', APP_VERSION)
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
    for f in os.listdir('frontend/static'): shutil.copy(f'frontend/static/{f}', 'dist/')
print('ok', {k: len(v) for k, v in pvp.items()})


