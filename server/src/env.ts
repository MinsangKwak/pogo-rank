// ─────────────────────────────────────────────────────────────────────────────
// env.ts — 환경변수의 **관문**. 값을 읽는 일은 이 파일에서만 한다.
//
// 왜 한 곳인가 — `process.env.X` 를 코드 곳곳에서 읽으면, 오타 하나가 런타임까지 살아남아
// '조용히 빈 문자열' 로 동작한다. 프런트의 lib/cell.ts 와 같은 생각이다:
// 값이 글자가 되는 자리를 하나로 모으고, 그 자리를 검사한다.
//
// **없으면 부팅에서 죽는다.** 반쯤 설정된 채로 뜨는 서버가 제일 나쁘다 —
// 이벤트를 받아 놓고 DB 에 못 넣으면 그 시간의 기록은 영영 없다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

export interface Env {
  /** Postgres 접속 문자열. Neon 은 `?sslmode=require` 가 붙는다 */
  databaseUrl: string;
  /** Cloud Run 이 넣어 주는 값. 로컬은 8080 */
  port: number;
  /** 수집을 받아 줄 출처. 여기 없는 Origin 은 CORS 에서 막힌다 */
  allowedOrigins: string[];
  /** 롤업·관리 엔드포인트를 여는 열쇠. GitHub Actions 시크릿에서 온다 */
  adminToken: string;
  /** 한 IP 가 1분에 보낼 수 있는 수집 요청 수 */
  rateLimitPerMinute: number;
  /** 'production' 이면 운영 규칙(열쇠 없는 관리 엔드포인트 금지)을 강제한다 */
  nodeEnv: 'production' | 'development' | 'test';
  /** 로그인·권한 (v5 Phase 4) */
  auth: AuthEnv;
}

export interface AuthEnv {
  /** 액세스 토큰 서명 열쇠. **이 값을 아는 사람은 아무 권한의 토큰이든 지어낼 수 있다** */
  jwtSecret: string;
  /** 이 주소로 로그인하면 언제나 루트다. Firestore 규칙에 uid 를 박던 자리를 대신한다 */
  rootEmail: string;
  clientId: string;
  clientSecret: string;
  /** 구글이 인가 코드를 돌려줄 주소. 구글 콘솔에 **글자까지 같게** 등록돼 있어야 한다 */
  redirectUri: string;
  /** 로그인을 마치고 브라우저를 돌려보낼 앱 주소 */
  appOrigin: string;
}

class EnvError extends Error {}

function required(source: NodeJS.ProcessEnv, key: string): string {
  const value = (source[key] ?? '').trim();
  if (!value) throw new EnvError(`환경변수 ${key} 가 비어 있습니다 — .env.example 을 확인하세요`);
  return value;
}

function positiveInt(source: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = (source[key] ?? '').trim();
  if (!raw) return fallback;
  const value = Number(raw);
  // Number('') 은 0 이고 Number('abc') 는 NaN 이다 — 둘 다 조용히 통과시키면 한도가 0 이 된다
  if (!Number.isInteger(value) || value <= 0) throw new EnvError(`환경변수 ${key} 는 양의 정수여야 합니다 (받은 값: ${raw})`);
  return value;
}

/**
 * 쉼표로 나눈 Origin 목록.
 * **와일드카드를 받지 않는다** — `*` 를 허용하면 아무 사이트나 우리 수집기에 값을 밀어 넣을 수 있고,
 * 순위가 오염되는 순간 이 기능은 쓸모가 없어진다 (v4.6.0 의 문턱과 같은 이유).
 */
function origins(source: NodeJS.ProcessEnv, key: string): string[] {
  const list = (source[key] ?? '').split(',').map((one) => one.trim()).filter(Boolean);
  if (!list.length) throw new EnvError(`환경변수 ${key} 가 비어 있습니다 — 허용할 주소를 쉼표로 적습니다`);
  const wild = list.find((one) => one.includes('*'));
  if (wild) throw new EnvError(`${key} 에 와일드카드(${wild})는 쓸 수 없습니다 — 주소를 하나씩 적습니다`);
  const bad = list.find((one) => !/^https?:\/\/[^/]+$/.test(one));
  if (bad) throw new EnvError(`${key} 의 '${bad}' 가 Origin 모양이 아닙니다 (예: https://moncamp.kr)`);
  return list;
}

