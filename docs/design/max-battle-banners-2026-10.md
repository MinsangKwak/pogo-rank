# 2026년 10월 맥스 배틀 배너

제작일: 2026-09-25. 도구: 내장 image_gen, 참조 이미지 기반 신규 생성 및 태우지네 형태 수정. 원본 PNG는 생성 폴더에 보존하고 서비스에는 sharp로 변환한 720×240 / 1200×400 WebP(quality 86)를 사용한다.

## 일정

|기간|보스|이미지|
|---|---|---|
|9/21–27|프리져·썬더·파이어|신규 3D 프리져 배틀 팀|
|9/28–10/4|울머기|기존 2번|
|10/3|거다이맥스 에이스번|신규 캐릭터 배너|
|10/5–11|태우지네|신규 캐릭터 배너|
|10/12–18|파라꼬|신규 3D 캐릭터 배너|
|10/19–25|포푸니|신규 캐릭터 배너|
|10/24|보스 미공개|신규 빛나는 알 콘셉트 배너|
|10/26–11/1|깜까미|신규 3D 캐릭터 배너|

원본 일정은 ScrapedDuck/LeekDuck의 max-mondays, max-battles 이벤트를 사용한다. 지나간 월요일의 주간 보스는 기존 schedule 주간 자료로 보완한다. 미공개 보스는 추정하지 않으며, 해당 행사에 보스가 추가되면 그 보스의 이미지 매핑을 우선한다.

출처: https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json
- https://leekduck.com/events/max-mondays-2026-10-05/
- https://leekduck.com/events/max-mondays-2026-10-12/
- https://leekduck.com/events/max-mondays-2026-10-19/
- https://leekduck.com/events/max-mondays-2026-10-26/
- https://leekduck.com/events/max-battle-day-october-24-2026/

## 제작 방향과 프롬프트

공통: panoramic 3:1 cinematic premium 3D animated movie rendering, magenta Dynamax spiral clouds, blue stadium lights, reflective arena floor, subject on right two thirds, dark navy negative space on left third, no text or watermark. 참조: web/public/images/max-battle-sobble-panorama-1200.webp.

- Cinderace: Gigantamax Cinderace standing atop an enormous fiery spherical football, tiny Blastoise and Inteleon in the foreground sending water streams. Crimson-magenta storm and sparks.
- Sizzlipede: Short flat oval dark red segmented body, yellow circular heat organs on underside, curling yellow moustache-like antennae, small stubby red legs; Dynamax scale, Blastoise water stream. 첫 생성본의 진화형과 비슷한 몸 형태를 수정했다.
- Sneasel: Original Johto dark teal form, asymmetric red feather ear, red feather tail, yellow forehead marking, white claws. Giant on right, small Pikachu below, cinematic lighting.
- Rookidee environment: Empty open-roof fantasy sports stadium. Sweeping blue wind ribbons and small feathers spiral over a circular arena on the right. Deep navy sky and pink spiral clouds, cyan floodlights, wet reflective floor. No characters, silhouettes, eggs or text.
- Sableye environment: Empty fantasy sports stadium with violet light and glowing blue/purple gemstones clustered around the right side. Purple aura rises from a circular platform under pink spiral clouds. No characters, silhouettes, eggs or text.
- Unannounced: Empty Max Battle stadium, illuminated right circular platform and magenta beam, red storm and mist. No Pokémon, silhouettes or eggs.

초기 제작 당시 파라꼬·깜까미의 캐릭터 생성은 도구의 output moderation(other) 오류가 반복되어 실패했다. 이전 사용자가 허용한 경기장 배경 방식으로 각각 별도 이미지를 생성했다. 두 이미지는 캐릭터를 묘사하지 않으며 대체 텍스트에도 이를 반영한다.

## 파일

서비스 파일: web/public/images/max-battle-{cinderace,sizzlipede,rookidee,sneasel,sableye,arena}-panorama-{720,1200}.webp

생성 원본:
- cinderace: /Users/minsang/.codex/generated_images/01a08b7a-58eb-7da1-b6a7-53e0df5e3bb4/exec-d8147b89-c020-45b3-ad5a-aa53657a1b93.png
- sizzlipede: /Users/minsang/.codex/generated_images/01a08b7a-58eb-7da1-b6a7-53e0df5e3bb4/exec-637d7784-5a5f-40cf-9912-7bd2cb71d0a6.png
- sneasel: /Users/minsang/.codex/generated_images/01a08b7a-58eb-7da1-b6a7-53e0df5e3bb4/exec-5f1df94e-97ad-4d98-ba31-a13603180520.png
- arena: /Users/minsang/.codex/generated_images/01a08b7a-58eb-7da1-b6a7-53e0df5e3bb4/exec-0ef06492-f032-43bb-bdf0-2f0900c6f86b.png
- rookidee: /Users/minsang/.codex/generated_images/01a08b7a-58eb-7da1-b6a7-53e0df5e3bb4/exec-a064e259-b208-4ac7-9c51-363f0c94300a.png
- sableye: /Users/minsang/.codex/generated_images/01a08b7a-58eb-7da1-b6a7-53e0df5e3bb4/exec-e37ccbef-db95-4e56-abb2-3578f375a426.png

