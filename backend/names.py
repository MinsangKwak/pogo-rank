import json, csv, re
# 포켓몬 한글 이름/폼 라벨을 한 곳에서 관리한다 (build.py · pve_build.py · value_build.py 공유)
_pv = json.load(open('data/gm.json'))
species = {p['speciesId']: p for p in _pv['pokemon']}
ko_species = {int(r['pokemon_species_id']): r['name'] for r in csv.DictReader(open('data/species_names.csv', encoding='utf-8')) if r['local_language_id'] == '3'}

# 폼 라벨: 키는 정규화(소문자, 공백·밑줄 제거)한 영문 토큰. PvPoke speciesName의 괄호와 게임마스터 form 접미사 모두 여기로 온다
FORM_KO = {
    'shadow':'섀도우','mega':'메가','megax':'메가X','megay':'메가Y','primal':'원시',
    'alolan':'알로라','alola':'알로라','galarian':'가라르','galar':'가라르','hisuian':'히스이','hisui':'히스이','paldean':'팔데아','paldea':'팔데아',
    'altered':'어나더폼','origin':'오리진폼','incarnate':'화신폼','therian':'영물폼','attack':'어택폼','defense':'디펜스폼','speed':'스피드폼','normal':'',
    'crownedsword':'검왕','crownedshield':'방패왕','hero':'마이티폼','icerider':'백마탄모습','shadowrider':'흑마탄모습','white':'화이트','black':'블랙',
    'dawnwings':'황혼의갈기','duskmane':'새벽의날개','ultra':'울트라','complete':'퍼펙트폼','completeforme':'퍼펙트폼','10':'10%폼','tenpercent':'10%폼','50':'50%폼','fiftypercent':'50%폼',
    'sunny':'태양의모습','rainy':'빗방울의모습','snowy':'눈구름의모습','sky':'스카이폼','land':'랜드폼','zen':'달마모드','galarianzen':'가라르 달마모드','standard':'','galarianstandard':'가라르',
    'aria':'보이스폼','pirouette':'스텝폼','ordinary':'','resolute':'각오의모습','super':'슈퍼사이즈','large':'라지사이즈','average':'보통사이즈','small':'스몰사이즈',
    'blade':'블레이드폼','shield':'실드폼','confined':'','unbound':'굴레를벗어난','midday':'한낮','midnight':'한밤','dusk':'황혼','dawn':'새벽',
    'heat':'히트','wash':'워시','frost':'프로스트','fan':'스핀','mow':'커트','amped':'하이한모습','lowkey':'로우한모습','rapidstrike':'연격의태세','singlestrike':'일격의태세',
    'plant':'초목망토','sandy':'모래땅망토','trash':'슬레기망토','overcast':'네거폼','sunshine':'포지폼','baile':'이글이글스타일','pompom':'파칙파칙스타일','pau':'훌라훌라스타일','sensu':'하늘하늘스타일',
    'female':'','male':'','jr':'','s':'에이펙스','wellspring':'우물의가면','hearthflame':'화덕의가면','cornerstone':'주춧돌의가면','teal':'벽록의가면','bloodmoon':'혈월',
    'burn':'번','chill':'칠','douse':'다우즈','shock':'쇼크','aqua':'아쿠아','blaze':'블레이즈','combat':'컴뱃','armored':'아머드',
}
def norm(tok): return re.sub(r'[\s_\-]', '', tok.lower())

# PvPoke speciesId → (한글 전체 이름, 폼 라벨)
def name_ko(sid):
    p = species[sid]
    base = ko_species.get(p['dex'], p['speciesName'])
    toks = re.findall(r'\((.*?)\)', p['speciesName'])
    shadow = 'Shadow' in toks
    labels = [FORM_KO.get(norm(t), t) for t in toks if t != 'Shadow']
    label = ' '.join(l for l in labels if l)
    out = f'{label} {base}'.strip()
    return (f'섀도우 {out}' if shadow else out, label)

# 게임마스터 (pokemonId, form) → 폼 라벨. 라벨 표에 없는 폼(코스튬 등)은 None
def label_from_gm(pid, form):
    if not form or form == pid or form == f'{pid}_NORMAL': return ''
    suf = form[len(pid)+1:] if form.startswith(pid + '_') else form
    return FORM_KO.get(norm(suf))

# 2026-09-03 도감 [미구현] 태그용: PvPoke released 기준 출시 도감번호 집합
released_dex = {p.get('dex') for p in _pv['pokemon'] if p.get('released') and p.get('dex')}
# PvPoke가 출시됨(released)으로 표시한 종의 한글 이름 집합
released_names = {name_ko(sid)[0] for sid, p in species.items() if p.get('released')}