/**
 * 로그인 설정. **전부 필수다** — 하나라도 비면 인증이 반쯤 도는 서버가 뜨고,
 * 그 상태는 '로그인이 안 된다' 가 아니라 '로그인이 되는데 안전하지 않다' 일 수 있다
 */
function authOf(source: NodeJS.ProcessEnv, nodeEnv: Env['nodeEnv'], allowedOrigins: string[]): AuthEnv {
  const jwtSecret = required(source, 'JWT_SECRET');
  // HS256 의 열쇠는 해시 출력(32바이트)보다 짧을 이유가 없다. lib/jwt.ts 도 같은 선을 본다 —
  // 두 겹인 이유는 여기가 부팅이고 저기가 쓰는 자리이기 때문이다
  if (Buffer.byteLength(jwtSecret) < 32) {
    throw new EnvError('JWT_SECRET 이 32바이트보다 짧습니다 — openssl rand -hex 32 로 만듭니다');
  }

  const rootEmail = required(source, 'ROOT_EMAIL').toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rootEmail)) {
    throw new EnvError(`ROOT_EMAIL 이 이메일 모양이 아닙니다 (받은 값: ${rootEmail})`);
  }

  const redirectUri = required(source, 'OAUTH_REDIRECT_URI');
  let parsed: URL;
  try { parsed = new URL(redirectUri); }
  catch { throw new EnvError(`OAUTH_REDIRECT_URI 를 주소로 못 읽었습니다 (받은 값: ${redirectUri})`); }
  // **운영에서 http 면 인가 코드가 평문으로 다닌다.** 로컬(localhost)만 예외다
  if (nodeEnv === 'production' && parsed.protocol !== 'https:') {
    throw new EnvError('운영에서 OAUTH_REDIRECT_URI 는 https 여야 합니다');
  }

  // **돌아갈 주소는 허용 목록 안이어야 한다.** 아니면 열린 리다이렉트가 된다 —
  // 로그인 성공 뒤에 남의 사이트로 튕겨 보내는 길이 열린다
  const appOrigin = required(source, 'APP_ORIGIN');
  if (!allowedOrigins.includes(appOrigin)) {
    throw new EnvError(`APP_ORIGIN(${appOrigin}) 이 ALLOWED_ORIGINS 에 없습니다 — 열린 리다이렉트가 됩니다`);
  }

  return {
    jwtSecret,
    rootEmail,
    clientId: required(source, 'GOOGLE_CLIENT_ID'),
    clientSecret: required(source, 'GOOGLE_CLIENT_SECRET'),
    redirectUri,
    appOrigin,
  };
}

function nodeEnvOf(source: NodeJS.ProcessEnv): Env['nodeEnv'] {
  const raw = (source['NODE_ENV'] ?? 'development').trim();
  return raw === 'production' || raw === 'test' ? raw : 'development';
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const nodeEnv = nodeEnvOf(source);
  const adminToken = (source['ADMIN_TOKEN'] ?? '').trim();
  // 운영에서 열쇠가 없으면 롤업 엔드포인트가 누구에게나 열린다 — 부팅에서 막는다
  if (nodeEnv === 'production' && adminToken.length < 32) {
    throw new EnvError('운영에서는 ADMIN_TOKEN 이 32자 이상이어야 합니다');
  }
  const allowedOrigins = origins(source, 'ALLOWED_ORIGINS');
  return {
    databaseUrl: required(source, 'DATABASE_URL'),
    port: positiveInt(source, 'PORT', 8080),
    allowedOrigins,
    adminToken,
    rateLimitPerMinute: positiveInt(source, 'RATE_LIMIT_PER_MINUTE', 60),
    nodeEnv,
    auth: authOf(source, nodeEnv, allowedOrigins),
  };
}
