#!/usr/bin/env node
'use strict';
// scripts/check_commit_msg.mjs — 커밋 제목 한 줄이 규칙(docs/COMMITS.md)에 맞는지 본다.
//
// 두 가지로 부른다: 메시지 파일 하나(commit-msg 훅) · 커밋 범위(--range, PR 검사).
// 병합 커밋(Merge …)과 되돌림(Revert "…")은 git 이 제목을 정하므로 건너뛴다. 본문은 보지 않는다 — 규칙은 제목에만 있다
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const TYPES = ['feat', 'fix', 'style', 'refactor', 'docs', 'test', 'data', 'ci', 'release', 'sync', 'chore'];
const SCOPES = ['web', 'server', 'content', 'docs', 'infra'];
const MAX = 72;
const HEAD_RE = new RegExp(`^(${TYPES.join('|')})(?:\\(([a-z0-9-]+)\\))?: (.+)$`);

/** 제목 한 줄을 본다. 문제가 없으면 빈 배열 */
export function checkSubject(subject) {
  const line = subject.trimEnd();
  if (/^(Merge |Revert ")/.test(line)) return [];
  const problems = [];
  const hit = HEAD_RE.exec(line);
  if (!hit) {
    problems.push(`'종류(범위): 제목' 꼴이 아닙니다 — 종류는 ${TYPES.join(' · ')}`);
    return problems;
  }
  const [, , scope, title] = hit;
  if (scope && !SCOPES.includes(scope)) problems.push(`범위 '${scope}' 는 없습니다 — ${SCOPES.join(' · ')} 중 하나이거나 비웁니다`);
  if (line.length > MAX) problems.push(`제목이 ${line.length}자 — ${MAX}자 안으로`);
  if (/[.。]$/.test(title)) problems.push('제목 끝에 마침표를 두지 않습니다');
  if (!title.trim()) problems.push('제목이 비었습니다');
  return problems;
}

function report(label, subject, problems) {
  if (!problems.length) return true;
  console.error(`✗ ${label}: ${subject}`);
  for (const one of problems) console.error(`  - ${one}`);
  return false;
}

function main(argv) {
  if (argv[0] === '--range') {
    const range = argv[1];
    if (!range) { console.error('사용: check_commit_msg.mjs --range <from>..<to>'); return 2; }
    // 병합 커밋은 --no-merges 로 빼고, 제목만 한 줄씩 받는다
    const out = execFileSync('git', ['log', '--no-merges', '--format=%h%x00%s', range], { encoding: 'utf8' });
    const rows = out.split('\n').filter(Boolean).map((row) => row.split('\0'));
    let ok = true;
    for (const [hash, subject] of rows) ok = report(hash, subject, checkSubject(subject)) && ok;
    console.log(ok ? `✓ 커밋 ${rows.length}개 제목이 규칙에 맞습니다` : `docs/COMMITS.md 를 보세요`);
    return ok ? 0 : 1;
  }
  const file = argv[0];
  if (!file) { console.error('사용: check_commit_msg.mjs <메시지 파일> | --range <from>..<to>'); return 2; }
  // 주석(#) 줄을 뺀 첫 줄이 제목이다
  const subject = readFileSync(file, 'utf8').split('\n').find((row) => row.trim() && !row.startsWith('#')) ?? '';
  const ok = report('commit-msg', subject, checkSubject(subject));
  if (!ok) console.error('docs/COMMITS.md 를 보세요');
  return ok ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith('check_commit_msg.mjs')) process.exit(main(process.argv.slice(2)));
