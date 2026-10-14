#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# scripts/pages_prod.py — moncamp.kr 을 Cloudflare Pages 로 넘기고, 되돌린다 (2026-10-15)
#
#   python3 scripts/pages_prod.py status     지금 DNS 와 Pages 프로젝트 · 도메인 상태만 읽는다 (아무것도 안 바꾼다)
#   python3 scripts/pages_prod.py attach     moncamp.kr · www 를 Pages 프로젝트에 붙이고 DNS 를 Pages 로 돌린다
#   python3 scripts/pages_prod.py rollback   DNS 를 Vercel 로 되돌린다 (Vercel 의 운영 판이 그대로 선다)
#
# **왜 옮기나.** Vercel Hobby 는 광고를 금지한다(Fair Use Guidelines · docs/INFRA.md §8). Cloudflare Pages 는 무료로
# 상업적 사용이 되고, moncamp.kr 의 DNS 가 이미 Cloudflare 에 있어 같은 계정 안에서 붙는다.
#
# **바꾸기 전에 옛 레코드를 먼저 찍는다** — vercel_prod.py 와 같은 규칙. 되돌릴 자리가 로그에 남는다.
# **프록시(주황 구름)를 켠다** — Pages 는 Cloudflare 안이라 Vercel 때와 달리 켜야 인증서 · 캐시가 바로 붙는다.
#
# **www 는 apex 로 308** — Vercel 때(vercel_prod.py 의 redirectStatusCode 308)와 같다. 주소가 둘이면 검색엔진이 같은 글을 두 번 센다.
# Pages 의 _redirects 는 주소의 경로만 보고 호스트는 못 본다 — 영역의 Single Redirect 규칙(엣지에서 도는 것)으로 건다 (Codex, PR #368)
#
# 쓰는 값: CLOUDFLARE_API_TOKEN(Account · Cloudflare Pages · Edit + Zone · DNS · Edit + Zone · Single Redirect · Edit) ·
#          되돌릴 때만 VERCEL_TOKEN · VERCEL_ORG_ID (Vercel 이 권하는 A · CNAME 을 읽는다, 없으면 문서 기본값)
# ─────────────────────────────────────────────────────────────────────────────
import os
import re
import sys

from vercel_dev import call, cloudflare, fail
from vercel_prod import APEX, VERCEL_CNAME, VERCEL_IP, WWW, recommended, replace, show, zone_id

PROJECT = os.environ.get('PAGES_PROJECT', 'moncamp')

# www → apex 규칙. ref 로 우리 규칙만 찾아 바꾼다 — 같은 단계(phase)에 다른 규칙이 있어도 건드리지 않는다
WWW_RULE_REF = 'moncamp_www_to_apex'
WWW_RULE = {
    'ref': WWW_RULE_REF,
    'description': 'www.moncamp.kr → moncamp.kr (308, scripts/pages_prod.py)',
    'expression': f'(http.host eq "{WWW}")',
    'action': 'redirect',
    'action_parameters': {'from_value': {
        'status_code': 308,
        'target_url': {'expression': f'concat("https://{APEX}", http.request.uri.path)'},
        'preserve_query_string': True,
    }},
}
REDIRECT_PHASE = 'http_request_dynamic_redirect'


def account_id():
    accounts = cloudflare('GET', '/accounts') or []
    if not accounts:
        fail('토큰이 보는 Cloudflare 계정이 없습니다 — 토큰의 Account 권한을 확인합니다')
    # 계정이 여럿이면 첫 계정 — deploy-server.yml 의 wrangler 와 같은 규칙
    return accounts[0]['id']


def project(acc):
    found = cloudflare('GET', f'/accounts/{acc}/pages/projects/{PROJECT}')
    if not found:
        fail(f'Pages 프로젝트 {PROJECT} 가 없습니다 — deploy-pages.yml 을 먼저 돌려 만든다')
    return found


def domains(acc):
    return {one['name']: one for one in (cloudflare('GET', f'/accounts/{acc}/pages/projects/{PROJECT}/domains') or [])}


def token():
    # vercel_dev.cloudflare 와 같은 정리 — 공백을 떼고 토큰만 고른다
    raw = ''.join(os.environ['CLOUDFLARE_API_TOKEN'].split())
    found = re.search(r'cfut_[A-Za-z0-9_-]+', raw)
    return found.group(0) if found else raw


def redirect_rules(zid):
    """영역의 리다이렉트 단계 규칙. 단계가 아직 없으면(404) 빈 목록 — cloudflare() 는 404 를 실패로 세우므로 직접 부른다"""
    status, payload = call('GET', f'https://api.cloudflare.com/client/v4/zones/{zid}/rulesets/phases/{REDIRECT_PHASE}/entrypoint', token())
    if status == 404:
        return []
    if status >= 300 or not payload.get('success'):
        fail(f'리다이렉트 규칙을 못 읽었습니다: {status} {payload.get("errors")} — 토큰에 Zone · Single Redirect · Edit 가 있는지 봅니다')
    return payload['result'].get('rules') or []


def put_rules(zid, rules):
    keep = [{key: value for key, value in rule.items() if key in ('ref', 'description', 'expression', 'action', 'action_parameters', 'enabled')}
            for rule in rules]
    cloudflare('PUT', f'/zones/{zid}/rulesets/phases/{REDIRECT_PHASE}/entrypoint', {'rules': keep})


def set_www_redirect(zid, on):
    rules = redirect_rules(zid)
    others = [rule for rule in rules if rule.get('ref') != WWW_RULE_REF]
    had = len(others) != len(rules)
    if on and not had:
        put_rules(zid, others + [WWW_RULE])
        print(f'   {WWW} → {APEX} 308 규칙을 걸었습니다')
    elif not on and had:
        put_rules(zid, others)
        print(f'   {WWW} → {APEX} 규칙을 걷었습니다 (Vercel 이 www 를 다시 옮긴다)')
    else:
        print(f'   {WWW} 규칙: 이미 {"있음" if on else "없음"}')


