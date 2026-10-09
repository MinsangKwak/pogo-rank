#!/usr/bin/env python3
"""공식 소식에서 게임 업데이트 **후보**를 모은다 (2026-09-16 v3.53.0).

왜 만들었나
  v3.51.0~v3.52.0 은 사람이 공식 페이지를 하나씩 열어 읽고 요약을 손으로 적었다.
  글 두세 건은 되지만 매주 도는 일이 되면 안 된다 — 빠뜨리거나, 급해서 확인을 건너뛰게 된다.

무엇을 자동으로 하고, 무엇을 사람이 하나
  자동   공식 뉴스 색인을 훑어 새 글을 찾고, 한국어·영어 원문을 짝지어 받고,
         발표일·미리보기 그림을 뽑고, **규칙이 바뀐 문장으로 보이는 줄**을 모아 둔다.
  사람   그 줄을 읽고 진짜 변경인지 판단해 요약·전후·영향을 쓴 뒤 published 로 올린다.

  자동 공개는 하지 않는다. 이 스크립트가 만드는 것은 전부 editorialStatus='draft' 이고,
  빌드는 published 만 싣는다 (backend/build.py load_game_updates). 수집 성공이 게시 승인이 아니다 —
  기획 문서의 원칙이자, 잘못된 소식을 내보내는 것이 이 기능의 유일한 큰 사고라서다.

쓰는 법
  python3 scripts/collect_game_updates.py            후보를 새로 고친다 (기본 30일)
  python3 scripts/collect_game_updates.py --days 90  더 과거까지
  python3 scripts/collect_game_updates.py --dry-run  파일을 쓰지 않고 요약만 출력

결과 — 두 파일을 만든다 (2026-09-16 v3.54.0)
  backend/config/game_update_archive.json     — **아카이브 색인**. 공식 제목·날짜·원문 링크·썸네일과
      원문에서 그대로 따온 한 문단(인용). 우리 요약이 아니라 인용이라 검증 없이도 공개할 수 있다.
      이벤트 안내도 뺀 것 없이 전부 담는다 — "그때 무슨 일이 있었나" 를 훑는 자리이기 때문이다.
  backend/config/game_update_candidates.json  — **기사 후보**. 규칙이 바뀐 것으로 보이는 줄을 모아 둔 것.
      사람이 읽고 판단해 game_updates.json 에 published 로 옮겨 적으면 기사가 된다.

  아카이브 → 기사 승격: 아카이브 항목이 곧 기사 후보다. 같은 원문으로 기사가 생기면 화면은 기사를 보이고
  아카이브 쪽은 숨는다 (frontend-v4/src/screens/GameUpdates.tsx). 그래서 "전부 기사" 가 목표로 살아 있으면서
  검증 안 된 문장이 나가는 일은 없다.
"""
import argparse
import html
import json
import os
import re
import sys
import urllib.error
import urllib.request

INDEX_URLS = [('ko', 'https://pokemongo.com/ko/news'), ('en', 'https://pokemongo.com/en/news')]
# 과거 백필 — 공식 색인은 **최근 30건만** 내놓는다 (2026-09-16 확인: ?page=2 도 같은 30건, 사이트맵·API 없음).
# 그래서 2020년까지 거슬러 가려면 웹 아카이브에 물어 옛 주소 목록을 얻어야 한다.
# CDX 는 "이 주소가 언제 저장됐나" 만 돌려준다 — 본문은 살아 있는 공식 주소에서 먼저 받아 보고,
# 404 면 그때 아카이브 사본을 쓴다. 출처는 어느 쪽이든 공식 원문이다
CDX_URL = ('http://web.archive.org/cdx/search/cdx?url=pokemongo.com/{lang}/news*'
           '&from={frm}&to={to}&output=json&fl=original&collapse=urlkey&limit=50000')
