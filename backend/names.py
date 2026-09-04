# 포켓몬 한글 이름/폼 라벨을 한 곳에서 관리한다 (build.py · dex_build.py · pve_build.py · sheet_build.py 공유)
#
# 입력
#   data/gm.json           PvPoke 게임마스터. pokemon 배열에 speciesId·speciesName·dex·types·released 가 들어 있다
#   data/species_names.csv PokeAPI 종 이름 표. local_language_id 가 '3' 인 행이 한국어 이름이다
#
# 출력 (파일을 만들지 않고, 다른 빌드 스크립트에 아래 공개 이름을 제공한다)
#   species         speciesId → PvPoke 종 데이터 dict
#   ko_species      도감번호 → 한글 종 이름
#   FORM_KO         정규화한 영문 폼 토큰 → 한글 폼 라벨
#   name_ko()       PvPoke speciesId → (한글 전체 이름, 폼 라벨)
#   label_from_gm() 게임마스터 (pokemonId, form) → 한글 폼 라벨
#   released_dex    출시된 도감번호 집합
#   released_names  출시된 종의 한글 이름 집합
#
# 관계
#   서로 다르게 부르는 세 소스(PvPoke speciesName의 괄호, 게임마스터 form 접미사, 시트의 한글 이름)를
#   "표준 한글 이름 하나"로 모으는 지점이다. 여기서 얻은 폼 라벨은 sprite.py 가 다시 PokeAPI 스프라이트 id 로 바꾼다.

import json
import csv
import re

# PvPoke 게임마스터 원본. species 와 released_dex 가 이 데이터에서 파생된다
_game_master = json.load(open('data/gm.json'))

# speciesId(예: 'charizard_mega_x') → 종 데이터 dict
species = {pokemon['speciesId']: pokemon for pokemon in _game_master['pokemon']}

# 도감번호 → 한글 종 이름. PokeAPI 언어 코드 3 번이 한국어라서 그 행만 남긴다
ko_species = {
    int(row['pokemon_species_id']): row['name']
    for row in csv.DictReader(open('data/species_names.csv', encoding='utf-8'))
    if row['local_language_id'] == '3'
}

# 폼 라벨: 키는 정규화(소문자, 공백·밑줄 제거)한 영문 토큰. PvPoke speciesName의 괄호와 게임마스터 form 접미사 모두 여기로 온다
# 값이 빈 문자열인 키는 "표시할 라벨이 없는 기본 폼"이라는 뜻이다(Normal, Standard, 성별 표기 등).
FORM_KO = {
    # 섀도우 · 메가진화 · 원시회귀
    'shadow':'섀도우','mega':'메가','megax':'메가X','megay':'메가Y','primal':'원시',
    # 리전 폼. 게임마스터는 'ALOLA', PvPoke는 'Alolan' 처럼 표기가 갈리므로 두 형태를 모두 키로 둔다
    'alolan':'알로라','alola':'알로라','galarian':'가라르','galar':'가라르','hisuian':'히스이','hisui':'히스이','paldean':'팔데아','paldea':'팔데아',
    # 기라티나 · 토네로스 3형제 · 데오키스 폼 ('normal'은 라벨을 붙이지 않는 기본 폼)
    'altered':'어나더폼','origin':'오리진폼','incarnate':'화신폼','therian':'영물폼','attack':'어택폼','defense':'디펜스폼','speed':'스피드폼','normal':'',
    # 8세대 전설·특수 폼: 검왕/방패왕, 백마·흑마 탄 모습, 큐레무 화이트/블랙, 히어로(마이티) 폼
    'crownedsword':'검왕','crownedshield':'방패왕','hero':'마이티폼','icerider':'백마탄모습','shadowrider':'흑마탄모습','white':'화이트','black':'블랙',
    # 네크로즈마(황혼의갈기·새벽의날개·울트라) · 지가르데(퍼펙트폼, 10%/50% 폼)
    # 2026-09-04 dawnwings/duskmane 한글 라벨이 서로 바뀌어 있던 것을 정정 (sprite.py SUFFIX도 함께 교정)
    'dawnwings':'새벽의날개','duskmane':'황혼의갈기','ultra':'울트라','complete':'퍼펙트폼','completeforme':'퍼펙트폼','10':'10%폼','tenpercent':'10%폼','50':'50%폼','fiftypercent':'50%폼',
    # 캐스퐁 날씨 폼 · 쉐이미 스카이/랜드 · 불비달마 달마모드 ('standard'는 기본 폼이라 빈 라벨)
    'sunny':'태양의모습','rainy':'빗방울의모습','snowy':'눈구름의모습','sky':'스카이폼','land':'랜드폼','zen':'달마모드','galarianzen':'가라르 달마모드','standard':'','galarianstandard':'가라르',
    # 메로엣타(보이스/스텝) · 케르디오(각오의모습) · 크기 폼(슈퍼/라지/보통/스몰 사이즈)
    'aria':'보이스폼','pirouette':'스텝폼','ordinary':'','resolute':'각오의모습','super':'슈퍼사이즈','large':'라지사이즈','average':'보통사이즈','small':'스몰사이즈',
    # 킬가르도 블레이드/실드 · 후파(굴레를벗어난) · 루가루암 한낮/한밤/황혼
    'blade':'블레이드폼','shield':'실드폼','confined':'','unbound':'굴레를벗어난','midday':'한낮','midnight':'한밤','dusk':'황혼','dawn':'새벽',
    # 로토무 폼(히트·워시·프로스트·스핀·커트) · 스트린더 하이/로우 · 우라오스 연격/일격
    'heat':'히트','wash':'워시','frost':'프로스트','fan':'스핀','mow':'커트','amped':'하이한모습','lowkey':'로우한모습','rapidstrike':'연격의태세','singlestrike':'일격의태세',
    # 도롱마담 망토 · 체리꼬 네거/포지 · 춤추새 스타일
    'plant':'초목망토','sandy':'모래땅망토','trash':'슬레기망토','overcast':'네거폼','sunshine':'포지폼','baile':'이글이글스타일','pompom':'파칙파칙스타일','pau':'훌라훌라스타일','sensu':'하늘하늘스타일',
    # 성별 표기와 'jr'은 라벨을 붙이지 않는다. 's'는 게임마스터 '_S'(에이펙스) 접미사용
    # (언노운 UNOWN_S 처럼 뜻이 다른 '_S'도 같은 키에 걸린다)
    # 그 밖에 오거폰 가면 4종과 혈월(우르샤)
    'female':'','male':'','jr':'','s':'에이펙스','wellspring':'우물의가면','hearthflame':'화덕의가면','cornerstone':'주춧돌의가면','teal':'벽록의가면','bloodmoon':'혈월',
    # 게노세크트 카세트(번·칠·다우즈·쇼크) · 팔데아 켄타로스 3종 · 아머드 뮤츠
    'burn':'번','chill':'칠','douse':'다우즈','shock':'쇼크','aqua':'아쿠아','blaze':'블레이즈','combat':'컴뱃','armored':'아머드',
}