검증: 타입 검사, 8개 일정 정렬·이미지 연결·미공개 행사 제한·파일 존재 검사 및 기존 단위 테스트. 로컬 Node 환경에서는 NODE_OPTIONS=--no-experimental-webstorage를 사용한다.

## 2026-09-26 교체 완료

내장 image_gen의 참조 이미지 기반 생성으로 파라꼬·깜까미 캐릭터 생성에 성공했다. 두 경기장 대체 이미지를 캐릭터 배너로 교체했다. 1번은 프리져와 기존 배틀 팀을 새로운 3:1 경기장 구도로 제작했다. 미공개 보스는 빛나는 알의 콘셉트 이미지이며 실제 보스나 공식 알 디자인을 확정하지 않는다.

### rookidee

최종 프롬프트:

> Create a panoramic 3:1 cinematic 3D rendition of the Pokémon Rookidee from reference 1, in the Max Battle stadium of reference 2. Preserve its round blue bird body, black face and yellow chest, red eyes and small feet. Make Rookidee giant on the right, wings extended in a lively pose. Dark left third for website text. Maintain beautiful pink storm clouds and blue stadium lighting. No text.

### sableye

최종 프롬프트:

> Make a cinematic 3D website banner featuring the exact Pokémon Sableye depicted in the first reference image. Preserve the recognizable purple body, blue faceted gemstone eyes, long pointed ears and red chest jewel. Translate the pixel sprite into a polished 3D animated movie character. Place a giant Sableye on the right of the stadium in the second reference, standing confidently with arms open; its full head and torso visible. Keep the stadium's magenta Dynamax clouds, violet jewel lighting and dark empty left third. Panoramic 3:1, no text.

### birds

최종 프롬프트:

> Recreate reference 1 as a new cinematic 3D animated-movie Pokémon stadium illustration matching reference 2. Keep Articuno as the giant blue icy bird boss with the small team of Rhyperior, Blissey, Lugia and Excadrill facing it. Change the composition to a wide 3:1 banner: Articuno on the right two thirds, smaller team low in the middle, dark uncluttered navy left third for headings. Realistic soft feather material, ice crystals, reflective arena floor, blue stadium lights and magenta spiral Dynamax clouds. No text, no watermark.

### arena

최종 프롬프트:

> Create a brand new panoramic 3:1 Pokémon website banner in premium cinematic 3D animated-film style. A mysterious enormous luminous pink raid egg, a teaser illustration for a Pokémon Max Battle with an unannounced boss. Egg floating above the right side of the arena, glowing magenta energy spirals, no identifiable boss or silhouette. This is an editorial illustration not an official event announcement. An expansive nighttime sports stadium, huge crimson and magenta Dynamax spiral clouds, blue floodlights, reflective wet arena floor and atmospheric mist. Dark navy left third with no characters, reserved for website headline. Entire main subjects visible with some headroom. Dramatic but friendly fantasy game scene. No lettering, no watermark.

저장 파일 및 원본:
- `web/public/images/max-battle-mystery-egg-panorama-{720,1200}.webp`
  - 생성 원본: `/Users/minsang/.codex/generated_images/01a08b7a-58eb-7da1-b6a7-53e0df5e3bb4/exec-ee83391d-5fe7-4d21-9dfd-f522e29fd8f6.png`
- `web/public/images/max-battle-rookidee-character-panorama-{720,1200}.webp`
  - 생성 원본: `/Users/minsang/.codex/generated_images/01a08b7a-58eb-7da1-b6a7-53e0df5e3bb4/exec-5a9f76f8-6433-48f3-8da4-b86934c2d65b.png`
- `web/public/images/max-battle-sableye-character-panorama-{720,1200}.webp`
  - 생성 원본: `/Users/minsang/.codex/generated_images/01a08b7a-58eb-7da1-b6a7-53e0df5e3bb4/exec-d67d4b76-b402-4c16-87b8-159d29d297eb.png`
- `web/public/images/max-battle-articuno-panorama-{720,1200}.webp`
  - 생성 원본: `/Users/minsang/.codex/generated_images/01a08b7a-58eb-7da1-b6a7-53e0df5e3bb4/exec-ae0a2405-044d-484f-b473-86a6f84655eb.png`
