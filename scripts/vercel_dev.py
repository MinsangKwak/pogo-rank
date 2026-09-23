#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# scripts/vercel_dev.py — dev 채널의 Vercel 자리를 맞춘다 (v5 Phase 7, deploy-dev.yml 이 부른다)
#
#   python3 scripts/vercel_dev.py project   프로젝트가 있게 한다 → project_id 를 GITHUB_OUTPUT 에
#   python3 scripts/vercel_dev.py domain    dev.moncamp.kr 을 그 프로젝트에 붙이고 DNS 를 돌린다
#
# **여러 번 돌려도 같은 결과다.** 있으면 건너뛰고, 다르면 맞춘다. 매 배포마다 돈다 —
# 누가 대시보드에서 값을 바꿔도 다음 배포가 되돌린다. 대시보드 클릭 안내가 없는 메뉴를
# 가리켜 길을 잃은 일이 있었다. 설정은 코드에 두고 사람은 토큰만 넣는다.
#
# **운영과 다른 프로젝트다** (moncamp-dev). 한 프로젝트의 미리보기 배포에 도메인을 붙이면
# Vercel 이 로그인 벽을 친다 — 막히지 않는 것은 '운영 배포의 사용자 도메인' 뿐이다.
# 따로 두면 dev 가 그 프로젝트의 운영이라 벽이 없고, 운영과 설정이 섞이지도 않는다.
#
# 쓰는 값: VERCEL_TOKEN · VERCEL_ORG_ID · CLOUDFLARE_API_TOKEN(domain 에서만)
# ─────────────────────────────────────────────────────────────────────────────
import json
import os
import sys
import urllib.error
import urllib.request

PROJECT = 'moncamp-dev'
DOMAIN = 'dev.moncamp.kr'
ZONE = 'moncamp.kr'
# Vercel 이 사용자 도메인에 권하는 CNAME 목적지
VERCEL_CNAME = 'cname.vercel-dns.com'


def call(method, url, token, body=None):
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            return response.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            payload = json.loads(raw) if raw else {}
        except ValueError:
            payload = {'raw': raw.decode(errors='replace')[:300]}
        # 실패도 값으로 돌려준다 — 404 는 '없다' 는 답이라 부르는 쪽이 갈라 읽는다
        return error.code, payload


def vercel(method, path, body=None):
    team = os.environ['VERCEL_ORG_ID']
    sep = '&' if '?' in path else '?'
    return call(method, f'https://api.vercel.com{path}{sep}teamId={team}', os.environ['VERCEL_TOKEN'], body)


def cloudflare(method, path, body=None):
    status, payload = call(method, f'https://api.cloudflare.com/client/v4{path}', os.environ['CLOUDFLARE_API_TOKEN'], body)
    if not payload.get('success', status < 300):
        fail(f'Cloudflare {method} {path} → {status} {payload.get("errors")}')
    return payload.get('result')


def fail(message):
    print(f'::error::{message}')
    sys.exit(1)


def output(key, value):
    path = os.environ.get('GITHUB_OUTPUT')
    if path:
        with open(path, 'a', encoding='utf-8') as f:
            f.write(f'{key}={value}\n')


def ensure_project():
    status, project = vercel('GET', f'/v9/projects/{PROJECT}')
    if status == 404:
        status, project = vercel('POST', '/v11/projects', {
            'name': PROJECT, 'framework': 'nextjs', 'rootDirectory': 'web'})
        if status >= 300:
            fail(f'프로젝트를 못 만들었습니다: {status} {project.get("error")}')
        print(f'   만들었습니다: {PROJECT}')
    elif status >= 300:
        fail(f'프로젝트를 못 읽었습니다: {status} {project.get("error")}')
    else:
        print(f'   있음: {PROJECT}')

    # **로그인 벽을 끈다.** 이 프로젝트의 배포는 전부 이미 공개된 dev 화면과 같은 내용이다.
    # 켜 두면 배포 뒤 검사가 Vercel 로그인 화면을 훑고 '본문이 없다' 고 답한다 (실측, deploy-web)
    want = {'rootDirectory': 'web', 'framework': 'nextjs', 'ssoProtection': None}
    if any(project.get(key) != value for key, value in want.items()):
        status, patched = vercel('PATCH', f'/v9/projects/{project["id"]}', want)
        if status >= 300:
            fail(f'프로젝트 설정을 못 맞췄습니다: {status} {patched.get("error")}')
        print('   설정을 맞췄습니다 (web · nextjs · 로그인 벽 없음)')
    output('project_id', project['id'])


