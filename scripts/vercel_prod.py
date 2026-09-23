#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# scripts/vercel_prod.py — moncamp.kr 을 Vercel 로 넘기고, 되돌린다 (v5 운영 전환)
#
#   python3 scripts/vercel_prod.py status     지금 DNS 와 Vercel 도메인 상태만 읽는다 (아무것도 안 바꾼다)
#   python3 scripts/vercel_prod.py attach     moncamp.kr · www 를 운영 프로젝트에 붙이고 DNS 를 돌린다
#   python3 scripts/vercel_prod.py rollback   DNS 를 GitHub Pages 로 되돌린다 (옛 v4 가 그대로 선다)
#
# **바꾸기 전에 옛 레코드를 먼저 찍는다.** 되돌릴 때 무엇으로 돌아가는지가 로그에 남아야
# "원래 뭐였지" 를 기억에 기대지 않는다.
#
# **프록시(주황 구름)를 끈다** — dev 와 같다(vercel_dev.py). 켜 두면 Vercel 이 인증서를 못 받고,
# Vercel 도 앞에 다른 CDN 을 두지 말라고 권한다. 그러면 Cloudflare 가 붙이던 보안 헤더가 빠지므로
# 헤더는 앱이 직접 붙인다 (web/next.config.ts).
#
# **넘기는 몇 분 동안 인증서가 없을 수 있다.** Vercel 은 DNS 가 자기를 가리킨 뒤에야 인증서를 받는다.
# 그 사이 들어온 사람은 인증서 경고를 볼 수 있다 — 짧고, 되돌릴 수 있는 틈이라 받아들인다.
#
# 쓰는 값: VERCEL_TOKEN · VERCEL_ORG_ID · VERCEL_PROJECT_ID(운영 프로젝트) · CLOUDFLARE_API_TOKEN
# ─────────────────────────────────────────────────────────────────────────────
import os
import sys

# 호출 · 실패 처리는 dev 스크립트와 한 벌이다 — 토큰 정리 규칙이 두 벌이면 한쪽만 고쳐진다
from vercel_dev import cloudflare, fail, vercel

ZONE = 'moncamp.kr'
APEX = 'moncamp.kr'
WWW = 'www.moncamp.kr'
# Vercel 이 문서에 적어 둔 기본값 — 도메인 설정 API 가 권하는 값을 못 읽을 때만 쓴다
VERCEL_IP = '76.76.21.21'
VERCEL_CNAME = 'cname.vercel-dns.com'

# 되돌릴 자리 — GitHub Pages 가 문서에 적은 주소 (docs.github.com, apex 도메인 설정).
# 전환 전 레코드는 status 로 찍어 이것과 같은지 먼저 본다
PAGES_A = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153']
# 2026-09-23 status 실측: 전환 전에는 A 넷뿐이었다(AAAA 없음). 되돌릴 때도 **그 모양 그대로** 둔다
PAGES_AAAA: list[str] = []
PAGES_WWW = 'minsangkwak.github.io'


def zone_id():
    zone = cloudflare('GET', f'/zones?name={ZONE}')
    if not zone:
        fail(f'Cloudflare 에서 {ZONE} 영역을 못 찾았습니다 — 토큰의 Zone 권한을 확인합니다')
    return zone[0]['id']


def records(zid, name):
    return [one for one in (cloudflare('GET', f'/zones/{zid}/dns_records?name={name}') or [])
            if one['type'] in ('A', 'AAAA', 'CNAME')]


def show(zid):
    for name in (APEX, WWW):
        found = records(zid, name)
        if not found:
            print(f'   {name}: (레코드 없음)')
        for one in found:
            print(f'   {name}: {one["type"]} {one["content"]} · 프록시 {"켬" if one["proxied"] else "끔"}')


def replace(zid, name, wanted):
    """name 의 A·AAAA·CNAME 을 걷고 wanted 로 새로 심는다. 같으면 건드리지 않는다"""
    now = records(zid, name)
    key = lambda one: (one['type'], one['content'], bool(one['proxied']))
    if sorted(map(key, now)) == sorted(key(one) for one in wanted):
        print(f'   {name}: 이미 맞음')
        return
    for one in now:
        cloudflare('DELETE', f'/zones/{zid}/dns_records/{one["id"]}')
    for one in wanted:
        cloudflare('POST', f'/zones/{zid}/dns_records', {'name': name, 'ttl': 1, **one})
    print(f'   {name}: ' + ' · '.join(f'{one["type"]} {one["content"]}' for one in wanted))


