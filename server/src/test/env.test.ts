// env 관문 — 반쯤 설정된 채로 뜨는 서버를 막는다
'use strict';
import { describe, it, expect } from 'vitest';
import { readEnv } from '../env.ts';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  ALLOWED_ORIGINS: 'https://moncamp.kr,https://dev.moncamp.kr',
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(48),
  ROOT_EMAIL: 'Owner@Example.TEST',
  GOOGLE_CLIENT_ID: '1-abc.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'GOCSPX-secret',
  OAUTH_REDIRECT_URI: 'http://localhost:8080/v1/auth/google/callback',
  APP_ORIGIN: 'https://moncamp.kr',
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
    // 운영에서는 돌아올 주소도 https 여야 하므로 같이 바꿔 준다 (아래 '로그인 설정' 참고)
    const prod = { ...base, NODE_ENV: 'production', OAUTH_REDIRECT_URI: 'https://api.moncamp.kr/cb' };
    expect(() => readEnv({ ...prod, ADMIN_TOKEN: 'short' })).toThrow(/ADMIN_TOKEN/);
    expect(() => readEnv({ ...prod, ADMIN_TOKEN: 'x'.repeat(32) })).not.toThrow();
  });

  describe('로그인 설정 (v5 Phase 4)', () => {
    it('제대로 된 값은 그대로 읽고, 루트 이메일은 소문자로 담는다', () => {
      // users.email 이 소문자만 받으므로(0004_identity.sql) 여기서 낮춰 두지 않으면
      // ROOT_EMAIL 이 영영 아무와도 안 맞는다 — 루트가 없는 채로 도는 서비스가 된다
      expect(readEnv(base).auth.rootEmail).toBe('owner@example.test');
    });

    it('열쇠가 없거나 짧으면 부팅에서 죽는다', () => {
      expect(() => readEnv({ ...base, JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
      expect(() => readEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/32바이트/);
    });

    it('구글 자격증명이 없으면 죽는다', () => {
      expect(() => readEnv({ ...base, GOOGLE_CLIENT_ID: '' })).toThrow(/GOOGLE_CLIENT_ID/);
      expect(() => readEnv({ ...base, GOOGLE_CLIENT_SECRET: '' })).toThrow(/GOOGLE_CLIENT_SECRET/);
    });

    it('루트 이메일이 이메일 모양이 아니면 죽는다', () => {
      expect(() => readEnv({ ...base, ROOT_EMAIL: 'nope' })).toThrow(/ROOT_EMAIL/);
      expect(() => readEnv({ ...base, ROOT_EMAIL: '' })).toThrow(/ROOT_EMAIL/);
    });

    it('돌아올 주소가 주소 모양이 아니면 죽는다', () => {
      expect(() => readEnv({ ...base, OAUTH_REDIRECT_URI: '/callback' })).toThrow(/OAUTH_REDIRECT_URI/);
    });

    it('운영에서 돌아올 주소가 http 면 죽는다 — 인가 코드가 평문으로 다닌다', () => {
      const prod = { ...base, NODE_ENV: 'production', ADMIN_TOKEN: 'a'.repeat(32) };
      expect(() => readEnv({ ...prod, OAUTH_REDIRECT_URI: 'http://api.moncamp.kr/cb' })).toThrow(/https/);
      expect(() => readEnv({ ...prod, OAUTH_REDIRECT_URI: 'https://api.moncamp.kr/cb' })).not.toThrow();
    });

    it('돌아갈 앱 주소가 허용 목록 밖이면 죽는다 — 열린 리다이렉트가 된다', () => {
      // 로그인에 성공한 브라우저를 남의 사이트로 보낼 수 있으면, 그 사이트가 토큰을 받는다
      expect(() => readEnv({ ...base, APP_ORIGIN: 'https://evil.test' })).toThrow(/열린 리다이렉트/);
      expect(() => readEnv({ ...base, APP_ORIGIN: '' })).toThrow(/APP_ORIGIN/);
    });
  });

  describe('풀링과 직접 연결을 갈라 쓴다 (v5 Phase 7)', () => {
    // Neon 은 호스트에 -pooler 를 붙여 둘을 가른다. **시크릿은 넣고 나면 못 읽으므로**
    // 어느 쪽을 넣었는지 확인할 길이 없다 — 사람이 안 틀리기를 바라는 대신 기계가 맞춘다
    const POOLED = 'postgres://u:p@ep-late-frog-12345-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require';
    const DIRECT = 'postgres://u:p@ep-late-frog-12345.ap-southeast-1.aws.neon.tech/db?sslmode=require';

    it('풀링 주소만 줘도 마이그레이션은 직접으로 간다', () => {
      // 풀러는 트랜잭션마다 연결을 돌려쓴다 — 세션에 거는 잠금이 안 살아 조용히 어긋난다
      const env = readEnv({ ...base, DATABASE_URL: POOLED });
      expect(env.databaseUrl).toBe(POOLED);
      expect(env.migrationUrl).toBe(DIRECT);
    });

    it('직접 주소만 줘도 그대로 돈다', () => {
      const env = readEnv({ ...base, DATABASE_URL: DIRECT });
      expect(env.databaseUrl).toBe(DIRECT);
      expect(env.migrationUrl).toBe(DIRECT);
    });

    it('둘 다 주면 평소 요청은 풀링으로 간다', () => {
      // Cloud Run 은 인스턴스를 여럿 띄운다 — 직접 연결로 다니면 Neon 의 접속 한도를 금방 먹는다
      const env = readEnv({ ...base, DATABASE_URL: DIRECT, DATABASE_URL_POOLED: POOLED });
      expect(env.databaseUrl).toBe(POOLED);
      expect(env.migrationUrl).toBe(DIRECT);
    });

    it('손으로 정하면 그쪽이 이긴다', () => {
      const env = readEnv({ ...base, DATABASE_URL: POOLED, MIGRATION_DATABASE_URL: DIRECT });
      expect(env.migrationUrl).toBe(DIRECT);
    });

    it('-pooler 가 이름 안에 있어도 호스트만 건드린다', () => {
      // 사용자명이나 DB 이름에 그 글자가 들어갈 수 있다 — 점 앞에 있는 것만 호스트다
      const odd = 'postgres://my-pooler-user:p@ep-abc.neon.tech/pooler-db';
      expect(readEnv({ ...base, DATABASE_URL: odd }).migrationUrl).toBe(odd);
    });
  });
});