WAYBACK_SNAPSHOT = 'http://web.archive.org/web/{stamp}id_/{url}'
ARTICLE_URL = 'https://pokemongo.com/{lang}/news/{slug}'
# 공식 릴리스 노트·알려진 문제 — 뉴스는 대부분 이벤트라 **실제 변경은 여기에 쌓인다**.
# 항목마다 제 주소가 있고 한국어판도 있다 (2026-09-16 확인: 한국어 13건)
HELPSHIFT_SECTION = 'https://niantic.helpshift.com/hc/{lang}/6-pokemon-go/section/180-release-notes-known-issues/'
HELPSHIFT_HOST = 'https://niantic.helpshift.com'
CANDIDATES_PATH = 'backend/config/game_update_candidates.json'
ARCHIVE_PATH = 'backend/config/game_update_archive.json'
PUBLISHED_PATH = 'backend/config/game_updates.json'
UA = 'Mozilla/5.0 (compatible; moncamp-collector/1.0; +https://moncamp.kr)'

# "규칙이 바뀌었다" 로 읽히는 문장 — 이벤트 안내와 가르는 1차 체.
# 넉넉하게 잡는다: 놓치는 것보다 사람이 한 줄 더 읽는 편이 낫다.
CHANGE_HINTS_KO = [
    '변경', '조정', '수정', '개선', '적용됩니다', '적용됐', '바뀝니다', '바뀌었',
    '늘어납니다', '줄어듭니다', '상향', '하향', '사용할 수 없', '사용할 수 있게',
    '더 이상', '이제부터', '추가됩니다', '삭제', '종료됩니다', '알려진 문제', '오류',
    # 2026-10-10 '처음으로 … 올릴 수 있습니다' · '추가로 배울 수 있습니다' — 새 규칙을 처음 여는 문장도 변경이다(Codex #349)
    '처음으로', '추가로',
]
CHANGE_HINTS_EN = [
    'change', 'update to', 'now available', 'no longer', 'will increase', 'will decrease',
    'adjust', 'fixed', 'bug', 'known issue', 'removed', 'starting with', 'won’t be able',
    'for the first time', 'additional',
]
# 이벤트 안내로만 보이는 글 — 제목에 이것만 있으면 후보에서 내린다 (기획: 단순 이벤트는 기사로 만들지 않는다)
EVENT_ONLY_SLUG = re.compile(
    r'community ?day|communityday|raid-?day|spotlight|hatch-?day|research-?day|'
    r'ticket|stamp-rally|picnic|celebration|save-the-date|go-pass|world-championships', re.I)


def fetch(url, timeout=30):
    request = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ko,en'})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode('utf-8', 'replace')


def meta_of(page, prop):
    """<meta property="og:..."> 값 하나. 속성 순서가 뒤집힌 경우도 본다."""
    for pattern in (rf'<meta[^>]+property=["\']{prop}["\'][^>]*content=["\']([^"\']+)',
                    rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]*property=["\']{prop}["\']'):
        found = re.search(pattern, page)
        if found:
            return html.unescape(found.group(1))
    return ''


def text_lines(page):
    """태그를 걷어낸 본문 줄. 붙어 있는 중복 줄은 한 줄로 줄인다 (머리말 메뉴가 두 번 나온다)."""
    body = re.sub(r'<script.*?</script>|<style.*?</style>', ' ', page, flags=re.S)
    # 글자 꾸밈 태그(<i>「포켓몬스터썬·문」</i> 등)는 문장 안에 있다 — 줄을 끊으면 인용이 '의 무대인 …' 처럼 토막 난다
    body = re.sub(r'</?(?:i|b|em|strong|span|a|sup|sub|u|small)(?:\s[^>]*)?>', '', body, flags=re.I)
    body = html.unescape(re.sub(r'<[^>]+>', '\n', body))
    lines = [line.strip() for line in body.split('\n') if len(line.strip()) > 2]
    out = []
    for line in lines:
        if out and out[-1] == line:
            continue
        out.append(line)
    # 머리말(전역 메뉴)을 지난 뒤부터 — 본문은 제목(h1)을 한 번 더 쓴 줄 바로 뒤에서 시작한다(첫 줄은 <title>).
    # '트레이너' 로 시작하는 줄부터 보던 옛 규칙은 인사말 앞의 본문(핼러윈 파트 2 의 '슈퍼 맥스 레벨' 절)을 통째로 잘랐고,
    # '트레이너 배틀: 위력 55' 같은 표 줄에 먼저 걸리기도 했다(Codex #349)
    head = clean_title(out[0])[:20] if out else ''
    for index in range(1, min(len(out), 80)):
        if head and clean_title(out[index]).startswith(head):
            return out[index + 1:]
    for index, line in enumerate(out):
        if line.startswith('트레이너') or line.startswith('Trainers'):
            return out[index:]
    return out


