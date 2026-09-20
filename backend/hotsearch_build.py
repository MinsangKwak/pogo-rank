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


# GA4 Data API runReport — 최근 24시간의 search_term 상위 N.
# '오늘'(자정부터)이 아니라 24시간 창인 이유: GA4 는 이벤트를 몇 시간 늦게 처리해서,
# 낮 12시에 '오늘' 을 물으면 오전분이 덜 찬 표가 나온다. 창을 넓히면 그 구멍이 메워진다.
def fetch_rows(property_id, sa_info):
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    import requests

    creds = service_account.Credentials.from_service_account_info(sa_info, scopes=[SCOPE])
    creds.refresh(Request())
    body = {
        'dateRanges': [{'startDate': '1daysAgo', 'endDate': 'today'}],
        'dimensions': [{'name': 'searchTerm'}],
        'metrics': [{'name': 'eventCount'}],
        'orderBys': [{'metric': {'metricName': 'eventCount'}, 'desc': True}],
        'limit': TOP_N * 3,   # 넉넉히 받아 (not set) 같은 빈 행을 걸러도 N 이 남게
    }
    response = requests.post(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{property_id}:runReport',
        headers={'Authorization': f'Bearer {creds.token}'}, json=body, timeout=30)
    response.raise_for_status()
    return response.json().get('rows', [])


# 미리보기용 표 — 실제 순위표 상위 열 종의 이름을 그대로 쓰고 횟수만 만든다.
# 순서를 흩지 않고 위에서부터 쓰는 이유: 어느 줄이 1위인지 눈으로 견줄 수 있어야 막대가 읽힌다.
SAMPLE_SOURCES = ('data/dynamax_tier.json', 'data/pve.json', 'data/pvp.json')


# 표 하나에서 상위 이름만 읽는다 (표마다 묶음 이름이 overall · little 로 갈려 먼저 나오는 목록을 쓴다)
def top_names(path, limit):
    if not os.path.exists(path):
        return []
    try:
        table = json.load(open(path, encoding='utf-8'))
    except (ValueError, OSError):
        return []
    for group in (table.values() if isinstance(table, dict) else [table]):
        if isinstance(group, list) and group:
            return [row['name'].strip() for row in group[:limit]
                    if isinstance(row, dict) and isinstance(row.get('name'), str) and row['name'].strip()]
    return []


def sample_rows(sprites):
    # 세 표를 번갈아 뽑는다 — 한 표에서만 채우면 열 줄이 전부 거다이맥스라 실제 검색처럼 안 보인다
    lanes = [top_names(path, TOP_N) for path in SAMPLE_SOURCES]
    picked, seen = [], set()
    for index in range(TOP_N):
        for lane in lanes:
            if index >= len(lane) or lane[index] in seen:
                continue
            seen.add(lane[index])
            picked.append(lane[index])
            if len(picked) >= TOP_N:
                break
        if len(picked) >= TOP_N:
            break
    # 1위 412 에서 한 줄에 약 8% 씩 줄인다 — 막대가 눈에 띄게 층지도록
    return [{'name': name, 'count': round(412 * (0.92 ** index)), 'sprite': sprites.get(name)}
            for index, name in enumerate(picked)]


def main():
    os.makedirs('data', exist_ok=True)
    payload = {'asOf': datetime.now(KST).isoformat(timespec='seconds'), 'window': '24h', 'rows': []}
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
        if count <= 0:
            continue
        picked.append({'name': name, 'count': count, 'sprite': sprites.get(name)})
        if len(picked) >= TOP_N:
            break

    payload['rows'] = picked
    finish(f'{len(picked)}건 (기준 {payload["asOf"]})')


if __name__ == '__main__':
    main()