ZONE_PHASES = [
    ('http_ratelimit', 'rate limit'),
    ('http_request_cache_settings', '캐시 규칙'),
    ('http_response_headers_transform', '응답 헤더 규칙'),
]
# 켜져 있으면 앱이 깨지는 설정 (docs/INFRA.md §8 의 6번) — 프록시를 켜는 순간 moncamp.kr 에도 걸린다
ZONE_OFF = ('rocket_loader', 'email_obfuscation')


def zone_report(zid):
    """**프록시를 켜면 영역 규칙이 moncamp.kr 에 새로 걸린다.** Vercel 때는 프록시가 꺼져 하나도 안 걸렸다.
    GitHub Pages 시절 규칙(rate limit burst-guard · 캐시 규칙 · 헤더 Transform Rule)이 그대로 살아나므로 바꾸기 전에 찍는다.
    읽기만 한다 — 토큰에 읽기 권한이 없으면 '못 읽음' 으로 적고 넘어간다(전환을 세울 일은 아니다)"""
    base = f'https://api.cloudflare.com/client/v4/zones/{zid}'
    for phase, label in ZONE_PHASES:
        status, payload = call('GET', f'{base}/rulesets/phases/{phase}/entrypoint', token())
        if status == 404:
            print(f'   {label}: 없음')
            continue
        if status >= 300 or not payload.get('success'):
            print(f'   {label}: 못 읽음 ({status} — 토큰에 읽기 권한이 없으면 대시보드에서 봅니다)')
            continue
        rules = payload['result'].get('rules') or []
        print(f'   {label}: {len(rules)}개')
        for rule in rules:
            limit = rule.get('ratelimit') or {}
            extra = (f' · {limit.get("period")}초에 {limit.get("requests_per_period")}건 넘으면 {limit.get("mitigation_timeout")}초 {rule.get("action")}'
                     if limit else f' · {rule.get("action")}')
            print(f'     - [{"켬" if rule.get("enabled", True) else "끔"}] {rule.get("description") or rule.get("ref") or "(이름 없음)"}{extra}')
            print(f'       조건: {str(rule.get("expression", ""))[:200]}')
    for name in ZONE_OFF:
        status, payload = call('GET', f'{base}/settings/{name}', token())
        value = (payload.get('result') or {}).get('value') if status < 300 else None
        if value is None:
            print(f'   {name}: 못 읽음 ({status})')
        elif value == 'off':
            print(f'   {name}: 끔')
        else:
            print(f'::warning::{name} 가 {value} 입니다 — 프록시를 켜면 앱이 깨질 수 있습니다(docs/INFRA.md §8 의 6번). 대시보드에서 끕니다')


def main():
    step = sys.argv[1] if len(sys.argv) > 1 else ''
    if step not in ('status', 'attach', 'rollback'):
        fail('쓰는 법: pages_prod.py status|attach|rollback')
    zid = zone_id()

    print('── 지금 DNS ──')
    show(zid)

    if step == 'rollback':
        ip, cname = VERCEL_IP, VERCEL_CNAME
        if os.environ.get('VERCEL_TOKEN') and os.environ.get('VERCEL_ORG_ID'):
            ip, cname = recommended()
        print(f'── Vercel 로 되돌린다 (A {ip} · CNAME {cname} · 프록시 끔 — 전환 전과 같은 모양) ──')
        replace(zid, APEX, [{'type': 'A', 'content': ip, 'proxied': False}])
        replace(zid, WWW, [{'type': 'CNAME', 'content': cname, 'proxied': False}])
        # 프록시를 끄면 규칙도 안 걸리지만, 남겨 두면 다음에 누가 켰을 때 엉뚱하게 돈다 — 걷는다
        set_www_redirect(zid, False)
        print('── 바뀐 DNS ──')
        show(zid)
        return

    acc = account_id()
    info = project(acc)
    target = info.get('subdomain') or f'{PROJECT}.pages.dev'
    print(f'── Pages 프로젝트 {PROJECT} · {target} · 운영 가지 {info.get("production_branch")} ──')
    have = domains(acc)
    for name in (APEX, WWW):
        one = have.get(name)
        print(f'   {name}: {one["status"] if one else "(안 붙음)"}')
    rules = [rule.get('ref') for rule in redirect_rules(zid)]
    print(f'   www → apex 규칙: {"있음" if WWW_RULE_REF in rules else "없음"}')
    print('── 프록시를 켜면 moncamp.kr 에 걸릴 영역 규칙 ──')
    zone_report(zid)
    if step == 'status':
        return

    print('── Pages 에 도메인을 붙인다 ──')
    for name in (APEX, WWW):
        if name not in have:
            cloudflare('POST', f'/accounts/{acc}/pages/projects/{PROJECT}/domains', {'name': name})
            print(f'   붙였습니다: {name}')
    print(f'── DNS 를 돌린다 (CNAME {target} · 프록시 켬) ──')
    # apex 의 CNAME 은 Cloudflare 가 펴서(flattening) 답한다 — 같은 계정의 Pages 라 그대로 된다
    replace(zid, APEX, [{'type': 'CNAME', 'content': target, 'proxied': True}])
    replace(zid, WWW, [{'type': 'CNAME', 'content': target, 'proxied': True}])
    print('── www 는 apex 로 ──')
    set_www_redirect(zid, True)
    print('── 바뀐 DNS ──')
    show(zid)
    for name, one in domains(acc).items():
        print(f'   Pages 도메인 {name}: {one["status"]}')


if __name__ == '__main__':
    main()