def published_date(page):
    found = re.search(r'datePublished"?\s*[:=]\s*"([^"]{10,})"', page)
    return found.group(1)[:10] if found else ''


# 공식 페이지 제목 꼬리표 — 사이트 이름은 우리 목록에서 군더더기다
TITLE_TAIL = re.compile(r'\s*[—–-]\s*(Pok[eé]mon GO( 고객센터)?|Pokémon GO Help Center)\s*$', re.I)
# 어느 글에나 붙는 안내 문구 — 그 글의 내용이 아니라서 인용으로 쓰면 전부 같은 줄이 된다
BOILERPLATE = re.compile(
    r'주변을 살피|안전에 유의|주변 안전에 주의|Please be aware of your surroundings|follow guidelines from local|'
    # '게임을 플레이할 때는' 이 '"Pokémon GO"를 플레이할 때는' 으로 바뀌어 새어 나왔다 — 앞말을 떼고 잡는다
    r'플레이할 때는|Remember to be alert|'
    # 일정이 바뀔 수 있다는 고지 — 안전 문구 바로 뒤에 붙어 다닌다
    r'개최 중지 또는 내용이 변경|subject to change|'
    # 지원 언어 목록 — 거의 모든 글 끝에 붙는 안내라 그 글의 내용이 아니다
    r'는 영어, 프랑스어|is available in English')
# 다른 곳으로 보내는 안내 — 머리말 인사 · '자세한 내용은 … 에서 확인하세요'. 그 글의 내용이 아니다.
# 인사는 '트레이너 여러분' · 'Trainers,' 꼴만 — '트레이너 배틀: 위력 55' · 'Trainers can now …' 는 본문이다(Codex #351)
REDIRECT = re.compile(r'^(트레이너 여러분|Trainers[,!]|콘텐츠로 건너뛰기|Skip to|자세한 내용은|For more (details|information))')



def change_lines(lines, lang):
    """규칙이 바뀐 것으로 보이는 줄만. 사람이 읽을 근거라 원문 그대로 남긴다."""
    hints = CHANGE_HINTS_KO if lang == 'ko' else CHANGE_HINTS_EN
    picked = []
    for paragraph in lines:
        # 글자 꾸밈 태그(<a> 등)를 줄바꿈 없이 떼므로 문단 하나가 400자를 넘기도 한다 — 통째로 버리면
        # '처음으로 … 슈퍼 맥스까지 올릴 수 있습니다' 같은 규칙 문장이 사라진다. 긴 문단만 문장으로 나눠 본다(Codex #349)
        pieces = [paragraph] if len(paragraph) <= 400 else re.split(r'(?<=[.!?])\s+', paragraph)
        for line in pieces:
            if len(line) < 10 or len(line) > 400:
                continue
            # 어느 글에나 붙는 안전 안내 · 일정 변경 고지 · 다른 곳으로 보내는 안내는 '변경' 이 아니다 —
            # '내용이 변경될 수 있습니다' 가 힌트 '변경' 에 걸려 모든 후보의 근거가 같은 줄이 됐다(Codex #349)
            if BOILERPLATE.search(line) or REDIRECT.match(line):
                continue
            low = line.lower()
            if any(hint.lower() in low for hint in hints):
                picked.append(line)
    return picked[:12]


def clean_title(title):
    return TITLE_TAIL.sub('', html.unescape(title or '')).strip()


def excerpt_of(lines, title='', lang='ko'):
    """원문에서 그대로 따올 한 문단. **우리 요약이 아니라 인용이다** — 그래서 검증 없이 내보낼 수 있다.

    거르는 것: 머리말 인사 · 제목과 같은 줄(제목을 두 번 보여 줄 이유가 없다) ·
    어느 글에나 붙는 안전 안내(그 글의 내용이 아니다) · 한국어 글인데 영어만 있는 줄.
    """
    head = clean_title(title)
    for line in lines:
        if len(line) < 25 or len(line) > 400:
            continue
        if REDIRECT.match(line):
            continue
        if BOILERPLATE.search(line):
            continue
        if head and (line.startswith(head[:20]) or clean_title(line) == head):
            continue
        if lang == 'ko' and not re.search(r'[가-힣]', line):
            continue
        # '한국시간 2026년 11월 1일 10:00부터 …' 같은 기간 줄은 문장이 아니다 — 인용은 마침표 · 느낌표가 있는 문장으로
        if not re.search(r'[.!?]', line):
            continue
        return line if len(line) <= 220 else line[:219].rstrip() + '…'
    return ''


