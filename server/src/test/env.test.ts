// env 관문 — 반쯤 설정된 채로 뜨는 서버를 막는다
'use strict';
import { describe, it, expect } from 'vitest';
import { readEnv } from '../env.ts';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  ALLOWED_ORIGINS: 'https://moncamp.kr,https://dev.moncamp.kr',
  NODE_ENV: 'test',
} as NodeJS.ProcessEnv;

describe('env 관문', () => {
  it('제대로 된 값은 그대로 읽는다', () => {
    const env = readEnv(base);
    expect(env.allowedOrigins).toEqual(['https://moncamp.kr', 'https://dev.moncamp.kr']);
    expect(env.port).toBe(8080);
    expect(env.rateLimitPerMinute).toBe(60);
  });

  it('DATABASE_URL 이 없으면 부팅에서 죽는다', () => {
    expect(() => readEnv({ ...base, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('허용 주소가 비면 부팅에서 죽는다 — 아무나 보낼 수 있는 상태로 뜨지 않는다', () => {
    expect(() => readEnv({ ...base, ALLOWED_ORIGINS: '' })).toThrow(/ALLOWED_ORIGINS/);
  });

  it('와일드카드는 받지 않는다', () => {
    expect(() => readEnv({ ...base, ALLOWED_ORIGINS: 'https://*.moncamp.kr' })).toThrow(/와일드카드/);
  });

  it('Origin 모양이 아니면 죽는다 — 경로가 붙은 주소는 Origin 이 아니다', () => {
    expect(() => readEnv({ ...base, ALLOWED_ORIGINS: 'https://moncamp.kr/app' })).toThrow(/Origin/);
  });

  it('숫자 자리에 글자가 오면 죽는다 — 조용히 0 이 되지 않는다', () => {
    expect(() => readEnv({ ...base, RATE_LIMIT_PER_MINUTE: 'abc' })).toThrow(/양의 정수/);
    expect(() => readEnv({ ...base, RATE_LIMIT_PER_MINUTE: '0' })).toThrow(/양의 정수/);
  });

  it('운영에서 열쇠가 짧으면 죽는다 — 롤업이 아무에게나 열린다', () => {
    expect(() => readEnv({ ...base, NODE_ENV: 'production', ADMIN_TOKEN: 'short' })).toThrow(/ADMIN_TOKEN/);
    expect(() => readEnv({ ...base, NODE_ENV: 'production', ADMIN_TOKEN: 'x'.repeat(32) })).not.toThrow();
  });
});
