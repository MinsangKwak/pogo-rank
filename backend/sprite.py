import csv
# PokeAPI pokemon 인덱스: identifier → id, species_id → 기본 identifier
ident_to_id, species_base = {}, {}
for r in csv.DictReader(open('data/pokemon.csv', encoding='utf-8')):
    ident_to_id[r['identifier']] = int(r['id'])
    if r['is_default'] == '1': species_base[int(r['species_id'])] = r['identifier']

# 한글 폼 라벨 → PokeAPI identifier 접미사
SUFFIX = {'메가':'-mega','메가X':'-mega-x','메가Y':'-mega-y','원시':'-primal','알로라':'-alola','가라르':'-galar','히스이':'-hisui','팔데아':'-paldea',
 '오리진폼':'-origin','어나더폼':'-altered','영물폼':'-therian','화신폼':'-incarnate','어택폼':'-attack','디펜스폼':'-defense','스피드폼':'-speed',
 '검왕':'-crowned','방패왕':'-crowned','백마탄모습':'-ice','흑마탄모습':'-shadow','화이트':'-white','블랙':'-black','황혼의갈기':'-dawn','새벽의날개':'-dusk',
 '울트라':'-ultra','퍼펙트폼':'-complete','10%폼':'-10','50%폼':'-50','태양의모습':'-sunny','빗방울의모습':'-rainy','눈구름의모습':'-snowy','스카이폼':'-sky',
 '달마모드':'-zen','가라르 달마모드':'-galar-zen','보이스폼':'-aria','스텝폼':'-pirouette','각오의모습':'-resolute','슈퍼사이즈':'-super','라지사이즈':'-large',
 '보통사이즈':'-average','스몰사이즈':'-small','블레이드폼':'-blade','히트':'-heat','워시':'-wash','프로스트':'-frost','스핀':'-fan','커트':'-mow',
 '연격의태세':'-rapid-strike','일격의태세':'-single-strike','굴레를벗어난':'-unbound','마이티폼':'-hero','에이펙스':'','우물의가면':'-wellspring-mask',
 '화덕의가면':'-hearthflame-mask','주춧돌의가면':'-cornerstone-mask','벽록의가면':'','혈월':'-bloodmoon','한밤':'-midnight','황혼':'-dusk'}

def sprite_id(dex, label):
    label = label.replace('섀도우', '').strip()
    base = species_base.get(dex)
    if not base: return dex
    for k in sorted(SUFFIX, key=len, reverse=True):
        if k in label:
            pid = ident_to_id.get(base + SUFFIX[k])
            if pid: return pid
    return ident_to_id.get(base, dex)

# 거다이맥스 스프라이트: PokeAPI의 '-gmax' 폼 (스트린더는 하이/로우 구분)
def gmax_sprite_id(dex, form):
    base = species_base.get(dex)
    if not base: return dex
    if form and form.endswith('_AMPED'): base += '-amped'
    if form and form.endswith('_LOW_KEY'): base += '-low-key'
    return ident_to_id.get(base + '-gmax') or ident_to_id.get(species_base[dex] + '-gmax') or ident_to_id.get(species_base[dex], dex)