def collect_archive(slugs, order):
    """아카이브 색인 — 이벤트 안내까지 **전부** 담는다. 고르지 않는 것이 이 층의 일이다."""
    rows = []
    for slug in order:
        entry = {'id': slug, 'kind': 'news', 'title': '', 'date': '', 'excerpt': '', 'sources': []}
        for lang in ('ko', 'en'):
            if lang not in slugs.get(slug, ()):
                continue
            try:
                page = fetch(ARTICLE_URL.format(lang=lang, slug=slug))
            except (urllib.error.URLError, TimeoutError):
                continue
            lines = text_lines(page)
            entry['sources'].append({'lang': lang, 'label': clean_title(meta_of(page, 'og:title')) or slug,
                                     'url': ARTICLE_URL.format(lang=lang, slug=slug),
                                     'image': meta_of(page, 'og:image')})
            if lang == 'ko' or not entry['title']:
                title = clean_title(meta_of(page, 'og:title')) or slug
                entry['title'] = title
                entry['excerpt'] = excerpt_of(lines, title, lang) or entry['excerpt']
            entry['date'] = entry['date'] or published_date(page)
        if entry['sources']:
            rows.append(entry)
    return rows


def helpshift_entries(lang):
    """릴리스 노트 섹션의 항목들 → [{faq, title, snippet, url}]. 못 받으면 빈 목록."""
    try:
        page = fetch(HELPSHIFT_SECTION.format(lang=lang))
    except (urllib.error.URLError, TimeoutError) as error:
        print(f'릴리스 노트 실패 {lang}: {error}', file=sys.stderr)
        return []
    rows = re.findall(
        r'href=(/hc/' + lang + r'/6-pokemon-go/faq/([0-9]+)-[^\s>]*?)/?\s[^>]*>\s*<div>\s*'
        r'<p class="section-faq-title" >([^<]+)</p>\s*<p class="section-faq-answer" >([^<]*)',
        page)
    out = []
    for href, faq_id, title, snippet in rows:
        title = html.unescape(title).strip()
        # '버그 신고' 같은 안내 문서는 변경이 아니다
        if re.search(r'버그 신고|Reporting a Bug', title):
            continue
        out.append({'faq': faq_id, 'title': clean_title(title), 'snippet': html.unescape(snippet).strip(),
                    'url': HELPSHIFT_HOST + href.rstrip('/') + '/'})
    return out


def collect_helpshift(done, seen, today):
    """릴리스 노트 항목을 후보로. 한국어 제목을 기준으로 삼고 영어판을 짝지어 붙인다.

    이 목록은 날짜를 내놓지 않는다(페이지 안에 발표일 · 수정일이 없다, 2026-10-10 확인). 발표일을 지어내지 않고
    **우리가 처음 본 날**을 `checkedAt` 으로 적는다 — 화면은 발표일이 없는 글에 확인일을 대신 보이고, 정렬과
    7 · 30일 거름도 그 날짜로 한다. `seen` 은 지난 파일에 적힌 slug → checkedAt 이라 날짜가 매번 오늘로 밀리지 않는다.
    """
    ko = {entry['faq']: entry for entry in helpshift_entries('ko')}
    en = {entry['faq']: entry for entry in helpshift_entries('en')}
    candidates = []
    for faq_id in sorted(set(ko) | set(en), key=int, reverse=True):
        if f'helpshift-{faq_id}' in done:
            continue
        sources = []
        for lang, table in (('ko', ko), ('en', en)):
            entry = table.get(faq_id)
            if entry:
                sources.append({'lang': lang, 'label': entry['title'], 'url': entry['url'], 'image': ''})
        if not sources:
            continue
        head = ko.get(faq_id) or en.get(faq_id)
        slug = f'helpshift-{faq_id}'
        candidates.append({
            'slug': slug,
            'kind': 'release-note',
            'title': head['title'],
            'snippet': head['snippet'],
            'announcedAt': '',          # 이 목록은 날짜를 적지 않는다 — 사람이 항목을 열어 확인한다
            'checkedAt': seen.get(slug) or today,
            'sources': sources,
            'changeLines': {lang: [table[faq_id]['snippet']] for lang, table in (('ko', ko), ('en', en))
                            if faq_id in table and table[faq_id]['snippet']},
        })
    return candidates


