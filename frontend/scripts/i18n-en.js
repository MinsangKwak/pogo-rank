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
  '즐겨찾기': 'Favorites',
  '★ 즐겨찾기': '★ Favorites',
  '⚔️ 레이드 보스': '⚔️ Raid Bosses',
  '🥚 알 부화': '🥚 Egg Hatches',
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
  '도감과 상성에서 포켓몬을 알아보고, 랭킹에서 추천 개체를 확인하세요. 내 포켓몬과 플래너에서 육성 현황을 관리할 수 있습니다.':
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
  '포켓몬고 응애 친구들을 위해 만들어진 서비스입니다.': 'Made for Pokémon GO beginners.',
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
  '지우기': 'Clear',
  '타입 필터 · 선택하기': 'Type filter · choose',
  '타입으로 좁히기': 'Narrow by type',
  '포켓몬 이름 또는 타입': 'Pokémon name or type',
  '이름 검색 또는 번호 (예: 팬텀, #)': 'Search by name or number (e.g. Gengar, #)',
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
  'PvE · PvP 갈래는 탭 줄 ★ 에서': 'PvE · PvP breakdown lives under ★ in the tab row',
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
  '🃏 덱 짜기': '🃏 Team builder',
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
  '잡고 싶은 보스를 검색해서 골라주세요. 예: 메가거북왕을 고르면 풀·전기 정예 덱이 나옵니다.':
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
  '진화가 없는 포켓몬입니다.': 'This Pokémon does not evolve.',
  '진화형을 누르면 그 포켓몬의 정보를 볼 수 있습니다': 'Tap an evolution to see that Pokémon',
  '⚡ 메가 진화 가능 — 누르면 메가 진화 스탯을 볼 수 있습니다': '⚡ Can Mega Evolve — tap to see its Mega stats',
  '⚡ 메가X vs 메가Y 비교': '⚡ Mega X vs Mega Y',
  '누르면 그 포켓몬의 상세 정보가 열립니다.': 'Tap to open that Pokémon.',
  '※ 일부는 지금 배울 수 없는 레거시 기술입니다': '※ Some are legacy moves you cannot learn right now',
  '* 레거시 기술 — 대단한 기술머신 또는 이벤트로만 습득':
    '* Legacy move — only from an Elite TM or an event',
  '타입 상성': 'Type matchups',
  '약점': 'Weak to',
  '내성': 'Resists',
  '이중약점': 'Double weak',
  '이중내성': 'Double resist',
  '효과가 굉장한 타입이 없습니다': 'Nothing is super effective',
  '이중 = 두 타입 모두에 걸려 ×#(약점) / ×#(내성·무효) ·': 'Double = both types are hit, ×# (weak) / ×# (resist or immune) ·',
  '×# 이중': '×# double',
  '🧭 상성 검색에서 딜러까지 보기 ▸': '🧭 Open matchup search for attacker picks ▸',
  '🧮 내 개체 CP 계산기': '🧮 CP calculator for my Pokémon',
  '🌱 플래너 내 포켓몬에 이 개체 저장': '🌱 Save this one to Planner → My Pokémon',
  '➕ 내 개체로 저장': '➕ Save as mine',
  '이중약점 = 두 타입 모두에 약해 ×2.56 · 이중내성 = 두 타입 모두 반감(×0.39). 본가의 무효 타입도 GO 에서는 같은 ×0.39 로 피해가 들어갑니다':
    'Double weakness = both types are weak, ×2.56 · Double resistance = both types resist (×0.39). Immunities in the main series also land at ×0.39 in GO',
  '상대 타입을 #~#개 고르거나 포켓몬 이름을 검색하면 약점·이중약점과 추천 딜러가 나옵니다.':
    'Pick #–# defending types, or search a Pokémon, to see its weaknesses and the attackers to bring.',
  '타입 칩을 눌러 바꾸거나 위에서 포켓몬을 검색하세요': 'Tap a type chip to change it, or search a Pokémon above',
  '배율은 게임마스터 상성표 기준 (굉장 ×# · 별로 ×# · 무효 ×#). 상세 팝업의 타입 상성에서도 이 페이지로 올 수 있어요.':
    'Multipliers come from the Game Master type chart (super effective ×# · not very effective ×# · immune ×#). You can also reach this page from the type matchups in a Pokémon popup.',
  '순위표는 그 속성 보스를 상대할 때의 DPS·TDO 기준입니다.': 'Rankings are DPS and TDO against a boss of that type.',
  '순위표는 단일 속성 보스 기준이라 복합 타입 상대에서는 위 배율표와 함께 보세요 (이중약점 타입 기술이 최우선).':
    'The rankings assume a single-type boss, so read them alongside the multiplier table above for dual types (double-weakness moves come first).',
  '두 타입을 정확히 이 조합으로 가진 폼(메가·리전 폼 포함). 누르면 상세':
    'Forms whose types are exactly this pair (Mega and regional forms included). Tap for details',
  '이 타입을 가진 폼 전부(복합 타입 포함). 두 번째 칩을 고르면 조합으로 좁혀집니다':
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
  '내 개체의 레벨·개체값을 맞추면 지금 CP와 만렙까지의 여지가 보입니다':
    'Set the level and IVs of your Pokémon to see its current CP and how much room is left to max',
  '아직 저장한 개체가 없어요. 도감 상세 팝업의 "➕ 내 개체로 저장"을 누르거나 위 버튼으로 종을 검색해 추가하세요.':
    'You have not saved any Pokémon yet. Use "➕ Save as mine" in a Pokédex popup, or the button above to search for a species.',
  '아직 저장한 개체가 없어요. 🎒 내 포켓몬 탭의 ➕ 개체 추가, 또는 도감 상세 팝업의 ➕ 로 시작하세요.':
    'You have not saved any Pokémon yet. Start from ➕ Add a Pokémon in the 🎒 My Pokémon tab, or the ➕ in a Pokédex popup.',
  '개체 = 실제로 가진 한 마리. 같은 종을 여러 마리 저장할 수 있고, [☐ 비교] 를 같은 종 두 마리에 누르면 CP·개체값·리그 도달을 나란히 봅니다. ★ 즐겨찾기(종 단위)와는 별개로 저장됩니다.':
    'An entry is one Pokémon you actually own. You can save several of the same species, and tapping [☐ Compare] on two of the same species puts their CP, IVs and league reach side by side. This is stored separately from ★ Favorites, which are per species.',
  '도감이 "뭐가 세나"에 답한다면, 플래너는 "내가 가진 이 개체를 지금 키워도 되나, 다음에 뭘 하나"에 답합니다. 위 탭의 🎒 내 포켓몬에서 개체를 레벨·개체값·기술 단위로 저장하면 같은 종끼리 비교할 수 있어요. 도감 상세 팝업의 ➕ 로도 바로 저장됩니다.':
    'Where the Pokédex answers "what is strong", the Planner answers "is this one of mine worth raising, and what do I do next". Save your Pokémon with level, IVs and moves in the 🎒 My Pokémon tab above, and you can compare them within a species. The ➕ in a Pokédex popup saves one directly too.',
  '플래너 모드는 내 개체(레벨·개체값·기술)를 계정에 저장하고 같은 종끼리 비교하는 화면입니다. 헤더의 배지를 누르면 도감 모드로 돌아갑니다. 저장은 승인된 로그인 사용자만, 계산은 누구나.':
    'Planner mode saves your own Pokémon (level, IVs, moves) to your account and compares them within a species. Tap the badge in the header to go back to Pokédex mode. Saving needs an approved account; the calculations work for anyone.',
  '내 포켓몬은 개체 단위(레벨 · 개체값 · 기술 · 상태)로 계정(Firestore users/{uid}.mons)에 저장됩니다. CP 는 종족값 × 레벨 × 개체값으로 계산하고, 리그 도달은 CP 상한을 넘지 않는 가장 높은 레벨입니다.':
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
  '★ 를 누르면 즐겨찾기에 담깁니다. 이름을 누르면 종족값과 상성을 볼 수 있어요.':
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
  '입니다. 같은 기술이라도 레이드·체육관용 위력은 따로 관리되고, 이번 조정은 대부분 PvP에만 적용됩니다.':
    '. Raid and Gym power is tracked separately for the same move, and most of this adjustment applies to PvP only.',
  '위력은 그대로라 레이드 DPS는 거의 그대로지만, PvP에서는 기술을 쓰는 빈도가 달라집니다.':
    'Power is unchanged, so raid DPS barely moves, but how often you can use the move in PvP does.',
  '위력 수치는 트레이너 배틀 기준 · 자세한 내용은 메뉴 → ⚔️ 기술 변경':
    'Power values are for Trainer Battles · see Menu → ⚔️ Move changes for details',
  '출처: 포켓몬 GO 공식 GO 배틀리그 시즌 공지. 위력·에너지 값은 공지 표기를 그대로 옮겼고, 한글 기술명은 게임 내 표기로 자동 변환했습니다.':
    'Source: the official Pokémon GO Battle League season notes. Power and energy values are copied as announced, and move names are mapped to their in-game spelling.',
  '#-#-# 적용됨': 'Applied #-#-#',
  '⚔️ #-#-# 기술 변경 적용됨': '⚔️ Move changes applied #-#-#',
  '⚔️ #/# 기술 변경': '⚔️ Move changes #/#',
  '#-#-# 갱신에서 #계단 상승': 'Up # places in the #-#-# update',
  '#-#-# 갱신에서 #계단 하락': 'Down # places in the #-#-# update',
  '순위표는 이미 이 값으로 계산돼 있습니다. 최근 움직인 포켓몬에는 ▲▼ 표시가 붙어 있어요.':
    'The rankings already use these values. Pokémon that moved recently carry a ▲▼ marker.',

  // ── 즐겨찾기 페이지 ───────────────────────────────────────────────────────
  '순위표에서 자동으로 정한 값입니다. 눌러서 바꾸면 이 포켓몬만 예외로 저장됩니다.':
    'This is set automatically from the rankings. Tap to change it and only this Pokémon is stored as an exception.',
  '분류는 순위표에서 자동으로 정합니다 — PvE는 #개 표 상위 #위, PvP는 #리그 상위 #위 안에 들면 해당 갈래로 봅니다. 메가·섀도우 같은 폼 중 하나라도 들면 그 종이 포함되고, 괄호 없이 붙은 이름이 그 순위를 낸 폼입니다. 분류가 안 맞으면 포켓몬을 눌러 상세에서 직접 바꿀 수 있어요.':
    'Categories come from the rankings — PvE counts the top # across # tables, PvP the top # across # leagues. A species counts if any of its forms (Mega, Shadow and so on) makes it, and the name shown without brackets is the form that earned the rank. If a category looks wrong, tap the Pokémon and change it in the details.',
  '이 분류에 해당하는 즐겨찾기가 아직 없어요.': 'No favorites in this category yet.',
  '순위권 밖인 즐겨찾기가 없어요.': 'None of your favorites are outside the rankings.',

  // ── 도감 · 안내 ───────────────────────────────────────────────────────────
  '미구현 = 포켓몬 GO에 아직 출시되지 않은 종 (PvPoke 출시 목록 기준, 데이터는 게임마스터 선등록분). 메가·섀도우·리전 폼은 🔍 전역 검색으로 찾을 수 있어요.':
    '"Not in GO" marks species that have not been released in Pokémon GO (per the PvPoke release list; the data is pre-registered in the Game Master). Mega, Shadow and regional forms are findable through the 🔍 global search.',
  '구하기 쉬운 일반 개체만 모은 레이드 티어표 (자체 계산). 속성 탭은 그 속성 포켓몬만 표시. 점수는 같은 속성 최강 어태커(전설·메가 포함) 대비 %, 티어는 목록 안 상대 등급. 포켓몬을 누르면 상세 정보가 열립니다.':
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
};
