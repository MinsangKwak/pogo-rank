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

결과
  backend/config/game_update_candidates.json  — 사람이 읽을 후보 목록.
  이미 게시된 글(game_updates.json 의 출처 주소)과 겹치는 후보는 제외한다.
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
ARTICLE_URL = 'https://pokemongo.com/{lang}/news/{slug}'
# 공식 릴리스 노트·알려진 문제 — 뉴스는 대부분 이벤트라 **실제 변경은 여기에 쌓인다**.
# 항목마다 제 주소가 있고 한국어판도 있다 (2026-09-16 확인: 한국어 13건)
HELPSHIFT_SECTION = 'https://niantic.helpshift.com/hc/{lang}/6-pokemon-go/section/180-release-notes-known-issues/'
HELPSHIFT_HOST = 'https://niantic.helpshift.com'
CANDIDATES_PATH = 'backend/config/game_update_candidates.json'
PUBLISHED_PATH = 'backend/config/game_updates.json'
UA = 'Mozilla/5.0 (compatible; moncamp-collector/1.0; +https://moncamp.kr)'

# "규칙이 바뀌었다" 로 읽히는 문장 — 이벤트 안내와 가르는 1차 체.
# 넉넉하게 잡는다: 놓치는 것보다 사람이 한 줄 더 읽는 편이 낫다.
CHANGE_HINTS_KO = [
    '변경', '조정', '수정', '개선', '적용됩니다', '적용됐', '바뀝니다', '바뀌었',
    '늘어납니다', '줄어듭니다', '상향', '하향', '사용할 수 없', '사용할 수 있게',
    '더 이상', '이제부터', '추가됩니다', '삭제', '종료됩니다', '알려진 문제', '오류',
]
CHANGE_HINTS_EN = [
    'change', 'update to', 'now available', 'no longer', 'will increase', 'will decrease',
    'adjust', 'fixed', 'bug', 'known issue', 'removed', 'starting with', 'won’t be able',
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
    body = html.unescape(re.sub(r'<[^>]+>', '\n', body))
    lines = [line.strip() for line in body.split('\n') if len(line.strip()) > 2]
    out = []
    for line in lines:
        if out and out[-1] == line:
            continue
        out.append(line)
    # 머리말(전역 메뉴)을 지난 뒤부터 — '업데이트' 나 '트레이너' 로 본문이 시작한다
    for index, line in enumerate(out):
        if line.startswith('트레이너') or line.startswith('Trainers'):
            return out[index:]
    return out


def published_date(page):
    found = re.search(r'datePublished"?\s*[:=]\s*"([^"]{10,})"', page)
    return found.group(1)[:10] if found else ''


def change_lines(lines, lang):
    """규칙이 바뀐 것으로 보이는 줄만. 사람이 읽을 근거라 원문 그대로 남긴다."""
    hints = CHANGE_HINTS_KO if lang == 'ko' else CHANGE_HINTS_EN
    picked = []
    for line in lines:
        if len(line) < 10 or len(line) > 400:
            continue
        low = line.lower()
        if any(hint.lower() in low for hint in hints):
            picked.append(line)
    return picked[:12]


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
        out.append({'faq': faq_id, 'title': title, 'snippet': html.unescape(snippet).strip(),
                    'url': HELPSHIFT_HOST + href.rstrip('/') + '/'})
    return out


def collect_helpshift(done):
    """릴리스 노트 항목을 후보로. 한국어 제목을 기준으로 삼고 영어판을 짝지어 붙인다."""
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
        candidates.append({
            'slug': f'helpshift-{faq_id}',
            'kind': 'release-note',
            'title': head['title'],
            'snippet': head['snippet'],
            'announcedAt': '',          # 이 목록은 날짜를 적지 않는다 — 사람이 항목을 열어 확인한다
            'sources': sources,
            'changeLines': {lang: [table[faq_id]['snippet']] for lang, table in (('ko', ko), ('en', en))
                            if faq_id in table and table[faq_id]['snippet']},
        })
    return candidates


def index_slugs(page, lang):
    return sorted(set(re.findall(rf'href="/{lang}/news/([a-z0-9\-]+)"', page)))


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
    args = parser.parse_args()

    from datetime import date, timedelta
    cutoff = (date.today() - timedelta(days=args.days)).isoformat()
    done = already_published(PUBLISHED_PATH)

    slugs = {}
    for lang, url in INDEX_URLS:
        try:
            page = fetch(url)
        except (urllib.error.URLError, TimeoutError) as error:
            # 색인을 못 받으면 **그 언어만** 건너뛴다 — 한쪽만 살아 있어도 후보는 만들 수 있다
            print(f'색인 실패 {lang}: {error}', file=sys.stderr)
            continue
        for slug in index_slugs(page, lang):
            slugs.setdefault(slug, set()).add(lang)
    if not slugs:
        print('색인을 하나도 못 받았다 — 기존 후보 파일을 그대로 둔다', file=sys.stderr)
        return 1

    order = sorted(slugs)
    if args.limit:
        order = order[:args.limit]

    candidates, skipped = [], {'게시됨': 0, '이벤트': 0, '오래됨': 0, '변경 없음': 0, '못 받음': 0}
    for slug in order:
        if slug in done:
            skipped['게시됨'] += 1
            continue
        if EVENT_ONLY_SLUG.search(slug):
            skipped['이벤트'] += 1
            continue
        entry = {'slug': slug, 'sources': [], 'changeLines': {}}
        for lang in ('ko', 'en'):
            if lang not in slugs[slug]:
                continue
            try:
                page = fetch(ARTICLE_URL.format(lang=lang, slug=slug))
            except (urllib.error.URLError, TimeoutError) as error:
                print(f'  못 받음 {lang}/{slug}: {error}', file=sys.stderr)
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
        if entry.get('announcedAt') and entry['announcedAt'] < cutoff:
            skipped['오래됨'] += 1
            continue
        if not entry['changeLines']:
            skipped['변경 없음'] += 1
            continue
        candidates.append(entry)

    # 릴리스 노트 — 실제 변경이 쌓이는 곳이라 뉴스와 함께 모은다
    notes = collect_helpshift(done)
    candidates.extend(notes)
    print(f'  (릴리스 노트 {len(notes)}건 포함)')
    candidates.sort(key=lambda entry: entry.get('announcedAt', ''), reverse=True)
    print(f'후보 {len(candidates)}건 · 건너뜀 ' + ' · '.join(f'{k} {v}' for k, v in skipped.items() if v))
    for entry in candidates:
        print(f"  [{entry.get('announcedAt', '????-??-??')}] {entry['slug']} — 변경 줄 "
              f"{sum(len(v) for v in entry['changeLines'].values())}개")
    if args.dry_run:
        return 0
    payload = {
        '_comment': [
            '자동 수집한 **후보** 목록이다 (scripts/collect_game_updates.py).',
            '이 파일은 게시물이 아니다 — 사람이 읽고 판단해 backend/config/game_updates.json 에',
            'editorialStatus=published 로 옮겨 적어야 화면에 나간다.',
            'changeLines 는 공식 원문에서 "규칙이 바뀐 것으로 보이는" 줄을 그대로 옮긴 것이다. 요약이 아니다.',
        ],
        'collectedAt': date.today().isoformat(),
        'candidates': candidates,
    }
    os.makedirs(os.path.dirname(CANDIDATES_PATH), exist_ok=True)
    open(CANDIDATES_PATH, 'w', encoding='utf-8').write(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(f'→ {CANDIDATES_PATH}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