def backfill_slugs(lang, frm, to):
    """웹 아카이브에서 그 기간의 공식 뉴스 주소를 훑어 slug 목록을 얻는다.

    이 컨테이너에서는 이그레스 정책에 막혀 403 이 난다(2026-09-16 확인) — Actions 러너에서만 돈다.
    막히면 빈 목록을 돌려주고 나머지 수집은 그대로 진행한다. 백필이 안 됐다고 주간 수집까지 세울 이유가 없다.
    """
    url = CDX_URL.format(lang=lang, frm=frm, to=to)
    try:
        rows = json.loads(fetch(url, timeout=120))
    except Exception as error:                      # 403 · 타임아웃 · JSON 아님 모두 같은 처방
        print(f'백필 색인 실패 {lang}: {error}', file=sys.stderr)
        return []
    found = set()
    for row in rows[1:]:
        hit = re.search(rf'/{lang}/news/([a-z0-9\-]+)', row[0])
        if hit:
            found.add(hit.group(1))
    print(f'  백필 색인 {lang}: {len(found)}개 주소')
    return sorted(found)


def index_slugs(page, lang):
    return sorted(set(re.findall(rf'href="/{lang}/news/([a-z0-9\-]+)"', page)))


def first_seen():
    """지난 후보 · 아카이브 파일에 적힌 slug → checkedAt. 릴리스 노트의 '처음 본 날' 을 수집마다 지키기 위해서다."""
    seen = {}
    for path, key in ((ARCHIVE_PATH, 'entries'), (CANDIDATES_PATH, 'candidates')):
        if not os.path.exists(path):
            continue
        for row in json.load(open(path, encoding='utf-8')).get(key, []):
            slug = row.get('id') or row.get('slug')
            if slug and row.get('checkedAt'):
                seen[slug] = min(seen.get(slug) or row['checkedAt'], row['checkedAt'])
    return seen