def ensure_domain():
    status, project = vercel('GET', f'/v9/projects/{PROJECT}')
    if status >= 300:
        fail('프로젝트가 없습니다 — project 를 먼저 돌립니다')
    pid = project['id']

    status, attached = vercel('GET', f'/v9/projects/{pid}/domains/{DOMAIN}')
    if status == 404:
        status, attached = vercel('POST', f'/v10/projects/{pid}/domains', {'name': DOMAIN})
        if status >= 300:
            fail(f'{DOMAIN} 을 못 붙였습니다: {status} {attached.get("error")}')
        print(f'   붙였습니다: {DOMAIN}')
    else:
        print(f'   붙어 있음: {DOMAIN}')

    zone = cloudflare('GET', f'/zones?name={ZONE}')
    if not zone:
        fail(f'Cloudflare 에서 {ZONE} 영역을 못 찾았습니다 — 토큰의 Zone 권한을 확인합니다')
    zid = zone[0]['id']

    # 소유 확인이 필요하다고 하면 TXT 를 먼저 심는다 (다른 계정이 moncamp.kr 을 쓴 적이 있을 때)
    for need in attached.get('verification') or []:
        if need.get('type') != 'TXT':
            continue
        name, value = need['domain'], need['value']
        have = cloudflare('GET', f'/zones/{zid}/dns_records?type=TXT&name={name}') or []
        if not any(one.get('content', '').strip('"') == value for one in have):
            cloudflare('POST', f'/zones/{zid}/dns_records', {'type': 'TXT', 'name': name, 'content': value, 'ttl': 1})
            print(f'   소유 확인 TXT 를 심었습니다: {name}')

    # dev 를 Vercel 로 돌린다. **프록시(주황 구름)는 끈다** — 켜면 Vercel 이 인증서를 못 받는다
    records = cloudflare('GET', f'/zones/{zid}/dns_records?name={DOMAIN}') or []
    target = {'type': 'CNAME', 'name': DOMAIN, 'content': VERCEL_CNAME, 'ttl': 1, 'proxied': False}
    same = [one for one in records if one['type'] == 'CNAME' and one['content'] == VERCEL_CNAME and not one['proxied']]
    if same:
        print(f'   DNS 이미 맞음: {DOMAIN} → {VERCEL_CNAME}')
    else:
        for one in records:
            # 같은 이름에 A·AAAA·CNAME 이 섞여 있으면 CNAME 을 못 만든다 — 옛 기록을 걷는다
            if one['type'] in ('A', 'AAAA', 'CNAME'):
                cloudflare('DELETE', f'/zones/{zid}/dns_records/{one["id"]}')
                print(f'   옛 기록을 걷었습니다: {one["type"]} {one["content"]}')
        cloudflare('POST', f'/zones/{zid}/dns_records', target)
        print(f'   DNS 를 돌렸습니다: {DOMAIN} → {VERCEL_CNAME} (프록시 끔)')

    status, checked = vercel('POST', f'/v9/projects/{pid}/domains/{DOMAIN}/verify')
    print(f'   Vercel 확인: {"됨" if checked.get("verified") else "대기 — DNS 가 퍼지면 저절로 된다"}')


if __name__ == '__main__':
    step = sys.argv[1] if len(sys.argv) > 1 else ''
    if step == 'project':
        ensure_project()
    elif step == 'domain':
        ensure_domain()
    else:
        fail('쓰는 법: vercel_dev.py project|domain')
