import csv, json, re, os
# hawaii 「속성별 레이드 성능표」 CSV → 우리 형식.
# 헤더 행(포켓몬·일반공격·차징공격·DPS·TDO…)을 찾아 열 위치를 잡고, 타입 블록은 0열 병합 셀(없으면 차징공격 타입의 최빈값)로 정한다.
from names import released_names

TYPE_KO = {'normal':'노말','fire':'불꽃','water':'물','grass':'풀','electric':'전기','ice':'얼음','fighting':'격투','poison':'독','ground':'땅','flying':'비행','psychic':'에스퍼','bug':'벌레','rock':'바위','ghost':'고스트','dragon':'드래곤','dark':'악','steel':'강철','fairy':'페어리'}
KO_TYPE = {v: k for k, v in TYPE_KO.items()}
HEADER = {'name':'포켓몬', 'fast_type':'N', 'fast':'일반공격', 'charged_type':'C', 'charged':'차징공격', 'dps':'DPS', 'tdo':'TDO',
          'er':'ER', 'dps_pct':'DPS(%)', 'tdo_pct':'TDO(%)', 'score':'종합(%)', 'tier':'평가', 'cp':'CP (Lv. 40)', 'flag':'M'}
SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹'
FORM_MAP = {'그림자':'섀도우','메가':'메가','메가x':'메가X','메가y':'메가Y','원시':'원시','알로라':'알로라','가라르':'가라르','히스이':'히스이','팔데아':'팔데아',
            '오리진':'오리진폼','오리진폼':'오리진폼','어나더':'어나더폼','어나더폼':'어나더폼','영물':'영물폼','영물폼':'영물폼','화신':'화신폼','화신폼':'화신폼',
            '화이트':'화이트','블랙':'블랙','검왕':'검왕','방패왕':'방패왕','어택':'어택폼','어택폼':'어택폼','디펜스':'디펜스폼','스피드':'스피드폼','울트라':'울트라',
            '황혼의갈기':'황혼의갈기','새벽의날개':'새벽의날개','하이한모습':'하이한모습','로우한모습':'로우한모습','연격의태세':'연격의태세','일격의태세':'일격의태세',
            '각오의모습':'각오의모습','에이펙스':'에이펙스','백마탄모습':'백마탄모습','흑마탄모습':'흑마탄모습','퍼펙트폼':'퍼펙트폼','굴레를벗어난':'굴레를벗어난',
            '10%폼':'10%폼','50%폼':'50%폼','태양의모습':'태양의모습','빗방울의모습':'빗방울의모습','눈구름의모습':'눈구름의모습','스카이폼':'스카이폼','랜드폼':'랜드폼','달마모드':'달마모드',
            'apex':'에이펙스','정화':'','굴레에빠진':'','굴레를벗어난':'굴레를벗어난','역전의용사':'마이티폼','마이티폼':'마이티폼'}
# 시트에서만 지역명을 붙이는 종 (진화체가 그 지역 전용이라 우리 표기엔 접두어가 없음)
ALIAS = {'가라르 창파나이트':'창파나이트','히스이 장침바루':'장침바루','히스이 다투곰':'다투곰','가라르 마임꽁꽁':'마임꽁꽁','가라르 파오리':'가라르 파오리',
         '히스이 대검귀':'히스이 대검귀','가라르 바다포':'바다포','가라르 데스판':'데스판','가라르 신비':'신비'}

def num(s):
    m = re.search(r'-?\d+(?:\.\d+)?', (s or '').replace(',', ''))
    return float(m.group()) if m else None

def parse_name(raw):
    # "엘레이드(메가)¹\n2026년 9월 8일" → 이름 "메가 엘레이드", 변형 "1", 메모 "2026년 9월 8일"
    lines = [l.strip() for l in raw.replace('\r', '').split('\n') if l.strip()]
    head, note = (lines[0] if lines else raw), ' '.join(lines[1:])
    # "엘레이드(메가) | 미출현" → 메모로 분리
    if '|' in head:
        head, extra = head.split('|', 1); note = (extra.strip() + ' ' + note).strip(); head = head.strip()
    variant = ''.join(SUPER.index(ch) and str(SUPER.index(ch)) or '0' for ch in head if ch in SUPER)
    head = ''.join(ch for ch in head if ch not in SUPER).strip()
    labels = []
    for m in re.findall(r'[\(（](.*?)[\)）]', head):
        for tok in re.split(r'[,/]+', m):
            key = re.sub(r'\s+', '', tok).lower()
            if key: labels.append(FORM_MAP.get(key, tok.strip()))
    head = re.sub(r'[\(（].*?[\)）]', '', head).strip()
    parts = head.split()
    base = parts[-1] if parts else head
    for p in parts[:-1]: labels.append(FORM_MAP.get(p.lower(), p))
    shadow = '섀도우' in labels
    others = [l for l in labels if l and l != '섀도우']
    name = ' '.join(others + [base]).strip()
    name = ALIAS.get(name, name)
    return (f'섀도우 {name}' if shadow else name), variant, note

