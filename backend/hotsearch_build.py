#!/usr/bin/env python3
# 2026-09-20 v4.5.5 인기 검색어 — GA4 에 쌓인 완성어를 하루 두 번 걷어 data/hotsearch.json 으로 굽는다.
#
# 왜 빌드가 하나
#   화면은 GitHub Pages 정적 배포라 브라우저가 GA 수치를 직접 못 읽는다(측정 ID 로는 쓰기만 된다).
#   그래서 배포 워크플로가 서비스 계정으로 Data API 를 부르고, 결과를 파일로 구워 함께 올린다.
#   12:00 · 24:00 KST 두 번 도는 이유는 그것이 "하루 두 번 갱신" 의 전부이기 때문이다 (.github/workflows/deploy.yml).
#
# 무엇을 세나
#   프런트가 **고른 순간에만** 보내는 GA4 표준 search 이벤트의 search_term 이다 (frontend-v4/src/lib/track.ts).
#   '뮤' 를 치다 뮤츠를 고르면 쌓이는 말은 '뮤츠' 하나다 — 토막말은 애초에 보내지 않는다.
#   search_term 을 쓰는 이유: GA4 **기본 측정기준**이라 콘솔에서 맞춤 측정기준을 등록하지 않아도 읽힌다.
#
# 입력(환경 변수)
#   GA_SA_JSON       서비스 계정 키 JSON 한 줄. GA4 속성에 '뷰어' 로 추가해 두어야 한다 (docs/OPERATIONS.md)
#   GA_PROPERTY_ID   GA4 속성 번호(숫자만). 측정 ID(G-...)가 아니다
# 출력
#   data/hotsearch.json  {"asOf": ISO8601, "window": "24h", "rows": [{"name", "count", "sprite"}...]}
#
# 비어도 빌드를 세우지 않는다 — 시크릿이 없거나 GA 가 답을 안 주면 rows 를 비워 쓴다.
# 화면은 rows 가 비면 구역 자체를 그리지 않는다 (§1 의 '빈 값은 줄을 세우지 않는다' 와 같은 결).
#
# 미리보기(dev)는 예외다 — 표가 비면 **실제 순위표 상위로 샘플을 채운다**.
#   dev 에는 GA 조각이 없어 스스로는 한 건도 안 보내고, 운영이 보낸 것만 쌓인다.
#   그래서 새 화면을 dev 에서 볼 방법이 구조적으로 없다. 모양을 확인하려고 두는 길이다.
#   **이름은 지어내지 않는다** (§3) — 순위표에 실제로 있는 종을 그대로 쓰고, 횟수만 만든다.
#   sample: true 를 함께 실어 화면이 '미리보기 샘플' 딱지를 달게 한다. 운영 채널에서는 이 길로 가지 않는다.
import json
import os
import sys
from datetime import datetime, timedelta, timezone

TOP_N = 10
OUT_PATH = 'data/hotsearch.json'
# 문턱 — 많이 검색된 것만 순위에 오른다. 1회짜리가 1위로 서면 순위가 아니라 우연이다.
#   MIN_ROW_COUNT   한 줄이 순위에 오르려면 이만큼은 열려야 한다
#   MIN_ROWS        이보다 줄이 적으면 표를 통째로 비운다 — 홈은 구역을 안 그리고, 전체 보기는 '아직' 이라 적는다
#   MIN_COUNTRY     한 나라가 지도에 서려면 (문턱을 넘은 줄들의) 합이 이만큼은 돼야 한다
# GA4 도 지역 측정기준이 섞이면 방문자 적은 행을 제 임계값으로 숨긴다 — 그 위에 우리 문턱을 한 겹 더 두는 것이다
MIN_ROW_COUNT = 3
MIN_ROWS = 3
MIN_COUNTRY = 10
KST = timezone(timedelta(hours=9))
SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'


# 한글 이름 → 스프라이트 번호. 화면이 이름 옆에 그림을 세우려면 번호가 필요하다.
#
# **화면이 쓰는 이름표를 그대로 읽는다.** dex.json 의 names 는 기본 폼뿐이라
# '메가 보만다' · '거다이맥스 팬텀' 같은 폼 이름이 빠진다 — GA 에 쌓이는 말은 그쪽이다.
# 순위표 줄에는 name 과 sprite 가 나란히 있으니 그걸 훑는 편이 어긋날 일이 없다
# (backend/sprites.py 가 sprite 키를 모으는 것과 같은 방식이다).
NAME_SOURCES = ('data/dynamax_tier.json', 'data/dynamax.json', 'data/dynamax_tank.json',
                'data/pve_full.json', 'data/pve.json', 'data/pvp_all.json', 'data/pvp.json',
                'data/bosses.json', 'data/sheet.json', 'data/gameday.json', 'data/dex.json')