def already_published(path):
    """게시된 글이 쓰고 있는 출처 주소 — 같은 원문을 후보로 또 올리지 않는다.
    뉴스는 주소 끝자리(slug), 릴리스 노트는 faq 번호로 센다."""
    if not os.path.exists(path):
        return set()
    data = json.load(open(path, encoding='utf-8'))
    used = set()
    for article in data.get('articles', []):
        for source in article.get('sources') or []:
            url = source.get('url', '').rstrip('/')
            faq = re.search(r'/faq/([0-9]+)-', url)
            if faq:
                used.add(f'helpshift-{faq.group(1)}')
                continue
            slug = url.split('/')[-1]
            if slug:
                used.add(slug)
    return used


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--days', type=int, default=30, help='이 일수보다 오래된 글은 건너뛴다')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--limit', type=int, default=0, help='받아 볼 글 수 상한 (시험용)')
    parser.add_argument('--backfill', metavar='YYYYMMDD', default='',
                        help='이 날짜부터의 옛 글을 웹 아카이브로 찾아 아카이브 색인에 채운다 (예: 20200101)')
    args = parser.parse_args()

    from datetime import datetime, timedelta, timezone
    # 날짜는 전부 한국 기준 — 워크플로는 21:00 UTC(06:00 KST)에 돌아 runner 의 오늘은 한국보다 하루 전이고,
    # 화면은 날짜만 있는 값을 +09:00 으로 읽는다(Codex #351)
    today = datetime.now(timezone(timedelta(hours=9))).date()
    cutoff = (today - timedelta(days=args.days)).isoformat()
    done = already_published(PUBLISHED_PATH)

    slugs = {}
    # 백필 — 공식 색인이 안 내놓는 옛 주소를 웹 아카이브에서 먼저 모은다 (--backfill 일 때만)
    if args.backfill:
        for lang, _ in INDEX_URLS:
            for slug in backfill_slugs(lang, args.backfill, today.strftime('%Y%m%d')):
                slugs.setdefault(slug, set()).add(lang)
    index_failed = set()
    for lang, url in INDEX_URLS:
        try:
            page = fetch(url)
        except (urllib.error.URLError, TimeoutError) as error:
            # 색인을 못 받으면 **그 언어만** 건너뛴다 — 한쪽만 살아 있어도 후보는 만들 수 있다
            print(f'색인 실패 {lang}: {error}', file=sys.stderr)
            index_failed.add(lang)
            continue
        for slug in index_slugs(page, lang):
            slugs.setdefault(slug, set()).add(lang)
    if not slugs:
        print('색인을 하나도 못 받았다 — 기존 후보 파일을 그대로 둔다', file=sys.stderr)
        return 1

    order = sorted(slugs)
    if args.limit:
        order = order[:args.limit]

    # ── 아카이브 색인 — 고르지 않고 전부. 받은 것이 하나도 없으면 기존 파일을 건드리지 않는다
    archive = collect_archive(slugs, order)

    candidates, skipped = [], {'게시됨': 0, '이벤트': 0, '오래됨': 0, '변경 없음': 0, '못 받음': 0}
    dropped = set()
    for slug in order:
        if slug in done:
            skipped['게시됨'] += 1
            continue
        if EVENT_ONLY_SLUG.search(slug):
            skipped['이벤트'] += 1
            continue
        entry = {'slug': slug, 'sources': [], 'changeLines': {}}
        # 한쪽 색인을 못 받았으면 그 언어판은 slugs 에 아예 없어 아래 고리가 조용히 건너뛴다 — 그때도 '다 읽은 것' 이 아니다
        fetched_all = not index_failed
        for lang in ('ko', 'en'):
            if lang not in slugs[slug]:
                continue
            try:
                page = fetch(ARTICLE_URL.format(lang=lang, slug=slug))
            except (urllib.error.URLError, TimeoutError) as error:
                print(f'  못 받음 {lang}/{slug}: {error}', file=sys.stderr)
                fetched_all = False
                continue
            lines = text_lines(page)
            entry['sources'].append({
                'lang': lang,
                'label': meta_of(page, 'og:title') or slug,
                'url': ARTICLE_URL.format(lang=lang, slug=slug),
                'image': meta_of(page, 'og:image'),
            })
            entry.setdefault('announcedAt', published_date(page))
            hits = change_lines(lines, lang)
            if hits:
                entry['changeLines'][lang] = hits
        if not entry['sources']:
            skipped['못 받음'] += 1
            continue
        if not args.backfill and entry.get('announcedAt') and entry['announcedAt'] < cutoff:
            skipped['오래됨'] += 1
            continue
        if not entry['changeLines']:
            skipped['변경 없음'] += 1
            # 이번에 다시 읽어 '변경 없음' 이 된 글은 지난 후보 파일에서 되살리지 않는다 — 상용구만 남은 옛 줄이 돌아온다.
            # 단, 한쪽 언어판을 못 받은 글은 다 읽은 것이 아니라 지난 후보를 지킨다
            if fetched_all:
                dropped.add(slug)
            continue
        candidates.append(entry)

    # 릴리스 노트 — 실제 변경이 쌓이는 곳이라 뉴스와 함께 모은다. 처음 본 날은 지난 두 파일에서 이어받는다
    notes = collect_helpshift(done, first_seen(), today.isoformat())
    candidates.extend(notes)
    print(f'  (릴리스 노트 {len(notes)}건 포함)')
    # 아직 게시되지 않은 지난 후보는 남긴다 — 공식 색인 · 30일 창에서 내려갔다고 검토 대기열에서 지우면
    # 다시 받을 길이 없다(메가 헬가 '악의파동+' 변경이 담긴 mega-squads-2026 이 그렇게 빠졌다, Codex #303).
    # 사람이 파일에서 지운 후보는 색인에 다시 오르지 않는 한 돌아오지 않는다
    fresh = {entry['slug'] for entry in candidates}
    kept = 0
    if os.path.exists(CANDIDATES_PATH):
        for entry in json.load(open(CANDIDATES_PATH, encoding='utf-8')).get('candidates', []):
            if not entry.get('slug') or entry['slug'] in fresh or entry['slug'] in done or entry['slug'] in dropped:
                continue
            # 다시 받지 않는 옛 후보도 지금 기준으로 상용구를 걷어낸다 — 근거가 안전 안내뿐이던 줄은 여기서 빠진다
            entry['changeLines'] = {lang: [line for line in rows if not (BOILERPLATE.search(line) or REDIRECT.match(line))]
                                    for lang, rows in entry.get('changeLines', {}).items()}
            entry['changeLines'] = {lang: rows for lang, rows in entry['changeLines'].items() if rows}
            if not entry['changeLines']:
                skipped['변경 없음'] += 1
                continue
            candidates.append(entry)
            kept += 1
    print(f'  (지난 후보 {kept}건 유지)')
    candidates.sort(key=lambda entry: entry.get('announcedAt') or entry.get('checkedAt') or '', reverse=True)
    print(f'후보 {len(candidates)}건 · 건너뜀 ' + ' · '.join(f'{k} {v}' for k, v in skipped.items() if v))
    for entry in candidates:
        print(f"  [{entry.get('announcedAt') or entry.get('checkedAt') or '????-??-??'}] {entry['slug']} — 변경 줄 "
              f"{sum(len(v) for v in entry['changeLines'].values())}개")
    if args.dry_run:
        return 0
    if archive:
        # 릴리스 노트도 아카이브에 — 제목·주소·인용은 이미 손에 있다
        for note in notes:
            archive.append({'id': note['slug'], 'kind': 'release-note', 'title': note['title'],
                            'date': note.get('announcedAt', ''), 'checkedAt': note['checkedAt'],
                            'excerpt': note.get('snippet', ''), 'sources': note['sources']})
        # 기존 아카이브와 합친다 — 공식 색인에서 내려간 옛 글을 잃지 않기 위해서다.
        # 같은 id 는 이번에 받은 것으로 덮는다 (제목·주소가 바뀌었을 수 있다)
        merged = {}
        if os.path.exists(ARCHIVE_PATH):
            for row in json.load(open(ARCHIVE_PATH, encoding='utf-8')).get('entries', []):
                merged[row['id']] = row
        for row in archive:
            merged[row['id']] = row
        entries = sorted(merged.values(), key=lambda row: (row.get('date') or row.get('checkedAt') or '', row['id']),
                         reverse=True)
        open(ARCHIVE_PATH, 'w', encoding='utf-8').write(json.dumps({
            '_comment': [
                '**아카이브 색인** — 자동 수집 (scripts/collect_game_updates.py).',
                'excerpt 는 우리 요약이 아니라 **공식 원문에서 그대로 따온 인용**이다. 그래서 검증 없이 공개할 수 있다.',
                '여기에 있는 항목에 사람이 요약을 쓰면 backend/config/game_updates.json 의 기사가 되고,',
                '화면은 그때부터 기사를 보인다(같은 원문의 아카이브 항목은 숨는다).',
            ],
            'collectedAt': today.isoformat(),
            'entries': entries,
        }, ensure_ascii=False, indent=2) + '\n')
        print(f'아카이브 {len(entries)}건 → {ARCHIVE_PATH}')
    payload = {
        '_comment': [
            '자동 수집한 **후보** 목록이다 (scripts/collect_game_updates.py).',
            '이 파일은 게시물이 아니다 — 사람이 읽고 판단해 backend/config/game_updates.json 에',
            'editorialStatus=published 로 옮겨 적어야 화면에 나간다.',
            'changeLines 는 공식 원문에서 "규칙이 바뀐 것으로 보이는" 줄을 그대로 옮긴 것이다. 요약이 아니다.',
        ],
        'collectedAt': today.isoformat(),
        'candidates': candidates,
    }
    os.makedirs(os.path.dirname(CANDIDATES_PATH), exist_ok=True)
    open(CANDIDATES_PATH, 'w', encoding='utf-8').write(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(f'→ {CANDIDATES_PATH}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
