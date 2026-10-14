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
# 쓰는 값: CLOUDFLARE_API_TOKEN(Account · Cloudflare Pages · Edit + Zone · DNS · Edit) ·
#          되돌릴 때만 VERCEL_TOKEN · VERCEL_ORG_ID (Vercel 이 권하는 A · CNAME 을 읽는다, 없으면 문서 기본값)
# ─────────────────────────────────────────────────────────────────────────────
import os
import sys

from vercel_dev import cloudflare, fail
from vercel_prod import APEX, VERCEL_CNAME, VERCEL_IP, WWW, recommended, replace, show, zone_id

PROJECT = os.environ.get('PAGES_PROJECT', 'moncamp')


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
    print('── 바뀐 DNS ──')
    show(zid)
    for name, one in domains(acc).items():
        print(f'   Pages 도메인 {name}: {one["status"]}')


if __name__ == '__main__':
    main()