# JSON 을 재귀로 훑어 {name, sprite} 가 같이 있는 칸에서 짝을 모은다
def collect_names(value, table):
    if isinstance(value, list):
        for item in value:
            collect_names(item, table)
    elif isinstance(value, dict):
        name, sprite = value.get('name'), value.get('sprite')
        if isinstance(name, str) and name.strip() and isinstance(sprite, (int, str)):
            try:
                table.setdefault(name.strip(), int(sprite))
            except (TypeError, ValueError):
                pass
        for item in value.values():
            collect_names(item, table)


def sprite_by_name():
    table = {}
    for path in NAME_SOURCES:
        if not os.path.exists(path):
            continue
        try:
            collect_names(json.load(open(path, encoding='utf-8')), table)
        except (ValueError, OSError):
            continue
    # 기본 폼은 순위표에 없을 수도 있다(도감에만 있는 종) — 마지막에 깔아 둔다
    if os.path.exists('data/dex.json'):
        names = json.load(open('data/dex.json', encoding='utf-8')).get('names', {})
        for dex_no, name in names.items():
            try:
                table.setdefault(name, int(dex_no))
            except (TypeError, ValueError):
                continue
    return table


# GA4 Data API runReport — 어제부터 지금까지의 search_term 상위 N (국가별도 같은 창).
# '어제 하루'(1daysAgo..1daysAgo) 가 아니라 굴러가는 이틀인 이유: GA4 는 이벤트를 몇 시간 늦게 처리해서,
# 자정 집계가 '어제' 를 물으면 방금 끝난 날이라 거의 비어 온다. 창을 넓히면 그 구멍이 메워진다.
def fetch_rows(property_id, sa_info, by_country=False):
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    import requests

    creds = service_account.Credentials.from_service_account_info(sa_info, scopes=[SCOPE])
    creds.refresh(Request())
    body = {
        'dateRanges': [{'startDate': '1daysAgo', 'endDate': 'today'}],
        'dimensions': [{'name': 'searchTerm'}] + ([{'name': 'countryId'}] if by_country else []),
        'dimensionFilter': {'filter': {'fieldName': 'eventName', 'stringFilter': {'value': 'search', 'matchType': 'EXACT'}}},
        'metrics': [{'name': 'eventCount'}],
        'orderBys': [{'metric': {'metricName': 'eventCount'}, 'desc': True}],
        'limit': 100000 if by_country else TOP_N * 3,   # 넉넉히 받아 (not set) 같은 빈 행을 걸러도 N 이 남게
    }
    collected = []
    while True:
        body['offset'] = len(collected)
        response = requests.post(
            f'https://analyticsdata.googleapis.com/v1beta/properties/{property_id}:runReport',
            headers={'Authorization': f'Bearer {creds.token}'}, json=body, timeout=30)
        response.raise_for_status()
        report = response.json()
        batch = report.get('rows', [])
        collected.extend(batch)
        if not by_country or not batch or len(collected) >= int(report.get('rowCount', 0)):
            return collected


# 미리보기용 표 — 모양을 보려고 세우는 넷이다.
# 이름은 실제 데이터에 있는 종만 쓴다 (§3 — 지어내지 않는다). 횟수만 만든다.
SAMPLE_NAMES = ('거다이맥스 잠만보', '다이맥스 해피너스', '다이맥스 코뿌리', '다이맥스 몰드류', '거다이맥스 고릴타', '거다이맥스 인텔리레온', '거다이맥스 팬텀', '거다이맥스 에이스번', '거다이맥스 괴력몬', '거다이맥스 리자몽')
SAMPLE_COUNTS = (412, 318, 247, 191, 168, 145, 122, 98, 76, 54)


def sample_rows(sprites):
    return [{'name': name, 'count': count, 'sprite': sprites.get(name)}
            for name, count in zip(SAMPLE_NAMES, SAMPLE_COUNTS)]


