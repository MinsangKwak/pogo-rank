# 도감번호 + 한글 폼 라벨 → PokeAPI 스프라이트 id 변환기 (build.py · dex_build.py · pve_build.py · value_build.py 공유)
#
# 입력
#   data/pokemon.csv  PokeAPI pokemon 표. id / identifier(예: 'charizard-mega-x') / species_id / is_default 열을 쓴다
#
# 출력 (파일을 만들지 않고 아래 두 함수를 제공한다)
#   sprite_id()       (도감번호, 한글 폼 라벨) → 스프라이트 id
#   gmax_sprite_id()  (도감번호, 게임마스터 form) → 거다이맥스 스프라이트 id
#
# 관계
#   폼 라벨은 names.py(FORM_KO)가 만든 한글 문자열이다. 여기서 얻은 id 로 sprites.py 가
#   PokeAPI 스프라이트 png 를 내려받아 data/sprites.json 에 묶는다.

import csv

# PokeAPI pokemon 인덱스: identifier → id, species_id → 기본 identifier
identifier_to_pokeapi_id = {}
default_identifier_by_species = {}
for row in csv.DictReader(open('data/pokemon.csv', encoding='utf-8')):
    identifier_to_pokeapi_id[row['identifier']] = int(row['id'])
    # is_default 가 1 인 행이 그 종의 기본 폼이다. 폼 접미사는 이 identifier 뒤에 붙인다
    if row['is_default'] == '1':
        default_identifier_by_species[int(row['species_id'])] = row['identifier']

# 한글 폼 라벨 → PokeAPI identifier 접미사
# 값이 빈 문자열인 라벨('에이펙스', '벽록의가면')은 전용 스프라이트가 없어 기본 폼 그림을 그대로 쓴다는 뜻이다.
# 서로 다른 라벨이 같은 접미사를 쓰는 경우도 있다('검왕'·'방패왕' → '-crowned').
# 2026-09-04 네크로즈마: 새벽의날개→-dawn, 황혼의갈기→-dusk (PokeAPI 접미사와 일치하도록 정정)
SUFFIX = {'메가':'-mega','메가X':'-mega-x','메가Y':'-mega-y','원시':'-primal','알로라':'-alola','가라르':'-galar','히스이':'-hisui','팔데아':'-paldea',
 '오리진폼':'-origin','어나더폼':'-altered','영물폼':'-therian','화신폼':'-incarnate','어택폼':'-attack','디펜스폼':'-defense','스피드폼':'-speed',
 '검왕':'-crowned','방패왕':'-crowned','백마탄모습':'-ice','흑마탄모습':'-shadow','화이트':'-white','블랙':'-black','새벽의날개':'-dawn','황혼의갈기':'-dusk',
 '울트라':'-ultra','퍼펙트폼':'-complete','10%폼':'-10','50%폼':'-50','태양의모습':'-sunny','빗방울의모습':'-rainy','눈구름의모습':'-snowy','스카이폼':'-sky',
 '달마모드':'-zen','가라르 달마모드':'-galar-zen','보이스폼':'-aria','스텝폼':'-pirouette','각오의모습':'-resolute','슈퍼사이즈':'-super','라지사이즈':'-large',
 '보통사이즈':'-average','스몰사이즈':'-small','블레이드폼':'-blade','히트':'-heat','워시':'-wash','프로스트':'-frost','스핀':'-fan','커트':'-mow',
 '연격의태세':'-rapid-strike','일격의태세':'-single-strike','굴레를벗어난':'-unbound','마이티폼':'-hero','에이펙스':'','우물의가면':'-wellspring-mask',
 '화덕의가면':'-hearthflame-mask','주춧돌의가면':'-cornerstone-mask','벽록의가면':'','혈월':'-bloodmoon','한밤':'-midnight','황혼':'-dusk'}


# (도감번호, 한글 폼 라벨) → PokeAPI 스프라이트 id. 맞는 스프라이트가 없으면 도감번호를 그대로 돌려준다
def sprite_id(dex_number, label):
    # 섀도우는 그림이 따로 없으므로 라벨에서 떼어 낸다
    label = label.replace('섀도우', '').strip()
    base_identifier = default_identifier_by_species.get(dex_number)
    if not base_identifier:
        # PokeAPI 표에 없는 종(미출시 등)은 도감번호를 스프라이트 id 로 쓴다
        return dex_number
    # 긴 라벨부터 검사한다: '메가X'가 '메가'보다, '황혼의갈기'가 '황혼'보다 먼저 걸려야 한다
    for korean_label in sorted(SUFFIX, key=len, reverse=True):
        if korean_label in label:
            pokeapi_id = identifier_to_pokeapi_id.get(base_identifier + SUFFIX[korean_label])
            # 라벨은 맞지만 PokeAPI에 그 폼 스프라이트가 없으면 다음 라벨을 계속 찾는다
            if pokeapi_id:
                return pokeapi_id
    return identifier_to_pokeapi_id.get(base_identifier, dex_number)


# 거다이맥스 스프라이트: PokeAPI의 '-gmax' 폼 (스트린더는 하이/로우 구분)
# (도감번호, 게임마스터 form) → 스프라이트 id. 거다이맥스 그림이 없으면 기본 폼 → 도감번호 순으로 물러난다
def gmax_sprite_id(dex_number, form):
    base_identifier = default_identifier_by_species.get(dex_number)
    if not base_identifier:
        return dex_number
    # 스트린더만 거다이맥스 스프라이트가 폼별로 나뉘어 있어 identifier 에 폼을 먼저 붙인다
    if form and form.endswith('_AMPED'):
        base_identifier += '-amped'
    if form and form.endswith('_LOW_KEY'):
        base_identifier += '-low-key'
    return (identifier_to_pokeapi_id.get(base_identifier + '-gmax')
            or identifier_to_pokeapi_id.get(default_identifier_by_species[dex_number] + '-gmax')
            or identifier_to_pokeapi_id.get(default_identifier_by_species[dex_number], dex_number))
