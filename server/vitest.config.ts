/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

// 검사 대부분은 포트도 DB 도 없이 돈다 — 순수 함수와 app.inject() 뿐이다.
// 진짜 DB 를 태우는 검사는 TEST_DATABASE_URL 이 있을 때만 깨어난다 (src/test/dbUrl.ts).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/test/**/*.test.ts'],
    // **파일을 하나씩 돌린다.** DB 를 쓰는 검사가 셋이고(migrate · auth · integration)
    // 앞의 둘이 `drop schema public cascade` 로 시작한다 — 빈 자리에서 출발해야 결과가
    // 앞선 실행에 안 휘둘리기 때문이다. 이 셋이 같은 DB 를 동시에 잡으면 서로를 지운다.
    //
    // 실측: 같이 돌리자 migrate 의 beforeAll 이 auth 가 만든 표 위에서 넘어졌다.
    // 검사끼리 부딪혀 빨개지는 것은 **진짜 고장과 구별이 안 돼** 제일 나쁜 종류의 실패다.
    //
    // 스키마를 파일마다 따로 파는 길도 있지만, 전체가 2.5초라 나눠 얻을 것이 없다
    fileParallelism: false,
  },
});