def country_rows(rows, sprites):
    countries = {}
    for row in rows:
        dimensions = row.get('dimensionValues', [])
        if len(dimensions) < 2:
            continue
        name, code = (item.get('value', '').strip() for item in dimensions[:2])
        if not name or name.startswith('(') or len(code) != 2 or not code.isalpha():
            continue
        try:
            count = int(row['metricValues'][0]['value'])
        except (KeyError, IndexError, ValueError, TypeError):
            continue
        # 줄 문턱 — 한 나라 안에서도 1회짜리는 순위가 아니다
        if count < MIN_ROW_COUNT:
            continue
        group = countries.setdefault(code.upper(), {'code': code.upper(), 'total': 0, 'rows': []})
        group['total'] += count
        group['rows'].append({'name': name, 'count': count, 'sprite': sprites.get(name)})
    kept = []
    for group in countries.values():
        # 나라 문턱 — 합이 작거나 줄이 몇 없는 나라는 지도에 세우지 않는다
        if group['total'] < MIN_COUNTRY or len(group['rows']) < MIN_ROWS:
            continue
        group['rows'] = sorted(group['rows'], key=lambda item: item['count'], reverse=True)[:TOP_N]
        kept.append(group)
    return sorted(kept, key=lambda group: group['total'], reverse=True)


def main():
    os.makedirs('data', exist_ok=True)
    payload = {'asOf': datetime.now(KST).isoformat(timespec='seconds'), 'window': '24h', 'rows': [], 'countries': [], 'countriesStatus': 'unavailable'}
    is_dev = os.environ.get('BUILD_CHANNEL') == 'dev'

    # 표가 빈 채로 끝나는 자리가 셋이다(시크릿 없음 · 조회 실패 · GA 가 0건). 셋 다 여기를 지난다
    def finish(note):
        # 미리보기 표식 — 화면이 '이 브라우저에 센 것' 을 얹어도 되는 자리인지 이 값으로 안다.
        # 표가 GA 로 찼는지와 무관하게 dev 면 늘 붙는다
        if is_dev:
            payload['preview'] = True
        if is_dev and not payload['rows']:
            payload['rows'] = sample_rows(sprite_by_name())
            payload['sample'] = True
            note += f" → 미리보기 샘플 {len(payload['rows'])}건"
        json.dump(payload, open(OUT_PATH, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'hotsearch: {note}')

    property_id = (os.environ.get('GA_PROPERTY_ID') or '').strip()
    raw_key = (os.environ.get('GA_SA_JSON') or '').strip()
    if not property_id or not raw_key:
        finish('GA 시크릿이 없어 빈 표')
        return

    try:
        rows = fetch_rows(property_id, json.loads(raw_key))
    except Exception as error:                      # noqa: BLE001 — 집계 실패가 배포를 세우면 안 된다
        finish(f'GA 조회 실패 ({type(error).__name__})')
        return

    sprites = sprite_by_name()
    picked = []
    for row in rows:
        name = (row.get('dimensionValues') or [{}])[0].get('value', '').strip()
        # GA 가 값을 못 붙인 행은 '(not set)' 으로 온다 — 화면에 그대로 나가면 §1 위반이다
        if not name or name.startswith('('):
            continue
        try:
            count = int((row.get('metricValues') or [{}])[0].get('value', 0))
        except (TypeError, ValueError):
            continue
        if count < MIN_ROW_COUNT:
            continue
        picked.append({'name': name, 'count': count, 'sprite': sprites.get(name)})
        if len(picked) >= TOP_N:
            break
    # 줄이 몇 개 안 되면 순위라 부르기 어렵다 — 비운다 (미리보기는 finish 가 샘플로 채운다)
    if len(picked) < MIN_ROWS:
        picked = []

    # 나라별은 전체가 문턱을 넘었을 때만 묻는다 — 전체가 못 넘는데 나라가 넘을 리 없고, 호출 하나를 아낀다
    if picked:
        try:
            payload['countries'] = country_rows(fetch_rows(property_id, json.loads(raw_key), by_country=True), sprites)
            payload['countriesStatus'] = 'ready'
        except Exception as error:                  # noqa: BLE001 — 나라별이 죽어도 전체 순위는 나가야 한다
            print(f'hotsearch: 국가 집계 실패 ({type(error).__name__})', file=sys.stderr)

    payload['rows'] = picked
    finish(f'{len(picked)}건 (기준 {payload["asOf"]})')


if __name__ == '__main__':
    main()