def parse(path):
    rows = list(csv.reader(open(path, encoding='utf-8-sig')))
    report = [f'# {path}: {len(rows)} rows']
    blocks, cols, block = [], None, None
    for ri, row in enumerate(rows):
        cells = [c.strip() for c in row]
        if HEADER['name'] in cells and HEADER['fast'] in cells and HEADER['dps'] in cells:
            # 헤더 셀은 '종합(%)▼'처럼 장식이 붙을 수 있어 접두 일치로 찾는다
            def find(label):
                for i, c in enumerate(cells):
                    if c == label or (len(label) > 1 and c.startswith(label)): return i
                return None
            cols = {k: find(v) for k, v in HEADER.items()}
            cols = {k: i for k, i in cols.items() if i is not None}
            # '평가' 열이 '18열'처럼 이름 없이 오는 블록: 종합(%) 바로 오른쪽
            if 'tier' not in cols and 'score' in cols: cols['tier'] = cols['score'] + 1
            # 마지막 '전체' 표: 속성 열이 따로 있음
            if '속성' in cells: cols['type'] = cells.index('속성')
            if block: blocks.append(block)
            block = {'marker': None, 'rows': [], 'overall': '속성' in cells}
            if len(blocks) == 0: report.append(f'row {ri}: header cols {cols}')
            continue
        if not cols or not block: continue
        get = lambda k: cells[cols[k]] if k in cols and cols[k] < len(cells) else ''
        if cells and cells[0] in KO_TYPE: block['marker'] = KO_TYPE[cells[0]]
        if not get('name'): continue
        name, variant, note = parse_name(get('name'))
        fast, charged = get('fast'), get('charged')
        block['rows'].append({
            'raw': get('name'), 'name': name, 'variant': variant, 'note': note,
            'fast': fast, 'charged': charged, 'elite': '*' in fast or '*' in charged,
            'fast_type': KO_TYPE.get(get('fast_type')), 'charged_type': KO_TYPE.get(get('charged_type')),
            'dps': num(get('dps')), 'tdo': num(get('tdo')), 'er': num(get('er')), 'score': num(get('score')),
            'dps_pct': num(get('dps_pct')), 'tdo_pct': num(get('tdo_pct')), 'tier': get('tier'), 'cp': num(get('cp')),
            'type': KO_TYPE.get(get('type')),
        })
    if block: blocks.append(block)
    out = {}
    for b in blocks:
        if not b['rows']: continue
        # 맨 아래 '게임프레스 데이터 기준' 표는 다른 출처라 제외 (전체 탭은 자체 계산 유지)
        if b['overall']: report.append(f'skipped gamepress overall block ({len(b["rows"])} rows)'); continue
        t = b['marker']
        if not t:
            from collections import Counter
            c = Counter(r['charged_type'] for r in b['rows'] if r['charged_type'])
            t = c.most_common(1)[0][0] if c else 'unknown'
        rows_ = [r for r in b['rows'] if r['score'] is not None]
        for i, r in enumerate(rows_): r['rank'] = i + 1
        out.setdefault(t, []).extend(rows_)
    report.append('sections: ' + ', '.join(f'{t}:{len(v)}' for t, v in out.items()))
    return out, report

def attach_meta(sheet):
    meta = json.load(open('data/pve_full.json', encoding='utf-8'))['meta'] if os.path.exists('data/pve_full.json') else {}
    by_name = {m['name']: m for m in meta.values()}
    miss = {}
    for t, lst in sheet.items():
        for e in lst:
            m = by_name.get(e['name'])
            e['released'] = e['name'] in released_names
            if m: e['sprite'], e['types'], e['en'] = m['sprite'], m['types'], m['en']
            else:
                # 미출시 메가 등: 기본 종 스프라이트로 대체
                base = by_name.get(e['name'].split()[-1])
                e['sprite'], e['types'], e['en'] = (base['sprite'] if base else None), (base['types'] if base else []), (base['en'] if base else e['raw'])
                miss[e['name']] = e['raw']
    return miss

if __name__ == '__main__':
    result, full_report = {}, []
    for f in sorted(os.listdir('data')):
        if not (f.startswith('sheet_') and f.endswith('.csv')): continue
        key = f[len('sheet_'):-4]
        try:
            parsed, rep = parse(f'data/{f}')
            miss = attach_meta(parsed)
            rep.append(f'name not matched ({len(miss)}): ' + json.dumps(miss, ensure_ascii=False)[:1500])
            result[key] = parsed
        except Exception as ex:
            rep = [f'# {f}: parse failed: {ex!r}']
        full_report += rep + ['']
    json.dump(result, open('data/sheet.json', 'w', encoding='utf-8'), ensure_ascii=False)
    open('data/sheet_report.txt', 'w', encoding='utf-8').write('\n'.join(full_report))
    print('\n'.join(full_report)[:2500])
