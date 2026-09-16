#!/usr/bin/env python3
# 2026-09-16 v3.47.0 Firestore 사용자 데이터 백업 — allowlist · requests · users · trainers 네 컬렉션을 통째로 받는다.
#
# 왜 필요한가
#   게임 데이터(티어표·도감)는 매일 원본에서 다시 만들지만, 사용자 데이터(가입 승인 목록 · 내 포켓몬 · 트레이너 코드)는
#   Firestore 한 곳에만 있다. Spark 요금제에는 자동 백업이 없어 문서를 잘못 지우면 그것으로 끝이다.
#
# 어떻게
#   REST API(firestore.googleapis.com/v1) 로 컬렉션을 페이지 단위로 나열해 **Firestore 원형(fields)** 그대로 저장한다.
#   값을 파이썬 형으로 풀지 않는 이유 — 되돌릴 때 같은 API 에 그대로 PATCH 하면 형(정수·시각·중첩 맵)이 하나도 안 바뀐다.
#   결과 파일에는 이메일·트레이너 코드가 있다 — 워크플로가 곧바로 암호화하고 평문은 남기지 않는다.
#
# 입력(환경 변수)
#   FIREBASE_SA_JSON   서비스 계정 키 JSON 한 줄. 역할은 "Cloud Datastore 뷰어" 면 충분하다 (docs/OPERATIONS.md 14장)
#   FIRESTORE_PROJECT  프로젝트 ID. 비우면 키 JSON 의 project_id 를 쓴다
# 출력
#   인자로 받은 경로(기본 firestore-backup.json)에 {exportedAt, project, collections: {이름: [{id, fields, updateTime}]}}
import json
import os
import sys
from datetime import datetime, timezone

import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

COLLECTIONS = ('allowlist', 'requests', 'users', 'trainers')
SCOPE = 'https://www.googleapis.com/auth/datastore'
PAGE_SIZE = 300


def access_token(sa_info):
    creds = service_account.Credentials.from_service_account_info(sa_info, scopes=[SCOPE])
    creds.refresh(Request())
    return creds.token


def list_collection(session, base, name):
    docs, token = [], ''
    while True:
        params = {'pageSize': PAGE_SIZE}
        if token:
            params['pageToken'] = token
        res = session.get(f'{base}/{name}', params=params, timeout=60)
        res.raise_for_status()
        body = res.json()
        for doc in body.get('documents', []):
            docs.append({
                'id': doc['name'].rsplit('/', 1)[1],
                'fields': doc.get('fields', {}),
                'updateTime': doc.get('updateTime', ''),
            })
        token = body.get('nextPageToken', '')
        if not token:
            return docs


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else 'firestore-backup.json'
    raw = os.environ.get('FIREBASE_SA_JSON', '').strip()
    if not raw:
        sys.exit('FIREBASE_SA_JSON 이 비어 있습니다 — docs/OPERATIONS.md 14장')
    sa_info = json.loads(raw)
    project = os.environ.get('FIRESTORE_PROJECT', '').strip() or sa_info.get('project_id', '')
    if not project:
        sys.exit('프로젝트 ID 를 알 수 없습니다 (FIRESTORE_PROJECT 또는 키 JSON 의 project_id)')
    session = requests.Session()
    session.headers['Authorization'] = f'Bearer {access_token(sa_info)}'
    base = f'https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents'
    backup = {
        'exportedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'project': project,
        'collections': {},
    }
    for name in COLLECTIONS:
        backup['collections'][name] = list_collection(session, base, name)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(backup, f, ensure_ascii=False)
    # 로그에는 개수만 — 내용(이메일·코드)은 절대 찍지 않는다
    counts = ' · '.join(f'{name} {len(docs)}' for name, docs in backup['collections'].items())
    print(f'backup ok: {counts} → {out_path} ({os.path.getsize(out_path):,} bytes)')
    # 전부 0 이면 권한이나 프로젝트가 틀린 것이다 — 빈 백업을 성공으로 남기지 않는다
    if sum(len(docs) for docs in backup['collections'].values()) == 0:
        sys.exit('문서가 하나도 없습니다 — 서비스 계정 권한(Cloud Datastore 뷰어)과 프로젝트 ID 를 확인하세요')


if __name__ == '__main__':
    main()