# 폼 토큰을 FORM_KO 키 형태로 정규화한다: 소문자로 바꾸고 공백·밑줄·하이픈을 지운다.
# 같은 폼을 게임마스터는 'LOW_KEY', PvPoke는 'Low Key' 처럼 다르게 적기 때문에 한쪽 표기로 모아야 한다.
def normalize_form_token(token):
    return re.sub(r'[\s_\-]', '', token.lower())


# PvPoke speciesId → (한글 전체 이름, 폼 라벨)
# 예: 'charizard_mega_x' → ('메가X 리자몽', '메가X'), 'mewtwo_shadow' → ('섀도우 뮤츠', '')
# 반환값의 두 번째 항목(폼 라벨)은 sprite.py 의 sprite_id() 에 그대로 넘겨 쓴다
def name_ko(species_id):
    pokemon = species[species_id]
    # 종 기본 이름은 한글 표를 우선 쓰고, 없으면 PvPoke 영문 이름을 그대로 쓴다
    base_name = ko_species.get(pokemon['dex'], pokemon['speciesName'])
    # PvPoke는 폼을 괄호로 표기한다: 'Charizard (Mega X)' → ['Mega X']
    form_tokens = re.findall(r'\((.*?)\)', pokemon['speciesName'])
    # 섀도우는 폼 라벨이 아니라 이름 맨 앞에 붙는 접두어라서 따로 뽑아 둔다
    is_shadow = 'Shadow' in form_tokens
    # 표에 없는 토큰(코스튬 등)은 영문 원문을 그대로 라벨로 쓴다
    form_labels = [
        FORM_KO.get(normalize_form_token(token), token)
        for token in form_tokens
        if token != 'Shadow'
    ]
    # 빈 문자열 라벨(기본 폼)은 걸러 낸다
    label = ' '.join(form_label for form_label in form_labels if form_label)
    full_name = f'{label} {base_name}'.strip()
    return (f'섀도우 {full_name}' if is_shadow else full_name, label)


# 게임마스터 (pokemonId, form) → 폼 라벨. 라벨 표에 없는 폼(코스튬 등)은 None
# 라벨이 없는 기본 폼은 '' 을, 표에서 못 찾은 폼은 None 을 돌려주므로 호출부가 둘을 구분할 수 있다.
def label_from_gm(pokemon_id, form):
    # form 이 비었거나 pokemonId 와 같거나 '<POKEMON_ID>_NORMAL' 이면 기본 폼이다
    if not form or form == pokemon_id or form == f'{pokemon_id}_NORMAL':
        return ''
    # 보통 form 은 'CHARIZARD_MEGA_X' 처럼 pokemonId 로 시작하므로 그 뒤(밑줄 하나 포함)만 잘라 낸다
    form_suffix = form[len(pokemon_id) + 1:] if form.startswith(pokemon_id + '_') else form
    return FORM_KO.get(normalize_form_token(form_suffix))


# 2026-09-03 도감 [미구현] 태그용: PvPoke released 기준 출시 도감번호 집합
released_dex = {
    pokemon.get('dex')
    for pokemon in _game_master['pokemon']
    if pokemon.get('released') and pokemon.get('dex')
}
# PvPoke가 출시됨(released)으로 표시한 종의 한글 이름 집합
released_names = {
    name_ko(species_id)[0]
    for species_id, pokemon in species.items()
    if pokemon.get('released')
}
