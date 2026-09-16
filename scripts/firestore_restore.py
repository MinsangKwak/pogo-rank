#!/usr/bin/env python3
# 2026-09-16 v3.47.0 Firestore 백업 되돌리기 — firestore_backup.py 가 만든 JSON 을 그대로 다시 쓴다.
#
# 기본은 **미리보기**다. 무엇을 몇 건 쓸지만 보여 주고 아무것도 바꾸지 않는다. 실제로 쓰려면 --apply.
#   python3 scripts/firestore_restore.py firestore-backup.json                    # 미리보기
#   python3 scripts/firestore_restore.py firestore-backup.json --apply            # 네 컬렉션 전부
#   python3 scripts/firestore_restore.py firestore-backup.json --only users --apply
#   python3 scripts/firestore_restore.py firestore-backup.json --only users --id <uid> --apply   # 문서 하나
#
# 쓰기는 문서 단위 PATCH 라 **백업에 있는 문서만** 덮어쓴다 — 백업 뒤에 생긴 문서는 건드리지 않는다.
# 서비스 계정 역할은 "Cloud Datastore 사용자" 가 필요하다 (백업용 뷰어로는 쓰지 못한다).
import argparse
import json
import os
import sys

import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

SCOPE = 'https://www.googleapis.com/auth/datastore'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('backup')
    ap.add_argument('--apply', action='store_true', help='실제로 쓴다 (없으면 미리보기)')
    ap.add_argument('--only', action='append', default=[], help='이 컬렉션만 (여러 번 가능)')
    ap.add_argument('--id', action='append', default=[], help='이 문서 id 만 (여러 번 가능)')
    args = ap.parse_args()
    backup = json.load(open(args.backup, encoding='utf-8'))
    project = os.environ.get('FIRESTORE_PROJECT', '').strip() or backup['project']
    plan = []
    for name, docs in backup['collections'].items():
        if args.only and name not in args.only:
            continue
        for doc in docs:
            if args.id and doc['id'] not in args.id:
                continue
            plan.append((name, doc))
    print(f"백업 시각 {backup['exportedAt']} · 프로젝트 {project} · 쓸 문서 {len(plan)}건")
    for name, doc in plan:
        print(f"  {name}/{doc['id']}  ({len(doc['fields'])} 필드, 백업 당시 갱신 {doc['updateTime'][:19]})")
    if not args.apply:
        print('미리보기만 했습니다 — 실제로 쓰려면 --apply')
        return
    raw = os.environ.get('FIREBASE_SA_JSON', '').strip()
    if not raw:
        sys.exit('FIREBASE_SA_JSON 이 비어 있습니다')
    creds = service_account.Credentials.from_service_account_info(json.loads(raw), scopes=[SCOPE])
    creds.refresh(Request())
    session = requests.Session()
    session.headers['Authorization'] = f'Bearer {creds.token}'
    base = f'https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents'
    for name, doc in plan:
        # updateMask 없이 PATCH — 문서 전체를 백업 당시 모습으로 되돌린다 (백업 뒤 추가된 필드도 사라진다)
        res = session.patch(f"{base}/{name}/{doc['id']}", json={'fields': doc['fields']}, timeout=60)
        res.raise_for_status()
        print(f"  wrote {name}/{doc['id']}")
    print('done')


if __name__ == '__main__':
    main()
