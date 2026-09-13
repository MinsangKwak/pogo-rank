// ─────────────────────────────────────────────────────────────────────────────
// i18n-en.js — 화면 문구 영문 사전 (2026-09-08 v2.29.0)
//
// 키는 코드에 적힌 한국어 원문 그대로다. 엔진(i18n.js)이 그려진 DOM 을 훑으며 이 표를 찾는다.
// 여기 없는 문구는 한국어로 남는다 — 없는 영어를 지어내지 않는다.
//
// 숫자가 들어가는 문장은 숫자를 '#' 으로 바꾼 뼈대를 키로 적는다.
//   '더보기 (100/1025)'  →  키 '더보기 (#/#)'  값 'More (#/#)'
//   '#' 의 개수가 원문과 다르면 엔진이 번역을 포기한다 (숫자가 뒤섞이지 않게)
//
// 이름(포켓몬·기술·폼·타입)은 여기 적지 않는다 — 빌드가 구운 데이터가 맡는다
//   dex_build.py: en · moveKo · formKo · build.py: TYPE_EN
//
// 번역하지 않는 것 (일부러)
//   패치노트 본문 · 일정표 이벤트 제목 · 개인정보처리방침 · 이용약관.
//   앞의 둘은 한국 서버 일정과 한국어 공지를 그대로 옮긴 콘텐츠이고,
//   뒤의 둘은 **한국어 원문이 효력을 갖는 문서**다. 옮긴 글이 원문과 어긋나면 그게 더 위험하다.
//   대신 그 화면 맨 위에 영문 안내 한 줄을 띄운다(I18N_KO_ONLY_NOTE).
// ─────────────────────────────────────────────────────────────────────────────

// 이름 + 꼬리말 꼴. $1·$2 로 잡은 조각은 엔진이 다시 번역해 끼운다 (이름 1,000개를 사전에 적지 않기 위해).
// 위에서부터 먼저 맞는 것을 쓴다 — 좁은 규칙을 위에 둔다
const I18N_PATTERNS = [
  [/^(.+) 상세 보기$/, 'View $1'],
  [/^([SABC]) 근거 — 점수 ([\d,.]+) = 공격 ([\d,.]+) × 위력 ([\d,.]+) × 자속 ([\d,.]+) · (.+) (\d+)위 (.+) 대비 (\d+)%$/,
    '$1 tier — score $2 = Attack $3 × Max Move power $4 × STAB $5 · #$7 among $6, $9% of $8'],
  [/^([SABC]) 근거 — 점수 ([\d,.]+) = 공격 ([\d,.]+) × 위력 ([\d,.]+) × 자속 ([\d,.]+) · (.+) (\d+)위$/,
    '$1 tier — score $2 = Attack $3 × Max Move power $4 × STAB $5 · #$7 among $6'],
  [/^D·(.+)$/, 'D·$1'],
  [/^(.+) \((.+)\)$/, '$1 ($2)'],
  [/^(.+)가 보스로 나오면\? \(레이드 — (.+) 딜러 추천\)$/, 'If $1 is the boss (Raid — $2 attackers)'],
  [/^(.+)이 보스로 나오면\? \(레이드 — (.+) 딜러 추천\)$/, 'If $1 is the boss (Raid — $2 attackers)'],
  [/^⚔️ (.+)을\(를\) 때릴 때 — 기술 타입별 배율$/, '⚔️ Attacking $1 — damage by move type'],
  [/^🎯 (.+) 상대 추천 딜러$/, '🎯 Recommended attackers vs $1'],
  [/^🛡 반대로, (.+) 타입 기술이 잘 통하는 상대$/, '🛡 Conversely — what $1-type moves hit hard'],
  [/^(.+) 타입 조합의 포켓몬은 없습니다\.$/, 'No Pokémon with the $1 type combination.'],
  [/^(.+) 타입 포켓몬 \((\d+)\)$/, '$1-type Pokémon ($2)'],
  [/^레이드 — (.+) 보스 기준 \(DPS·TDO 자체 계산\)$/, 'Raid — vs $1 boss (own DPS·TDO calculation)'],
  [/^맥스 배틀 — (.+) 보스 기준$/, 'Max Battle — vs $1 boss'],
  [/^(.+) 보스 추천 딜러 \(딜량순\)$/, 'Recommended attackers vs $1 boss (by damage)'],
  [/^(.+) 보스 딜러 순위 ▸$/, '$1 boss attacker rankings ▸'],
  [/^(.+) 보스 (\d+)위$/, '$1 boss #$2'],
  [/^(.+) 타입 레이드 성능$/, '$1-type raid performance'],
  [/^(.+) 타입 레이드 성능표 상위 \(종 중복 제거\)$/, 'Top of the $1-type raid table (duplicates removed)'],
  [/^일반·전설·메가 레이드는 전체 포켓몬 참전 · (.+) 타입 레이드 성능표 상위 \(종 중복 제거\)$/,
    'Standard · Legendary · Mega raids allow every Pokémon · top of the $1-type raid table (duplicates removed)'],
  [/^(.+) 타입$/, '$1 type'],
  [/^(.+) 보스$/, '$1 boss'],
  [/^(.+) 알$/, '$1 Eggs'],
  [/^(.+) 레이드$/, '$1 Raids'],
  [/^(.+) 리그$/, '$1 League'],
];

// 법률·콘텐츠 화면에 띄우는 안내 (privacy.js · terms.js · release.js)
const I18N_KO_ONLY_NOTE = 'This section is kept in Korean. The Korean text is the authoritative version.';
// 일정표 전용 — 번역 여부보다 **어느 지역 일정인지**가 먼저다.
// 포켓몬 GO 이벤트는 지역마다 날짜·시간이 다르다. 이 표는 한국 서버 공지를 옮긴 것이므로
// 영어로 보는 사람이 자기 지역 일정으로 오해하면 실제로 이벤트를 놓친다
const I18N_KST_NOTE = 'Dates and times follow the Korean server schedule (KST, UTC+9) and may differ in your region. This section is kept in Korean.';