def project_id():
    pid = os.environ.get('VERCEL_PROJECT_ID', '')
    if not pid:
        fail('VERCEL_PROJECT_ID 가 없습니다 — 운영 프로젝트(pogo-rank)의 id 입니다')
    return pid


def recommended():
    """Vercel 이 이 도메인에 권하는 A · CNAME 값. 못 읽으면 문서의 기본값"""
    status, config = vercel('GET', f'/v6/domains/{APEX}/config')
    ip, cname = VERCEL_IP, VERCEL_CNAME
    if status < 300:
        for pick in sorted(config.get('recommendedIPv4') or [], key=lambda one: one.get('rank', 99)):
            values = pick.get('value') or []
            if values:
                ip = values[0]
                break
        for pick in sorted(config.get('recommendedCNAME') or [], key=lambda one: one.get('rank', 99)):
            if pick.get('value'):
                cname = pick['value'].rstrip('.')
                break
    return ip, cname


def attach_domain(pid, name, body):
    status, found = vercel('GET', f'/v9/projects/{pid}/domains/{name}')
    if status == 404:
        status, found = vercel('POST', f'/v10/projects/{pid}/domains', {'name': name, **body})
        if status >= 300:
            fail(f'{name} 을 못 붙였습니다: {status} {found.get("error")}')
        print(f'   붙였습니다: {name}')
    elif status >= 300:
        fail(f'{name} 을 못 읽었습니다: {status} {found.get("error")}')
    else:
        print(f'   붙어 있음: {name}')
    return found


def main():
    step = sys.argv[1] if len(sys.argv) > 1 else ''
    if step not in ('status', 'attach', 'rollback'):
        fail('쓰는 법: vercel_prod.py status|attach|rollback')
    zid = zone_id()

    print('── 지금 DNS ──')
    show(zid)
    if step == 'status':
        return

    if step == 'rollback':
        print('── GitHub Pages 로 되돌린다 ──')
        # 전환 전과 같이 프록시를 켠다 — Cloudflare 의 헤더·캐시·rate limit 이 다시 앞에 선다
        replace(zid, APEX, [{'type': 'A', 'content': ip, 'proxied': True} for ip in PAGES_A]
                + [{'type': 'AAAA', 'content': ip, 'proxied': True} for ip in PAGES_AAAA])
        replace(zid, WWW, [{'type': 'CNAME', 'content': PAGES_WWW, 'proxied': True}])
        print('── 바뀐 DNS ──')
        show(zid)
        return

    pid = project_id()
    print('── Vercel 에 붙인다 ──')
    apex = attach_domain(pid, APEX, {})
    # www 는 apex 로 308 — 주소가 둘이면 검색엔진이 같은 글을 두 번 센다
    attach_domain(pid, WWW, {'redirect': APEX, 'redirectStatusCode': 308})

    # 소유 확인이 필요하다고 하면 TXT 를 먼저 심는다 (vercel_dev.py 와 같은 자리)
    for need in apex.get('verification') or []:
        if need.get('type') != 'TXT':
            continue
        have = cloudflare('GET', f'/zones/{zid}/dns_records?type=TXT&name={need["domain"]}') or []
        if not any(one.get('content', '').strip('"') == need['value'] for one in have):
            cloudflare('POST', f'/zones/{zid}/dns_records',
                       {'type': 'TXT', 'name': need['domain'], 'content': need['value'], 'ttl': 1})
            print(f'   소유 확인 TXT 를 심었습니다: {need["domain"]}')

    ip, cname = recommended()
    print(f'── DNS 를 돌린다 (A {ip} · CNAME {cname} · 프록시 끔) ──')
    replace(zid, APEX, [{'type': 'A', 'content': ip, 'proxied': False}])
    replace(zid, WWW, [{'type': 'CNAME', 'content': cname, 'proxied': False}])

    for name in (APEX, WWW):
        _, checked = vercel('POST', f'/v9/projects/{pid}/domains/{name}/verify')
        print(f'   Vercel 확인 {name}: {"됨" if checked.get("verified") else "대기 — DNS 가 퍼지면 저절로 된다"}')
    print('── 바뀐 DNS ──')
    show(zid)


if __name__ == '__main__':
    main()