const I18N_EN = {
  // ── 서비스 · 이동 ──────────────────────────────────────────────────────────
  '서비스 홈': 'Home',
  '내 포켓몬': 'My Pokémon',
  '포켓몬 도감': 'Pokédex',
  '타입 & 상성': 'Types & Matchups',
  '레이드 · PvE': 'Raids · PvE',
  '배틀 · PvP': 'Battle · PvP',
  '육성 플래너': 'Training Planner',
  '이벤트 일정': 'Event Schedule',
  '레이드 보스': 'Raid Bosses',
  '알 부화': 'Egg Hatches',
  '검색식 만들기': 'Search Builder',
  'PvP 개체값 순위': 'PvP IV Ranking',
  '즐겨찾기': 'Favorites',
  '★ 즐겨찾기': '★ Favorites',
  '⚔️ 레이드 보스': '⚔️ Raid Bosses',
  '🥚 알 부화': '🥚 Egg Hatches',
  '🔎 검색식 만들기': '🔎 Search Builder',
  '🧬 PvP 개체값 순위': '🧬 PvP IV Ranking',
  '메뉴': 'Menu',
  '전체 메뉴': 'Full menu',
  '본문으로 건너뛰기': 'Skip to content',
  '이전 화면': 'Back',
  '뒤로': 'Back',
  '닫기': 'Close',
  '검색': 'Search',
  '검색 닫기': 'Close search',
  '맨 위로': 'Back to top',
  '계정': 'Account',
  '포켓몬 검색': 'Search Pokémon',
  '모드 전환': 'Switch mode',
  '언어 전환': 'Switch language',

  // ── 홈 ────────────────────────────────────────────────────────────────────
  '오늘의 모험,': "Today's adventure,",
  '여기서 준비하세요.': 'starts here.',
  '무엇을 해볼까요?': 'What would you like to do?',
  '찾고, 비교하고, 키우는 즐거움. 필요한 기능으로 바로 시작해요.':
    'Find, compare, and train. Jump straight to what you need.',
  '뭘 키울지 여기서 정해요. 도감과 상성으로 포켓몬을 알아보고, 랭킹에서 추천 개체를 고른 뒤, 육성 플래너에 내 개체를 기록하면 돼요.':
    'Look Pokémon up in the Pokédex and matchup pages, check the rankings for picks, then track what you are raising in My Pokémon and the Planner.',
  '능력치부터 기술·진화까지': 'Stats, moves and evolutions',
  '약점과 추천 타입을 찾아요': 'Find weaknesses and the types to bring',
  '맥스 배틀의 딜러와 탱커': 'Max Battle attackers and tanks',
  '추천 딜러와 솔플 계산기': 'Recommended attackers and the solo calculator',
  '리그별 순위와 덱 구성': 'Rankings and team building by league',
  '내 개체를 기록하고 비교해요': 'Record your own Pokémon and compare them',
  '내 포켓몬의 육성 현황': 'What you are raising right now',
  '다가오는 레이드와 이벤트': 'Upcoming raids and events',
  '지금 도는 보스와 약점': 'Current bosses and their weaknesses',
  '거리별로 뭐가 나오나': 'What hatches from each distance',
  '기간 한눈에': 'All the dates at a glance',
  '서비스 기능': 'Features',
  '포켓몬고 응애 친구들을 위해 만들어진 서비스예요.': 'Made for Pokémon GO beginners.',
  '문의·건의:': 'Contact:',

  // ── 목록 · 공통 ───────────────────────────────────────────────────────────
  '더보기': 'More',
  '접기': 'Collapse',
  '더보기 (#/#)': 'More (#/#)',
  '더보기 +# (#/#)': 'More +# (#/#)',
  '더보기 · #개': 'More · #',
  '전체 #종': 'All # species',
  '#종': '# species',
  '#마리': '#',
  '#위': '#',
  '#점': '# pts',
  '#세대': 'Gen #',
  '#km 알': '# km Eggs',
  '#성 레이드': '#★ Raids',
  '전체': 'All',
  '전체 #': 'All #',
  '기타': 'Other',
  '기타 #': 'Other #',
  '딜러': 'Attacker',
  '탱커': 'Tank',
  '순위권 밖': 'Unranked',
  '활용 #곳': 'Used in #',
  // 2026-09-09 v2.40.0 보기 방식은 버튼 하나에서 두 칸 세그먼트 컨트롤로 바뀌었다 — 아이콘은 span 으로
  // 떼어 냈으므로 라벨만 남은 키를 쓴다 (아래 옛 키들은 더 안 쓰지만 지우지 않는다: 캐시된 화면이 남아 있다)
  '리스트': 'List',
  '그리드': 'Grid',
  '보기 방식': 'View',
  '☰ 리스트': '☰ List',
  '⊞ 그리드': '⊞ Grid',
  '보기 방식: 그리드 · 누르면 리스트': 'View: grid · tap for list',
  '보기 방식: 리스트 · 누르면 그리드': 'View: list · tap for grid',
  '즐겨찾기 토글': 'Toggle favorite',
  '즐겨찾기 #': 'Favorites #',
  '★ 즐겨찾기 #': '★ Favorites #',
  '미구현': 'Not in GO',
  '링크 공유': 'Share link',
  '이 포켓몬 링크 공유': 'Share a link to this Pokémon',
  '자세히 보기 (전체 화면) →': 'See more (full screen) →',
  '포켓몬 상세 ▸': 'Pokémon details ▸',
  '전체 순위 보기 ▸': 'See the full ranking ▸',
  '타입 지우기': 'Clear types',
  // 2026-09-12 v3.9.0 검색 → 도감 (components/search.js · components/pages.js)
  '이 도감에서 찾기 (예: 메타그로스, 섀도우 뮤츠)': 'Search this Pokédex (e.g. Metagross, Shadow Mewtwo)',
  '포켓몬 이름으로 도감 찾기': 'Search the Pokédex by name',
  '전체 도감 보기': 'See the full Pokédex',
  '검색 결과가 없어요. 이름 일부만 쳐도 찾아요 — 예: "메타", "리자".':
    'No matches. Part of a name is enough — try "Meta" or "char".',
  '지우기': 'Clear',
  '타입 필터 · 선택하기': 'Type filter · choose',
  '타입으로 좁히기': 'Narrow by type',
  '포켓몬 이름 또는 타입': 'Pokémon name or type',
  '이 목록에서 찾기 (예: 팬텀, #)': 'Filter this list (e.g. Gengar, #)',
  '이름·타입으로 찾기 · 비워 두면 활용처 순위': 'Search by name or type · leave empty for usage rankings',
  '이름으로 타입 채우기 (예: 가이오가)': 'Fill types from a name (e.g. Kyogre)',
  '이름 (예: 메타그로스, 섀도우 뮤츠)': 'Name (e.g. Metagross, Shadow Mewtwo)',
  '보스 이름 검색 (예: 메가거북왕, 자시안)': 'Search a boss (e.g. Mega Blastoise, Zacian)',
  '"리자" #마리': '"리자" — # results',
  '전체 #마리 표시됨': 'Showing all #',
  '최근 순위가 움직인 포켓몬 #마리 ▲▼': '# Pokémon moved in the latest update ▲▼',
  '★ 내 즐겨찾기 (#)': '★ My favorites (#)',
  '★ 즐겨찾기 #마리 · 🎒 내 포켓몬 #마리': '★ # favorites · 🎒 # of my Pokémon',
  '🎒 내 포켓몬 #마리': '🎒 # of my Pokémon',
  'PvE · PvP 갈래는 메뉴 ★ 즐겨찾기 에서': 'PvE · PvP breakdown lives under ★ Favorites in the menu',
  '★ 즐겨찾기 분류': 'Favorite categories',

  // ── 랭킹 · 티어표 ─────────────────────────────────────────────────────────
  'D-MAX 티어표 (전체)': 'D-MAX tier list (all)',
  '레이드 일반 티어표 (전체)': 'Standard raid tier list (all)',
  '레이드 어태커 전체': 'All raid attackers',
  '레이드 어태커 전체 (자체 계산)': 'All raid attackers (own calculation)',
  '슈퍼리그': 'Great League',
  '하이퍼리그': 'Ultra League',
  '마스터리그': 'Master League',
  '리틀컵': 'Little Cup',
  '리틀': 'Little',
  '슈퍼': 'Great',
  '하이퍼': 'Ultra',
  '마스터': 'Master',
  '슈퍼리그 전체 순위': 'Great League overall ranking',
  '하이퍼리그 전체 순위': 'Ultra League overall ranking',
  '마스터리그 전체 순위': 'Master League overall ranking',
  '리틀컵 전체 순위': 'Little Cup overall ranking',
  '일반': 'Standard',
  '속성별 레이드 성능표 기준': 'Based on the per-type raid performance table',
  '자체 계산 · 상위 #': 'Own calculation · top #',
  '#종 · 전설·환상·메가·섀도우 제외': '# species · Legendary, Mythical, Mega and Shadow excluded',
  'CP # · 상위 # 기준': 'CP # · top # considered',
  '각 순위표 상위 #위 기준 · #위 안은 강조 표시': 'Top # of each ranking · the top # is highlighted',
  '각 순위표 상위 #위 기준 · #위 안은 강조 표시 · D = 다이맥스, G = 거다이맥스':
    'Top # of each ranking · the top # is highlighted · D = Dynamax, G = Gigantamax',
  '이 포켓몬이 상위 #위에 드는 순위표 수 (PvE #표 · PvP #리그 · D-MAX #표)':
    'How many rankings place this Pokémon in the top # (PvE: # tables · PvP: # leagues · D-MAX: # tables)',
  '이 도감에서의 활용처 (상위 #위 내)': 'Where this Pokémon is used in this dex (within the top #)',
  '딜러 · 맥스 피해 #': 'Attacker · Max damage #',
  '탱커 · EHP # · 받는 배율 ×#': 'Tank · EHP # · damage taken ×#',
  '딜러는 맥스 피해 × √내구 순위, 탱커는 체력 × 방어 ÷ 받는 배율(EHP) 순위의 #위. 탱커 전체 순위는 [탱커] 세그먼트에서':
    'Attackers rank by Max damage × √bulk; tanks rank by HP × Defense ÷ damage taken (EHP) — this is #. The full tank ranking is under the [Tank] segment',
  '공격 # · 위력 # · 자속': 'Attack # · power # · STAB',
  '🛡 얘가 보스면 →': '🛡 If this one is the boss →',
  '🧩 추천 파티 — 딜러 # + 탱커 #': '🧩 Suggested party — # attackers + # tank',
  '⚔️ 이번 주 보스': "⚔️ This week's boss",
  '🧮 솔플 계산기': '🧮 Solo calculator',
  '솔플 계산기': 'Solo calculator',   // 2026-09-12 v3.6.1 이모지를 도트 아이콘으로 떼면서 글자만 남았다
  '🃏 덱 짜기': '🃏 Team builder',
  '덱 짜기': 'Team builder',           // 2026-09-12 v3.7.1 이모지를 도트 아이콘으로 떼면서 글자만 남았다
  '개체값 순위': 'IV ranking',
  '추천 덱 # — 정석 코어': 'Suggested team # — classic core',
  '추천 덱 # — 안티 메타': 'Suggested team # — anti-meta',
  '추천 덱 # — 타입 분산': 'Suggested team # — type spread',
  '점수 상위 + 약점 상호 보완': 'Top scorers whose weaknesses cover each other',
  '리그 상위 #마리 저격': 'Aimed at the league top #',
  '방어 타입 안 겹침': 'No overlapping defensive types',
  'PvP 덱 짜기': 'PvP team builder',
  'PvP 커스텀 덱 짜기': 'Custom PvP team builder',
  '상대 기준 맞춤 추천': 'Tailored to the opponents you enter',
  '실험 기능': 'Experimental',
  '상대 포켓몬 검색해서 슬롯 채우기': 'Search an opponent to fill a slot',
  '솔플 레이드 계산기': 'Solo raid calculator',
  '프로토타입 · 부활 운용': 'Prototype · assumes revives',
  '리그 점수': 'League score',
  '추천 덱': 'Suggested team',
  '내 덱 검증': 'Check my team',
  '레벨40': 'Level 40',
  '풀강50': 'Maxed 50',
  '버프 없음': 'No buff',
  '메가부스트 +#%': 'Mega boost +#%',
  '풀버프 +#%': 'Full buff +#%',
  '잡고 싶은 보스를 검색해서 골라주세요. 예: 메가거북왕을 고르면 풀·전기 정예 덱이 나와요.':
    'Search for the boss you want to beat. Picking Mega Blastoise, for example, gives you a Grass/Electric elite squad.',

  // ── 상세 팝업 ─────────────────────────────────────────────────────────────
  '능력치': 'Base stats',
  '능력치 육각형': 'Stat hexagon',
  '공격': 'Attack',
  '방어': 'Defense',
  '체력': 'HP',
  '스피드': 'Speed',
  '차지': 'Charged',
  '맥스어택': 'Max Attack',
  '배울 수 있는 기술': 'Learnable moves',
  '진화': 'Evolution',
  '진화가 없는 포켓몬이에요.': 'This Pokémon does not evolve.',
  '진화형을 누르면 그 포켓몬의 정보를 볼 수 있어요': 'Tap an evolution to see that Pokémon',
  '⚡ 메가 진화 가능 — 누르면 메가 진화 스탯을 볼 수 있어요': '⚡ Can Mega Evolve — tap to see its Mega stats',
  '⚡ 메가X vs 메가Y 비교': '⚡ Mega X vs Mega Y',
  '누르면 그 포켓몬의 상세 정보가 열려요.': 'Tap to open that Pokémon.',
  '※ 일부는 지금 배울 수 없는 레거시 기술이에요': '※ Some are legacy moves you cannot learn right now',
  '* 레거시 기술 — 대단한 기술머신 또는 이벤트로만 습득':
    '* Legacy move — only from an Elite TM or an event',
  '타입 상성': 'Type matchups',
  '약점': 'Weak to',
  '내성': 'Resists',
  '이중약점': 'Double weak',
  '이중내성': 'Double resist',
  '효과가 굉장한 타입이 없어요': 'Nothing is super effective',
  '이중 = 두 타입 모두에 걸려 ×#(약점) / ×#(내성·무효) ·': 'Double = both types are hit, ×# (weak) / ×# (resist or immune) ·',
  '×# 이중': '×# double',
  '🧭 상성 검색에서 딜러까지 보기 ▸': '🧭 Open matchup search for attacker picks ▸',
  '🧮 내 개체 CP 계산기': '🧮 CP calculator for my Pokémon',
  '내 개체 CP 계산기': 'CP calculator for my Pokémon',   // 2026-09-12 v3.6.1 이모지를 도트 아이콘으로 떼면서 글자만 남았다
  '🌱 플래너 내 포켓몬에 이 개체 저장': '🌱 Save this one to Planner → My Pokémon',
  '➕ 내 개체로 저장': '➕ Save as mine',
  '이중약점 = 두 타입 모두에 약해 ×2.56 · 이중내성 = 두 타입 모두 반감(×0.39). 본가의 무효 타입도 GO 에서는 같은 ×0.39 로 피해가 들어가요':
    'Double weakness = both types are weak, ×2.56 · Double resistance = both types resist (×0.39). Immunities in the main series also land at ×0.39 in GO',
  '상대 타입을 #~#개 고르거나 포켓몬 이름을 검색하면 약점·이중약점과 추천 딜러가 나옵니다.':
    'Pick #–# defending types, or search a Pokémon, to see its weaknesses and the attackers to bring.',
  '타입 칩을 눌러 바꾸거나 위에서 포켓몬을 검색하세요': 'Tap a type chip to change it, or search a Pokémon above',
  '배율은 게임마스터 상성표 기준 (굉장 ×# · 별로 ×# · 무효 ×#). 상세 팝업의 타입 상성에서도 이 페이지로 올 수 있어요.':
    'Multipliers come from the Game Master type chart (super effective ×# · not very effective ×# · immune ×#). You can also reach this page from the type matchups in a Pokémon popup.',
  '순위표는 그 속성 보스를 상대할 때의 DPS·TDO 기준이에요.': 'Rankings are DPS and TDO against a boss of that type.',
  '순위표는 단일 속성 보스 기준이라 복합 타입 상대에서는 위 배율표와 함께 보세요 (이중약점 타입 기술이 최우선).':
    'The rankings assume a single-type boss, so read them alongside the multiplier table above for dual types (double-weakness moves come first).',
  '두 타입을 정확히 이 조합으로 가진 폼(메가·리전 폼 포함). 누르면 상세':
    'Forms whose types are exactly this pair (Mega and regional forms included). Tap for details',
  '이 타입을 가진 폼 전부(복합 타입 포함). 두 번째 칩을 고르면 조합으로 좁혀져요':
    'Every form with this type (dual types included). Pick a second chip to narrow it to a pair',
  '굉장 ': 'Super effective ',
  '별로 ': 'Not very effective ',
  '거의 안 통함 ': 'Barely lands ',

  // ── CP · 개체값 ───────────────────────────────────────────────────────────
  'CP 만렙': 'Max CP',
  '만렙 Lv#': 'Max Lv#',
  '평시 Lv#': 'Normal Lv#',
  '날씨부스트 Lv#': 'Weather boosted Lv#',
  '포획 Lv#': 'Caught Lv#',
  '강화 상한': 'Power-up cap',
  '최저 #': 'Min #',
  '공격 IV': 'Attack IV',
  '방어 IV': 'Defense IV',
  '체력 IV': 'HP IV',
  'CP #% 기준 · 만렙': 'At #% IVs · max level',
  '🎯 포획 CP — 이 숫자면 #%': '🎯 Catch CP — this number means #%',
  '포획 CP — 이 숫자면 #%': 'Catch CP — this number means #%',
  '레이드 보상 — 개체값 # 이상 확정': 'Raid reward — guaranteed # IVs or better',
  '야생 스폰 — 개체값 하한 없음': 'Wild spawn — no IV floor',
  '맥스 배틀 (다이맥스) — Lv# 고정, 날씨부스트 없음': 'Max Battle (Dynamax) — fixed Lv#, no weather boost',
  '· 개체값 #% · 이 개체 만렙 CP # (#%)': '· #% IVs · max CP for this one: # (#%)',
  '종족값 # · CP # 기준 비율. 레이드/PvP는 도감 순위표 최고 순위':
    'Share of base stat # at CP #. Raid and PvP show the best rank in the dex rankings',
  '굵은 숫자가 개체값 #%(#/#/#) CP입니다. 잡은 개체가 이 값이면 #%. 야생은 레벨 하한이 없어 최저 CP를 적지 않습니다.':
    'The bold number is the CP at #% IVs (#/#/#). If your catch matches it, it is #%. Wild spawns have no level floor, so no minimum CP is listed.',
  '굵은 숫자가 개체값 #%(#/#/#) CP입니다. 잡은 개체가 이 값이면 #%. 맥스 배틀은 날씨부스트가 없어 항상 Lv#이라 레이드 평시와 같은 CP가 나옵니다. 야생은 레벨 하한이 없어 최저 CP를 적지 않습니다.':
    'The bold number is the CP at #% IVs (#/#/#). If your catch matches it, it is #%. Max Battles have no weather boost and are always Lv#, so the CP matches an unboosted raid. Wild spawns have no level floor, so no minimum CP is listed.',

  // ── 플래너 · 내 포켓몬 ────────────────────────────────────────────────────
  '육성 현황': 'Training status',
  '➕ 개체 추가': '➕ Add a Pokémon',
  '내 개체로 저장': 'Save as mine',
  '육성 중 #': 'Raising #',
  '완료 #': 'Done #',
  '교환 후보 #': 'Trade candidates #',
  '백개체': 'Hundo',
  '유사백': 'Near-hundo',
  '준수': 'Solid',
  '비교': 'Compare',
  '내 개체의 레벨·개체값을 맞추면 지금 CP와 만렙까지의 여지가 보여요':
    'Set the level and IVs of your Pokémon to see its current CP and how much room is left to max',
  '아직 저장한 개체가 없어요. 도감 상세 팝업의 "➕ 내 개체로 저장"을 누르거나 위 버튼으로 종을 검색해 추가하세요.':
    'You have not saved any Pokémon yet. Use "➕ Save as mine" in a Pokédex popup, or the button above to search for a species.',
  '아직 저장한 개체가 없어요. 🎒 내 포켓몬 탭의 ➕ 개체 추가, 또는 도감 상세 팝업의 ➕ 로 시작하세요.':
    'You have not saved any Pokémon yet. Start from ➕ Add a Pokémon in the 🎒 My Pokémon tab, or the ➕ in a Pokédex popup.',
  '개체 = 실제로 가진 한 마리. 같은 종을 여러 마리 저장할 수 있고, [☐ 비교] 를 같은 종 두 마리에 누르면 CP·개체값·리그 도달을 나란히 봐요.':
    'An entry is one Pokémon you actually own. You can save several of the same species, and tapping [☐ Compare] on two of the same species puts their CP, IVs and league reach side by side.',
  '도감이 "뭐가 세나"에 답한다면, 플래너는 "내가 가진 이 개체를 지금 키워도 되나, 다음에 뭘 하나"에 답합니다. 위 탭의 🎒 내 포켓몬에서 개체를 레벨·개체값·기술 단위로 저장하면 같은 종끼리 비교할 수 있어요. 도감 상세 팝업의 ➕ 로도 바로 저장됩니다.':
    'Where the Pokédex answers "what is strong", the Planner answers "is this one of mine worth raising, and what do I do next". Save your Pokémon with level, IVs and moves in the 🎒 My Pokémon tab above, and you can compare them within a species. The ➕ in a Pokédex popup saves one directly too.',
  '플래너 모드는 내 개체(레벨·개체값·기술)를 계정에 저장하고 같은 종끼리 비교하는 화면입니다. 헤더의 배지를 누르면 도감 모드로 돌아갑니다. 저장은 승인된 로그인 사용자만, 계산은 누구나.':
    'Planner mode saves your own Pokémon (level, IVs, moves) to your account and compares them within a species. Tap the badge in the header to go back to Pokédex mode. Saving needs an approved account; the calculations work for anyone.',
  '내 포켓몬은 개체 단위(레벨 · 개체값 · 기술 · 상태)로 계정(Firestore users/{uid}.mons)에 저장돼요. CP 는 종족값 × 레벨 × 개체값으로 계산하고, 리그 도달은 CP 상한을 넘지 않는 가장 높은 레벨이에요.':
    'My Pokémon are stored per entry (level, IVs, moves, status) on your account (Firestore users/{uid}.mons). CP is base stats × level × IVs, and league reach is the highest level that stays under the CP cap.',
  '다음에 붙을 것: 육성 판단 카드(키울 가치·다음 행동) · 목표 자원 계산기 · 게임 검색식 생성기 · 보유 개체 기반 파티 · 내 목표 × 일정 연결':
    'Coming next: a raise-or-not card (is it worth it, what to do next) · a resource goal calculator · in-game search string builder · parties from what you own · your goals linked to the schedule',

  // ── 계정 · 로그인 ─────────────────────────────────────────────────────────
  'Google 로그인': 'Sign in with Google',
  '로그아웃': 'Sign out',
  '계정 삭제': 'Delete account',
  '🔑 가입 승인': '🔑 Approve members',
  '👥 트레이너 코드': '👥 Trainer codes',
  '🛠 코드 관리 (추가·삭제) →': '🛠 Manage codes (add or remove) →',
  '테스트 트레이너': 'Test trainer',
  '로컬 테스트 (관리자)': 'Local test (admin)',
  '복사하면 공백 없는 #자리로 복사됩니다 — 게임의 친구 추가 화면에 바로 붙여넣으세요.':
    'Copying gives you the # digits with no spaces — paste it straight into the in-game Add Friend screen.',

  // ── 메뉴 · 안내 ───────────────────────────────────────────────────────────
  'ℹ️ 기준 안내 (지금 보는 화면)': 'ℹ️ How this screen is calculated',
  '📅 일정표': '📅 Schedule',
  '📅 #월 일정표': '📅 Month # schedule',
  '#/# 일정': 'Schedule for #/#',
  '🎉 패치노트': '🎉 Release notes',
  '⚔️ 기술 변경': '⚔️ Move changes',
  '🔒 개인정보처리방침': '🔒 Privacy policy',
  '📜 이용약관': '📜 Terms of use',
  '🍪 통계·저장소 설정': '🍪 Analytics and storage',
  '🛠 QA·버그 제보 (노션)': '🛠 QA and bug reports (Notion)',
  // 2026-09-09 v2.40.0 ☰ 메뉴 항목은 이모지를 아이콘 칸(span)으로 뗐다 — 라벨만 남은 키가 따로 필요하다.
  // 이모지가 붙은 위 키들은 화면 제목(PAGES) 쪽에서 아직 그대로 쓰인다
  '기준 안내 (지금 보는 화면)': 'How this screen is calculated',
  '트레이너 코드': 'Trainer codes',
  '패치노트': 'Release notes',
  '기술 변경': 'Move changes',
  'QA·버그 제보 (노션)': 'QA and bug reports (Notion)',
  '서비스': 'Screens',
  '정보': 'About',
  '개인정보처리방침': 'Privacy policy',
  '이용약관': 'Terms of use',
  '저장소·통계 안내': 'Storage and analytics',
  'PvPoke · PokeMiners 데이터': 'PvPoke · PokeMiners data',
  '기준일 #-#-# #:#:# · 매일 #시 자동 갱신': 'Data as of #-#-# #:#:# · refreshed daily at #:00',
  '기준일 #-#-# · 매일 #시 자동 갱신': 'Data as of #-#-# · refreshed daily at #:00',
  '통계 거부': 'Decline analytics',
  '통계 허용': 'Allow analytics',
  '이 사이트는 오프라인용 파일과 설정을 브라우저에 저장합니다(개인정보 아님). 방문 통계(Google Analytics)는 동의할 때만 켜지고, 위치정보는 수집하지 않습니다.':
    'This site stores offline files and settings in your browser (not personal data). Visit analytics (Google Analytics) only turn on if you agree, and no location data is collected.',
  'POGO PLAN은 비공식 팬 프로젝트입니다. Pokémon 및 관련 명칭·이미지의 권리는 The Pokémon Company · Nintendo · Creatures Inc. · GAME FREAK inc. 에, Pokémon GO 는 Scopely Explore, Inc. 에 있으며 이 서비스는 권리자와 무관합니다.':
    'POGO PLAN is an unofficial fan project. Pokémon and related names and images belong to The Pokémon Company · Nintendo · Creatures Inc. · GAME FREAK inc., and Pokémon GO to Scopely Explore, Inc.; this service is not affiliated with them.',
  '데이터는 PvPoke · PokeMiners · PokeAPI · LeekDuck 의 공개 자료를 사용합니다. 코드는 MIT, 데이터·이미지는 각 출처의 조건을 따릅니다 (저장소 NOTICE).':
    'Data comes from the public sources PvPoke · PokeMiners · PokeAPI · LeekDuck. The code is MIT; data and images follow each source’s terms (see NOTICE in the repository).',

  // ── 레이드 보스 · 알 부화 ─────────────────────────────────────────────────
  '보스를 누르면 약점과 추천 딜러가 열려요. 혼자 잡을 수 있는지는 ⚔️ 레이드 · PvE 의 🧮 솔플 계산기에서 확인하세요.':
    'Tap a boss to see its weaknesses and the attackers to bring. To check whether you can solo it, use the 🧮 solo calculator under ⚔️ Raids · PvE.',
  '★ 를 누르면 즐겨찾기에 담겨요. 이름을 누르면 종족값과 상성을 볼 수 있어요.':
    'Tap ★ to add a favorite. Tap the name for base stats and matchups.',
  '지금 도는 레이드 로테이션. 출처 LeekDuck(ScrapedDuck) · #-#-# 수집 · 지역과 이벤트에 따라 실제와 다를 수 있습니다':
    'The raid rotation running now. Source LeekDuck (ScrapedDuck) · collected #-#-# · may differ by region and event',
  '지금 도는 알 부화 풀. 출처 LeekDuck(ScrapedDuck) · #-#-# 수집 · 지역과 이벤트에 따라 실제와 다를 수 있습니다':
    'The egg pool running now. Source LeekDuck (ScrapedDuck) · collected #-#-# · may differ by region and event',
  '레이드 보스 정보를 아직 받지 못했습니다. 다음 빌드에서 채워집니다.':
    'Raid boss data has not been fetched yet. It will fill in on the next build.',
  '알 부화 정보를 아직 받지 못했습니다. 다음 빌드에서 채워집니다.':
    'Egg data has not been fetched yet. It will fill in on the next build.',
  '지역한정': 'Regional',
  '어드벤처 싱크': 'Adventure Sync',
  '선물 알': 'Gift Egg',
  '부스트': 'boost',

  // ── 기술 변경 ─────────────────────────────────────────────────────────────
  '위력이 오른 기술': 'Moves with higher power',
  '위력이 내린 기술': 'Moves with lower power',
  '에너지만 바뀐 기술': 'Moves with energy changes only',
  '에너지만 변경': 'Energy only',
  '새로 배우는 기술 · #건': 'Newly learnable moves · #',
  '위력 # → #': 'Power # → #',
  '· 에너지 비용 감소': '· lower energy cost',
  '· 에너지 비용 증가': '· higher energy cost',
  '· 에너지 생성 증가': '· more energy generated',
  '· 자신 방어 상승 확정': '· guaranteed self Defense boost',
  '· 상대 방어 하락 확정, 에너지 비용 증가': '· guaranteed opponent Defense drop, higher energy cost',
  '· 능력 상승 확률 감소, 에너지 비용 증가': '· lower stat-boost chance, higher energy cost',
  '· 트레이너 배틀 기준 · 체육관·레이드는 # → #': '· Trainer Battle values · Gyms and raids go # → #',
  '트레이너 배틀(PvP) 기준': 'Trainer Battle (PvP) values',
  '아래 위력 수치는': 'The power values below are',
  '이에요. 같은 기술이라도 레이드·체육관용 위력은 따로 관리되고, 이번 조정은 대부분 PvP에만 적용돼요.':
    '. Raid and Gym power is tracked separately for the same move, and most of this adjustment applies to PvP only.',
  '위력은 그대로라 레이드 DPS는 거의 그대로지만, PvP에서는 기술을 쓰는 빈도가 달라져요.':
    'Power is unchanged, so raid DPS barely moves, but how often you can use the move in PvP does.',
  '위력 수치는 트레이너 배틀 기준 · 자세한 내용은 메뉴 → ⚔️ 기술 변경':
    'Power values are for Trainer Battles · see Menu → ⚔️ Move changes for details',
  '출처: 포켓몬 GO 공식 GO 배틀리그 시즌 공지. 위력·에너지 값은 공지 표기를 그대로 옮겼고, 한글 기술명은 게임 내 표기로 자동 변환했어요.':
    'Source: the official Pokémon GO Battle League season notes. Power and energy values are copied as announced, and move names are mapped to their in-game spelling.',
  '#-#-# 적용됨': 'Applied #-#-#',
  '⚔️ #-#-# 기술 변경 적용됨': '⚔️ Move changes applied #-#-#',
  '⚔️ #/# 기술 변경': '⚔️ Move changes #/#',
  '#-#-# 갱신에서 #계단 상승': 'Up # places in the #-#-# update',
  '#-#-# 갱신에서 #계단 하락': 'Down # places in the #-#-# update',
  '순위표는 이미 이 값으로 계산돼 있어요. 최근 움직인 포켓몬에는 ▲▼ 표시가 붙어요.':
    'The rankings already use these values. Pokémon that moved recently carry a ▲▼ marker.',

  // ── 즐겨찾기 페이지 ───────────────────────────────────────────────────────
  '순위표에서 자동으로 정한 값이에요. 눌러서 바꾸면 이 포켓몬만 예외로 저장돼요.':
    'This is set automatically from the rankings. Tap to change it and only this Pokémon is stored as an exception.',
  '분류는 순위표에서 자동으로 정합니다 — PvE는 #개 표 상위 #위, PvP는 #리그 상위 #위 안에 들면 해당 갈래로 봅니다. 메가·섀도우 같은 폼 중 하나라도 들면 그 종이 포함되고, 괄호 없이 붙은 이름이 그 순위를 낸 폼입니다. 분류가 안 맞으면 포켓몬을 눌러 상세에서 직접 바꿀 수 있어요.':
    'Categories come from the rankings — PvE counts the top # across # tables, PvP the top # across # leagues. A species counts if any of its forms (Mega, Shadow and so on) makes it, and the name shown without brackets is the form that earned the rank. If a category looks wrong, tap the Pokémon and change it in the details.',
  '이 갈래로 담은 즐겨찾기가 아직 없어요.': 'No favorites in this category yet.',
  '순위권 밖인 즐겨찾기가 없어요.': 'None of your favorites are outside the rankings.',

  // ── 도감 · 안내 ───────────────────────────────────────────────────────────
  '미구현 = 포켓몬 GO에 아직 출시되지 않은 종 (PvPoke 출시 목록 기준, 데이터는 게임마스터 선등록분). 메가·섀도우·리전 폼은 🔍 검색으로 찾으면 이 목록에 함께 나와요.':
    '"Not in GO" marks species that have not been released in Pokémon GO (per the PvPoke release list; the data is pre-registered in the Game Master). Mega, Shadow and regional forms show up in this list when you find them through 🔍 search.',
  '구하기 쉬운 일반 개체만 모은 레이드 티어표 (자체 계산). 속성 탭은 그 속성 포켓몬만 표시. 점수는 같은 속성 최강 어태커(전설·메가 포함) 대비 %, 티어는 목록 안 상대 등급. 포켓몬을 누르면 상세 정보가 열려요.':
    'A raid tier list of easy-to-get, ordinary Pokémon (own calculation). Each type tab shows only that type. Scores are a % of the strongest attacker of the same type (Legendary and Mega included), and tiers are relative within this list. Tap a Pokémon for details.',
  'PvPoke 시뮬레이션 점수(#점 만점). 속성 필터 안의 순위는 해당 속성 내 순위이며 전체 순위를 함께 표시합니다.':
    'PvPoke simulation score (out of #). Inside a type filter the rank is within that type, shown alongside the overall rank.',
  '티어표 행을 누르면 선정 근거가 펼쳐집니다. 티어표는 pogomate와 같은 기준: 공격 종족값 × 맥스무브 위력(거다이 # · 다이 #) × 자속 #, 내구 미반영, 다이맥스·거다이맥스는 별도 항목이며 %는 그 목록 #위 대비입니다. 속성 칩은 그 타입 맥스무브를 쓰는 개체를 모읍니다(포켓몬 자체 타입이 아님). 출시된 다이맥스 #종 · 거다이맥스 #종만 포함(미출시 리전 폼 제외). 포켓몬을 누르면 상세 정보가 열립니다.':
    'Tap a tier-list row to expand why it landed there. The tier list uses the same basis as pogomate: Attack base stat × Max Move power (Gigantamax # · Dynamax #) × STAB #, bulk not counted, with Dynamax and Gigantamax listed separately and % measured against #1 of that list. A type chip gathers Pokémon whose Max Move is that type (not the Pokémon’s own type). Only the # released Dynamax and # released Gigantamax are included (unreleased regional forms excluded). Tap a Pokémon for details.',

  // ── 탭 줄 바로가기 · 일정표 ───────────────────────────────────────────────
  '도감': 'Dex',
  '상성': 'Types',
  '통계·저장소 설정': 'Analytics and storage',
  '👤 마이페이지': '👤 My page',
  '복사': 'Copy',
  '복사됨': 'Copied',
  '타입': 'Type',
  '이벤트': 'Event',
  '일': 'Sun',
  '월': 'Mon',
  '화': 'Tue',
  '수': 'Wed',
  '목': 'Thu',
  '금': 'Fri',
  '토': 'Sat',
  '#성': '#★',
  '아워(#시)': 'Hour (#:00)',
  '섀도우(주말)': 'Shadow (weekend)',
  '스포트라이트': 'Spotlight',
  '커뮤데이': 'Community Day',
  '레이드 아워': 'Raid Hour',
  '맥스 먼데이': 'Max Monday',

  // ── 날씨 · 그 밖의 낱말 ───────────────────────────────────────────────────
  '맑음': 'Clear',
  '비': 'Rain',
  '구름조금': 'Partly cloudy',
  '흐림': 'Cloudy',
  '바람': 'Windy',
  '눈': 'Snow',
  '안개': 'Fog',
  '홈': 'Home',
  '서비스 이동': 'Go to',
  '레벨': 'Level',
  '레이드': 'Raid',
  '맥스': 'Max',
  '레이드 전체': 'Raids overall',
  '맥스무브 속성': 'Max Move type',
  '진화 단계': 'Evolution stage',
  '야생': 'Wild',
  '레이드·맥스': 'Raid · Max',
  '| 레이드 #, 부스트 #': '| Raid #, boosted #',
  '| 레이드·맥스 #, 부스트 #': '| Raid · Max #, boosted #',
  '| 야생 #, 부스트 #': '| Wild #, boosted #',
  '🌱 플래너 — 내 개체를 어떻게 키울까': '🌱 Planner — how to raise what you own',
  '진화형을 누르면 그 포켓몬의 정보를 볼 수 있습니다 · ⚡ 메가 진화 가능 — 누르면 메가 진화 스탯을 볼 수 있습니다':
    'Tap an evolution to see that Pokémon · ⚡ Can Mega Evolve — tap to see its Mega stats',

  '타입: 메가X 에스퍼/격투 ↔ 메가Y 에스퍼 · 공격 종족값 메가Y가 # 더 높음 · 방어 종족값 메가Y가 # 더 높음':
    'Types: Mega X Psychic/Fighting ↔ Mega Y Psychic · Mega Y has # more base Attack · Mega Y has # more base Defense',

  // ── 화면 상태 ─────────────────────────────────────────────────────────────
  '불러오는 중': 'Loading',
  '결과가 없습니다': 'No results',
  '검색 결과가 없어요': 'No results',
  '오늘': 'Today',
  '종료': 'Ends',
  '시작': 'Starts',
  '진행 중': 'Now on',

  // ── 검색식 만들기 ─────────────────────────────────────────────────────────
  '게임 검색창에 붙여 넣을 식': 'A string to paste into the in-game search box',
  '만든 검색식을 계정에 이어서 쓰는 화면이라': 'because it keeps the strings you build on your account',
  '아래에서 조건을 누르면 검색식이 만들어져요.': 'Tap a condition below to build a string.',
  '자주 쓰는 묶음': 'Handy presets',
  '여러 개면 “또는”': 'Multiple types mean "or"',
  'CP 최소': 'Min CP',
  'CP 최대': 'Max CP',
  '이름 (예: 파이리)': 'Name (e.g. Charmander)',
  '↺ 비우기': '↺ Clear',
  '길게 눌러 복사': 'Press and hold to copy',
  '복사됨 ✓': 'Copied ✓',
  '기본': 'Basic',
  '분류': 'Category',
  '교환·정리': 'Trade & cleanup',
  '🧹 박스 정리': '🧹 Box cleanup',
  '🌱 육성 후보': '🌱 Worth raising',
  '🤝 교환용': '🤝 For trading',
  '교환할 수 있고, 즐겨찾기·그림자·전설이 아닌 것':
    'Tradable, and not favorited, shadow, or legendary',
  '개체값이 높고 지금 진화할 수 있는 것': 'High IVs and ready to evolve now',
  '교환할 수 있고 아직 행운이 아닌 것': 'Tradable and not lucky yet',
  '개체값 100% (네 별)': 'Perfect IVs (four stars)',
  '개체값 82~98% (세 별)': 'IVs 82-98% (three stars)',
  '색이 다른 모습': 'Shiny',
  '행운': 'Lucky',
  '그림자': 'Shadow',
  '정화됨': 'Purified',
  '즐겨찾기로 표시한 것': 'Marked as favorite',
  '의상 입은 개체': 'Wearing a costume',
  '전설': 'Legendary',
  '환상': 'Mythical',
  '울트라비스트': 'Ultra Beast',
  '메가진화 가능': 'Can Mega Evolve',
  '지금 진화할 수 있는 것': 'Can evolve right now',
  '진화에 도구가 필요한 것': 'Needs an item to evolve',
  '체육관에 넣어 둔 것': 'Currently in a gym',
  '교환할 수 있는 것': 'Tradable',
  '교환으로 받은 것': 'Received in a trade',
  '알에서 깬 것': 'Hatched from an egg',
  '레이드에서 잡은 것': 'Caught in a raid',
  '리서치 보상': 'Research reward',
  // 2026-09-12 v3.13.0 걷어낸 ★ 즐겨찾기를 아직 말하던 문구를 고쳤다
  '내 포켓몬·검색식·화면 설정이 계정에 묶여 어느 기기에서든 같아요.': 'Your Pokémon, search strings and display settings follow your account, so every device matches.',
  '🎒 내 포켓몬 #마리 · 화면 설정': '🎒 # Pokémon · display settings',
  '로그인하면 내 포켓몬과 화면 설정이 계정에 저장돼요. 승인된 분만 쓸 수 있고, 첫 로그인 때 ': 'Sign in and your Pokémon and display settings are saved to your account. Access is by approval, and on first sign-in we ask you to accept the ',
  '⏳ 승인 대기 중 — 관리자가 승인하면 내 포켓몬을 계정에 저장할 수 있어요. 관리자에게 알려주세요!': '⏳ Waiting for approval — once approved you can save your Pokémon to your account. Let the admin know!',
  '뭘 키울지 여기서 정해요. 도감에서 포켓몬을 알아보고, 랭킹에서 추천 개체를 고른 뒤, 육성 플래너에 내 개체를 기록하면 돼요.': 'Decide what to raise here. Look Pokémon up in the Pokédex, pick recommendations from the rankings, then record your own in the planner.',
  '타입으로 좁히기': 'Narrow by type',
  '포켓몬 검색 — 도감으로': 'Search Pokémon — opens the Pokédex',
  '🏆 활용처 순위': '🏆 Usage rankings',
  // 2026-09-13 v3.21.0 홈으로 올라오며 제목을 '무엇인지' 로 바꿨다 (views/usage.js)
  '🏆 두루 쓰이는 포켓몬': '🏆 Useful all around',
  // 2026-09-13 v3.22.0 홈 순위 세 덩이 (components/home.js HOME_PICKS)
  '지금 강한 포켓몬': 'Strong right now',
  // 2026-09-13 v3.22.1 홈 대시보드 인사·바로가기 (components/home.js renderServiceHome)
  '다음 모험의': 'Find the star of',
  '주인공을 찾아요.': 'your next adventure.',
  '지금 강한 포켓몬부터 나만의 육성 계획까지.': 'From what is strong right now to your own raising plan.',
  '트레이너의 다음 선택을 함께 준비해요.': 'Let us prepare your next move together.',
  '모험을 시작하는 세 가지 방법': 'Three ways to start',
  '순위표 세 곳의 상위 3종': 'Top 3 from each of three rankings',
  'D-MAX 티어표': 'D-MAX tier list',
  '맥스 배틀에서 가장 센 셋': 'The three strongest in Max Battles',
  '레이드 어태커': 'Raid attackers',
  '레이드 전체 딜량 순': 'By overall raid damage',
  '하나 키우면 여러 곳에서': 'Raise one, use it in many places',
  '전체 보기': 'See all',
  'DPS # · 버팀 #': 'DPS # · TDO #',
  '카드를 누르면 종족값·상성·활용처를 전부 볼 수 있어요': 'Tap a card for base stats, matchups and every place it is used',
  '두루 쓰이는 포켓몬': 'Useful all around',
  '하나 키우면 여러 곳에서 써요 · #종': 'Raise one, use it in many places · #',
  '포켓몬을 누르면 어디에 쓰이는지 전부 볼 수 있어요': 'Tap a Pokémon to see everywhere it is used',
  '#곳': '# places',
  ', 다시 누르면': ', again for',
  '이 화면은 지금 도는 로테이션만 말해요 — 앞으로의 일정은 달력이 맡아요. 출처 LeekDuck(ScrapedDuck) · #-#-# 수집 · 지역과 이벤트에 따라 실제와 다를 수 있어요':
    'This screen only covers what is in rotation right now — the calendar handles what is coming up. Source: LeekDuck (ScrapedDuck), collected #-#-#. Region and events can make the real rotation differ.',
  '지금 도는 알 부화 풀. 출처 LeekDuck(ScrapedDuck) · #-#-# 수집 · 지역과 이벤트에 따라 실제와 다를 수 있어요':
    'The egg pools currently in rotation. Source: LeekDuck (ScrapedDuck), collected #-#-#. Region and events can make the real pools differ.',
  '게임이 지원하지 않아 넣지 않은 것: 교환 상대 닉네임, 리모트 레이드 전용.':
    'Left out because the game does not support it: trade partner nickname, remote-raid-only.',
  '🃏 추천 덱 1 — 정석 코어': '🃏 Suggested team 1 — Standard Core',
  '🃏 추천 덱 2 — 안티 메타': '🃏 Suggested team 2 — Anti-Meta',
  '🃏 추천 덱 3 — 타입 분산': '🃏 Suggested team 3 — Type Spread',
  '정석 코어': 'Standard Core',
  '안티 메타': 'Anti-Meta',
  '타입 분산': 'Type Spread',
  '점수 상위 + 약점 상호 보완': 'Top scores, weaknesses covered for each other',

  // ── 문구가 해요체로 바뀌면서 사전 키와 어긋난 것들 (2026-09-12 v3.11.0) ──────
  // 영어로 켜고 훑어 보니 원문이 고쳐진 뒤 사전이 따라오지 못한 자리가 여럿이었다.
  // 옛 키는 그대로 둔다 — 지워 봐야 얻는 것이 없고, 되돌아갔을 때 다시 맞는다
  '이 화면은 지금 도는 로테이션만 말해요 — 앞으로의 일정은 달력이 맡아요.':
    'This screen only covers what is in rotation right now — the calendar handles what is coming up.',
  '지금 도는 알 부화 풀.': 'The egg pools currently in rotation.',
  '티어표 행을 누르면 선정 근거가 펼쳐져요. 티어표는 pogomate와 같은 기준: 공격 종족값 × 맥스무브 위력(거다이 450 · 다이 350) × 자속 1.2, 내구 미반영, 다이맥스·거다이맥스는 별도 항목이며 %는 그 목록 1위 대비예요. 속성 칩은 그 타입 맥스무브를 쓰는 개체를 모아요(포켓몬 자체 타입이 아님). 출시된 다이맥스 139종 · 거다이맥스 17종만 포함(미출시 리전 폼 제외). 포켓몬을 누르면 상세 정보가 열려요.':
    'Tap a row to unfold why it landed there. Same basis as pogomate: Attack base stat × Max Move power (G-Max 450 · Dynamax 350) × STAB 1.2, bulk not counted. Dynamax and Gigantamax are listed separately, and the % is against the top entry of that list. Type chips gather Pokémon whose Max Move is that type (not the Pokémon\'s own type). Only released Dynamax (139) and Gigantamax (17) are included; unreleased regional forms are left out. Tap a Pokémon for full details.',
  '프로토타입 가정: 자체 계산 PvE 수치(개체값 15/15/15) 기반에 선택 보스의 실제 방어·공격 종족값을 반영해 보정. 운용은 실측 제공자식 — 최정예 1~2마리를 기절 직전 이탈 → 부활(5~6초) → 재진입으로 돌려쓰는 방식 기준. 풀강50 토글은 딜 +6.3%·TDO +20%, 버프는 메가부스트 +30% / 풀버프(메가+날씨+친구) +60%. 실측 보정: 생존 3배 · DPS +20%. 기절 → 부활약 → 재진입 운용을 반영해 정예 1~6마리 중 가장 빨리 깎는 구성을 골라요 (교체 1초 · 전멸 후 재진입 13초). 난이도는 보스별로 자동 판정(메가·원시 → 메가, 전설·환상·울트라비스트 → 4성, 최종 진화 → 3성, 그 외 1성)이며 선택된 보스의 난이도 배지를 탭하면 수동 변경돼요. 레이드 표시 CP는 개체 종족값 기반 계산값(공식 검증: 뮤츠 5성 54,148), 전투 체력은 게임 구조상 티어 고정 — 1성 600 · 3성 3,600 · 4성 9,000 · 5성/메가 15,000, 제한 1·3성 180초 / 그 외 300초. 복합 타입 보스의 두 번째 타입은 어태커 자속 타입 기준 근사 보정. 포켓몬을 누르면 상세 정보가 열려요.':
    'Prototype assumptions. Built on our own PvE numbers (15/15/15 IVs), then adjusted for the selected boss\'s real Defense and Attack base stats. Play pattern follows what solo players actually do: cycle one or two top attackers out just before fainting, revive (5-6 s), and re-enter. The "maxed at 50" toggle adds +6.3% damage and +20% TDO; buffs are Mega boost +30% or full buff (Mega + weather + friend) +60%. Field correction: 3× survival, +20% DPS. Accounting for faint → revive → re-enter, we pick whichever lineup of one to six elites chews through the boss fastest (1 s to swap, 13 s to re-enter after a wipe). Tier is judged automatically per boss (Mega and Primal → Mega, Legendary / Mythical / Ultra Beast → 4-star, final evolutions → 3-star, everything else → 1-star); tap the tier badge on the selected boss to override it. Displayed raid CP is calculated from base stats (verified against Mewtwo 5-star: 54,148), while battle HP is fixed per tier by the game: 600 (1★) · 3,600 (3★) · 9,000 (4★) · 15,000 (5★/Mega), with a 180 s limit on 1★ and 3★ and 300 s otherwise. For dual-type bosses the second type is approximated against the attacker\'s STAB type. Tap a Pokémon for full details.',
  '실험 기능. 추천 덱 3종은 상대 입력 없이 리그 메타 기준으로 뽑아요 — 정석 코어(점수 + 약점 상호 보완 그리디), 안티 메타(상위 10마리 상대 평균 상성순), 타입 분산(방어 타입 안 겹치게). 커스텀 덱 짜기는 PvPoke 리그 순위 × 타입 상성(공격 최대 배율 ÷ 피격 최대 배율)의 근사 추천 — 실드·기술 사이클·CP 최적화는 반영하지 않아요. GO배틀리그 규칙상 같은 종은 파티에 1마리만(섀도우·일반도 같은 종)이라 모든 추천이 종 단위로 중복을 제거해요. 슬롯 3칸을 다 채우면 상대 덱 분석과 구성 가이드가 나와요.':
    'Experimental. The three suggested teams are drawn from the league meta without any opponent input — Standard Core (score plus greedy weakness cover), Anti-Meta (best average matchup against the top ten), and Type Spread (no overlapping defensive types). Custom team building is an approximation of PvPoke league rank × type matchup (best attacking multiplier ÷ worst incoming multiplier); shields, move cycles and CP optimisation are not modelled. GBL allows only one of each species per team (Shadow counts as the same species), so every suggestion de-duplicates by species. Fill all three slots for an opponent breakdown and a build guide.',
  '도감이 "뭐가 세나"에 답한다면, 플래너는 "내가 가진 이 개체를 지금 키워도 되나"에 답해요. 메뉴의 내 포켓몬에서 개체를 레벨·개체값·기술 단위로 저장하면 같은 종끼리 비교할 수 있어요.':
    'The Pokédex answers "what is strong". The planner answers "is this one of mine worth raising right now". Save your Pokémon by level, IVs and moves under My Pokémon in the menu, and you can compare them within a species.',
  '내 개체(레벨 · 개체값 · 기술)를 계정에 저장하고 같은 종끼리 비교해요. 메뉴에서 육성 현황과 내 포켓몬 목록을 오가요. 계산은 누구나, 저장은 승인된 분만.':
    'Save your Pokémon (level, IVs, moves) to your account and compare them within a species. The menu moves you between the progress overview and the full list. Anyone can run the numbers; only approved accounts can save.',
  '게임이 지원하지 않아 넣지 않은 것: 교환 상대 닉네임, 리모트 레이드 전용. ':
    'Left out because the game does not support it: trade partner nickname, remote-raid-only. ',
  '(조건을 고르면 여기에 검색식이 만들어져요)': '(Pick some conditions and the search string appears here)',
  '조건을 한 번 누르면 ': 'Tap a condition once for ',
  ', 다시 누르면 ': ', again for ',
  ', 또 누르면 해제돼요.': ', and once more to clear it.',
  'CP · 이름': 'CP · name',
  '교환용': 'For trading',
  'GO 배틀리그 보상': 'GO Battle League reward',
  '🎒 내 포켓몬': '🎒 My Pokémon',
  '만렙 기준 백개체 CP # 의 #% (# 차이)': '#% of a perfect (100%) CP # at max level (# apart)',
  '가 돼요 — 같은 CP 안에서 레벨을 더 올릴 수 있어서예요.': ' — a lower Attack lets you push the level higher under the same CP cap.',
  // ── 2026-09-12 v3.11.0 영문 누락분 일괄 보강 ────────────────────────────────
  // 영어로 켠 채 열다섯 화면을 훑어 한글이 남은 텍스트 노드를 전부 긁어 채웠다
  // (일정표 이벤트 제목·패치노트 본문·약관 본문은 일부러 그대로 둔다 — 위 머리말 참고)

  // 셸 · 메뉴 · 홈
  '포켓몬, 기술, 가이드를 검색하세요…': 'Search Pokémon, moves, guides…',
  '지금 뭐 하지': 'What now',
  '뭘 데려갈까': 'Who to bring',
  '뭘 키울까': 'Who to raise',
  '화면 테마': 'Theme',
  '움직이는 그림': 'Animated sprites',
  '켜기': 'On',
  '끄기': 'Off',
  '포켓몬이 움직여요. 움직이는 그림이 없는 종은 살짝 흔들려요. 그림을 더 받아서 데이터를 조금 더 써요.': 'Pokémon animate; species without an animated sprite bob gently. Uses a little more data for the extra images.',
  '정지 그림만 써요. 느린 회선이나 데이터를 아낄 때.': 'Still images only — for slow connections or saving data.',
  '바꾸면 다음에 여는 화면부터 적용돼요. 기기의 "동작 줄이기" 설정이 켜져 있으면 늘 정지 그림이에요.': 'Applies from the next screen you open. If your device has "reduce motion" on, images stay still.',
  '기기 설정': 'System',
  '밝게': 'Light',
  '어둡게': 'Dark',
  '설정': 'Settings',
  '위치': 'Location',
  '포켓몬 상세': 'Pokémon details',
  '전체 보기': 'See all',
  '삭제': 'Delete',
  '수정': 'Edit',
  '완료': 'Done',
  '지금': 'Now',
  '언제': 'When',
  'POGO PLAN과 함께하는 포켓몬 라이프': 'Your Pokémon GO companion',
  '찾고, 비교하고, 키우는 즐거움. 필요한 화면으로 바로 가요.': 'Find, compare, raise. Jump straight to the screen you need.',
  '지금 무엇을 하면 좋을까?': 'What should I do right now?',
  '+#개 더 보기': '+# more',
  '이번 달 전체 일정': 'Full schedule for this month',

  // 화면 한 줄 설명 (router.js ROUTE_DESC)
  '다가오는 레이드와 이벤트 일정이에요.': 'Upcoming raids and events.',
  '지금 도는 레이드 보스와 약점이에요.': 'Raid bosses in rotation right now, and their weaknesses.',
  '거리별로 무엇이 부화하는지 봐요.': 'See what hatches from each egg distance.',
  '포켓몬을 찾아 종족값과 상성을 봐요.': 'Look up a Pokémon to see base stats and type matchups.',
  '거대한 힘을 지닌 포켓몬의 티어를 봐요.': 'Tier list for Dynamax and Gigantamax battles.',
  '레이드 추천 딜러와 솔플 가능 여부를 계산해요.': 'Recommended attackers, and whether you can solo the raid.',
  '리그별 순위와 덱 구성을 봐요.': 'Rankings and team ideas for each league.',
  '내 포켓몬의 육성 현황을 한눈에 정리해요.': 'See how your Pokémon are coming along, all in one place.',
  '조건을 눌러 게임 검색창에 붙여 넣을 식을 만들어요.': 'Tap conditions to build a string you can paste into the in-game search.',
  '내 개체를 기록하고 같은 종끼리 비교해요.': 'Record your Pokémon and compare them within a species.',
  '내 개체가 그 리그에서 몇 위인지 봐요.': 'See where your Pokémon ranks in that league.',
  '상대할 셋을 넣으면 맞설 덱을 골라 드려요.': 'Name three opponents and we will pick a team to answer them.',
  '이 보스를 혼자 잡을 수 있는지 계산해요.': 'Work out whether you can solo this boss.',
  '이번 시즌에 위력·에너지가 바뀌는 기술이에요.': 'Moves whose power or energy changed this season.',
  '화면을 어떻게 볼지 정해요. 로그인하면 계정에 저장돼 어느 기기에서든 같아요.':
    'Choose how the app looks. Sign in and it is saved to your account, so every device matches.',

  // 티어표
  'S 티어': 'S tier',
  'A 티어': 'A tier',
  'B 티어': 'B tier',
  'C 티어': 'C tier',
  '메타를 지배하는 최상위 포켓몬이에요.': 'The very top of the meta.',
  '뛰어난 성능을 가진 상위권 포켓몬이에요.': 'Strong performers, just below the top.',
  '상황에 따라 충분히 쓸 만한 중위권이에요.': 'Solid mid-tier picks, depending on the matchup.',
  '대체할 개체가 없을 때 쓰는 하위권이에요.': 'Use these when you have nothing better.',
  '📊 티어 점수 산정 방식': '📊 How tier scores are calculated',
  '🛡 얘가 보스라면 데려갈 딜러': '🛡 Attackers to bring against this boss',
  '포켓몬 상세 보기 →': 'Open Pokémon details →',
  '도감에서 더 찾기': 'Find more in the Pokédex',
  '무엇이 센지부터 보고 싶다면 도감으로 가요.': 'Want to see what is strong first? Head to the Pokédex.',

  // 플래너 · 내 포켓몬
  '플래너 — 내 개체를 어떻게 키울까': 'Planner — how to raise what you have',
  '내 포켓몬 #마리': '# Pokémon saved',
  '내 포켓몬 바로가기': 'Go to My Pokémon',
  '내 포켓몬에서 개체 등록하기': 'Add one from My Pokémon',
  '개체 등록하기': 'Add a Pokémon',
  '같은 종 비교하기': 'Compare within a species',
  '박스 정리': 'Box cleanup',
  '박스 정리하기': 'Clean up my box',
  '교환 후보': 'Trade candidates',
  '육성 중': 'Raising',
  '육성 후보': 'Worth raising',
  '최근 추가한 포켓몬': 'Recently added',
  '가장 최근에 등록한 포켓몬이에요.': 'The Pokémon you saved most recently.',
  '가진 포켓몬을 레벨·개체값·기술 단위로 적어 둬요.': 'Record each Pokémon by level, IVs and moves.',
  '육성 중인 포켓몬 현황을 한눈에 봐요.': 'See at a glance how your projects are going.',
  '내 포켓몬의 상태에 맞는 다음 단계를 확인해보세요.': 'Check the next step for each of your Pokémon.',
  '두 마리의 [비교] 를 눌러 CP·개체값·리그 도달을 나란히 봐요.': 'Tap [Compare] on two of them to line up CP, IVs and league reach.',
  '어느 포켓몬인가요': 'Which Pokémon?',
  '어디서 얻었나요': 'Where did you get it?',
  '야생 · 교환': 'Wild · Trade',
  '알 · 레이드 · 리서치': 'Egg · Raid · Research',
  '섀도우 (교환 전)': 'Shadow (before trading)',
  '야생에서 잡거나 교환으로 받은 개체': 'Caught in the wild or received in a trade',
  '세 경로는 개체값이 10 아래로 내려가지 않아요': 'Those three sources never roll below 10',
  '섀도우는 6 아래가 나오지 않아요': 'Shadow Pokémon never roll below 6',
  '종 이름 검색 (예: 레지스틸, 앱솔)': 'Search a species (e.g. Registeel, Absol)',
  '같은 종 두 마리를 골라 나란히 비교': 'Pick two of the same species to compare side by side',
  '상대 추가': 'Add an opponent',
  '개체값': 'IVs',
  '주요 기술': 'Main moves',
  '스페셜': 'Charged',

  // PvP 개체값 순위
  'PvP 에서 몇 위인지': 'Where it ranks in PvP',
  '왼쪽에서 종을 고르면 지금 고른 리그의 순위가 나와요.': 'Pick a species on the left to see its ranking in the selected league.',
  '리그마다 몇 위짜리 개체인지 봐요. PvP 는 0/15/15 처럼 기준이 다르거든요.': 'See how your Pokémon ranks in each league — PvP judges IVs differently (0/15/15 and the like).',
  'PvP 는 CP 상한이 있어 공격이 낮을수록 좋은 개체': 'With a CP cap in play, lower Attack is usually better',
  '그래서 0/15/15 같은 조합이 1위가 되는 일이 흔해요.': 'That is why spreads like 0/15/15 often come out on top.',
  '순위는 CP 상한 안에서 가장 높은 레벨까지 올렸을 때의 공격 × 방어 × 체력(스탯 곱)으로 매겨요.':
    'Ranks come from Attack × Defense × HP (stat product) at the highest level that still fits under the CP cap.',
  '마스터리그는 CP 상한이 없어 개체값이 높을수록 좋아요(순위를 매기지 않아요).': 'Master League has no CP cap, so higher IVs are simply better — we do not rank it.',
  '하한이 달라 순위도 달라져요': 'A different IV floor gives a different ranking',
  '베스트 버디(+1레벨)는 빼고 봐요 — 모두가 가질 수 있는 조건이 아니라서예요.': 'Best Buddy (+1 level) is left out — not everyone can get it.',
  '체력만 내림으로 끊는 게임 규칙까지 그대로 반영했고, 종족값과 레벨별 배율은 화면이 이미 쓰는 값 그대로예요.':
    'HP is floored exactly as the game does it, and base stats and CPM come from the same data this app already uses.',

  // 배틀 · PvP
  'PvPoke 시뮬레이션 점수(100점 만점). 속성 필터 안의 순위는 그 속성 안에서의 순위라, 전체 순위를 옆에 같이 적어요.':
    'PvPoke simulation score out of 100. Inside a type filter the number is the rank within that type, so the overall rank is shown beside it.',
  '자주 만나는 상대를 [+]에 1~3마리 채우면, 그 셋을 두루 잘 받아치는 맞춤 덱을 짜 줘요.':
    'Fill [+] with one to three opponents you keep running into, and we will build a team that answers all of them.',
  '실험 기능이에요.': 'This one is experimental.',

  // 레이드 보스 · 알 부화 · 일정
  '보스를 누르면 약점과 추천 딜러가 열려요. 혼자 잡을 수 있는지는': 'Tap a boss for its weaknesses and recommended attackers. To see whether you can solo it, use',
  '에서 봐요.': '.',
  '실제로 도는 보스는': 'The bosses actually in rotation are on',
  '이 달력은': 'This calendar is',
  '에서, 앞으로의 일정은': ', and what is coming up is on',
  '무엇이 열리는지를 봐요.': 'to see what opens up.',
  '10km 알 · 어드벤처 싱크 보상': '10 km eggs · Adventure Sync rewards',
  '5km 알 · 어드벤처 싱크 보상': '5 km eggs · Adventure Sync rewards',
  '7km 알 · 루트 선물': '7 km eggs · Route gifts',
  '7km 알 · 친구 선물': '7 km eggs · gifts from friends',

  // 검색식 만들기
  '조건을 한 번 누르면': 'Tap a condition once for',
  '＋포함': '+include',
  '－제외': '-exclude',
  '버전에 따라 달라지는 문법(사탕 수 등)도 빼 뒀어요 — 틀린 식을 드리지 않기 위해서예요.':
    'Syntax that changes between game versions (candy counts and so on) is left out, so we never hand you a string that does not work.',

  // 트레이너 코드 · 가입 권유
  '공백 없는 12자리로 복사돼요 — 게임의 친구 추가 화면에 바로 붙여넣으면 돼요.': 'Copied as 12 digits with no spaces — paste it straight into the in-game Add Friend screen.',
  '가입해 주시면 좋겠어요': 'We would love you to sign up',
  '친구들이 쓰는 작은 서비스예요. 쓰는 사람이 늘어야 데이터를 계속 손볼 이유가 생겨서, 가입을 권하고 있어요.':
    'This is a small site built for friends. More people using it is what keeps the data worth maintaining, which is why we are asking.',
  '로그인하면': 'After signing in',
  '잠긴 화면': 'Locked screens',
  '#개 잠김': '# locked',
  '전부 열림': 'All open',
  '내 포켓몬': 'My Pokémon',
  '기록할 수 없음': 'Cannot be saved',
  '개체별로 계정에 저장': 'Saved to your account, one by one',
  '화면 테마 · 보기 방식': 'Theme and view',
  '이 브라우저에만': 'This browser only',
  '어느 기기에서든 같음': 'The same on every device',
  '검색식 · 트레이너 코드': 'Search strings and trainer codes',
  '쓸 수 없음': 'Not available',
  '만들고 계정에 남김': 'Built and kept on your account',
  '괜찮아요, 둘러볼게요': 'No thanks, just looking',
  '승인제라 로그인해도 바로 열리지 않을 수 있어요. 받는 정보는 이메일 · 이름 · 프로필 사진뿐이고, 첫 로그인 때 ':
    'Access is approved by hand, so signing in may not open everything right away. We only receive your email, name and profile photo, and on first sign-in we ask you to accept the ',

  // 설정 화면
  '기기 설정 따름': 'Follow system setting',
  '휴대폰·PC 가 어두우면 같이 어두워져요.': 'Goes dark whenever your phone or computer does.',
  '기기 설정과 상관없이 늘 밝게 봐요.': 'Always light, whatever your device says.',
  '기기 설정과 상관없이 늘 어둡게 봐요.': 'Always dark, whatever your device says.',
  '지금 이 기기의 설정은 밝게예요.': 'This device is currently set to light.',
  '지금 이 기기의 설정은 어둡게예요.': 'This device is currently set to dark.',
  '상단 바의 테마 버튼은 밝게 ↔ 어둡게만 한 번에 뒤집어요. 기기 설정을 따르게 하려면 여기서 고르세요.':
    'The theme button in the top bar only flips between light and dark. To follow your device setting, choose it here.',
  '지금은 이 브라우저에만 저장돼요. ': 'For now this is saved in this browser only. ',
  '로그인하고 계정에 저장하기': 'Sign in and save it to my account',
  '승인되면 계정에 저장돼 어느 기기에서든 같아요.': 'Once approved it is saved to your account and matches on every device.',
  '화면 테마: 기기 설정 따름': 'Theme: follow system setting',
  '화면 테마: 밝게 — 누르면 어둡게': 'Theme: light — tap for dark',
  '화면 테마: 어둡게 — 누르면 밝게': 'Theme: dark — tap for light',
  // 2026-09-12 v3.16.0 잠시 써보기 (components/trial.js)
  '잠시 써보기': 'Try it briefly',
  '⏱ 잠시 써보기 ^^ (#초)': '⏱ Try it briefly ^^ (# s)',
  '⏱ 잠시 써보기 ^^ (#시간)': '⏱ Try it for a while ^^ (# h)',
  '남은 횟수 #번': '# left',
  '#초': '# s',
  '#분': '# min',
  '#분 #초': '# min # s',
  '#시간': '# h',
  '#시간 #분': '# h # min',
  '잠시 써보기 #번을 다 쓰셨어요. 이젠 가입하셔야죠 🙂': 'You have used all # quick tries. Time to sign up 🙂',
};
