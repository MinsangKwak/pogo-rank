# ─────────────────────────────────────────────────────────────────────────────
# sheet_build.py — hawaii 「속성별 레이드 성능표」 구글 시트 CSV → 우리 형식(data/sheet.json)
#
# 왜 필요한가
#   레이드 공격수 순위는 커뮤니티가 손으로 관리하는 구글 시트가 사실상의 표준이다.
#   그 시트는 사람이 읽기 좋게 만들어져 있어서(속성별 표가 세로로 여러 개, 헤더에 정렬 화살표,
#   이름 칸에 각주·메모가 섞임) 기계가 그대로 읽을 수 없다. 이 스크립트가 그 사람용 표를
#   프론트가 쓰는 일정한 구조로 옮긴다.
#
# 입력
#   data/sheet_*.csv     시트를 CSV로 내보낸 파일 (파일명 뒤쪽이 그대로 결과의 키가 된다)
#   data/pve_full.json   pve_build.py가 만든 종 메타(meta) — 스프라이트·타입·영문명 출처
#   names.released_names PvPoke 기준 출시 종의 한글 이름 집합 (미출시 태깅용)
#
# 출력
#   data/sheet.json        { 시트키: { 속성: [행...] } }
#   data/sheet_report.txt  열 감지 결과·건너뛴 블록·이름 매칭 실패 목록 (파싱 점검용)
#
# 파이프라인에서의 위치 (scripts/build.sh)
#   pve_build.py → build.py(1차) → value_build.py → **sheet_build.py** → dex_build.py → build.py(2차).
#   pve_full.json이 먼저 있어야 메타를 붙일 수 있고, 여기서 만든 sheet.json은
#   dex_build.py가 스프라이트 id를 수집할 때와 build.py 2차가 data.js를 만들 때 쓰인다.
#
# 처리 순서
#   헤더 행(포켓몬·일반공격·차징공격·DPS·TDO…)을 찾아 열 위치를 잡고, 타입 블록은 0열 병합 셀
#   (없으면 차징공격 타입의 최빈값)로 정한다.
# ─────────────────────────────────────────────────────────────────────────────
import csv, json, re, os
from names import released_names

TYPE_KO = {'normal':'노말','fire':'불꽃','water':'물','grass':'풀','electric':'전기','ice':'얼음','fighting':'격투','poison':'독','ground':'땅','flying':'비행','psychic':'에스퍼','bug':'벌레','rock':'바위','ghost':'고스트','dragon':'드래곤','dark':'악','steel':'강철','fairy':'페어리'}
# 시트는 타입을 한글로 적으므로 역방향 표가 필요하다 ('불꽃' → 'fire')
KO_TYPE = {korean_type: english_type for english_type, korean_type in TYPE_KO.items()}
# 우리 필드 이름 → 시트 헤더 셀의 표기.
# 'N'·'C'·'M'처럼 한 글자 열은 각각 일반공격 타입 / 차징공격 타입 / 표시 플래그 열이다
HEADER = {'name':'포켓몬', 'fast_type':'N', 'fast':'일반공격', 'charged_type':'C', 'charged':'차징공격', 'dps':'DPS', 'tdo':'TDO',
          'er':'ER', 'dps_pct':'DPS(%)', 'tdo_pct':'TDO(%)', 'score':'종합(%)', 'tier':'평가', 'cp':'CP (Lv. 40)', 'flag':'M'}
# 이름 칸에 붙는 각주 번호는 위 첨자 문자로 적혀 있다 ('엘레이드(메가)¹'). 인덱스가 곧 숫자 값
SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹'
# 시트 표기 → 우리 표기(names.py의 폼 라벨과 같은 표기)로 맞추는 표.
# 시트는 '그림자'·'오리진'처럼 줄여 적거나 'apex'처럼 영문을 쓰기도 하고,
# '정화'·'굴레에빠진'처럼 우리 쪽에 라벨이 없는 표기도 있어서 그런 키는 빈 문자열로 지운다
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

def num(text):
    # 수치 셀에서 첫 번째 숫자만 뽑는다. 셀에는 '1,234'처럼 천 단위 콤마가 들어가거나
    # '12.3 ↑'처럼 장식이 붙을 수 있어 그대로 float()을 쓸 수 없다.
    # 정규식 r'-?\d+(?:\.\d+)?' = 앞의 음수 기호(선택) + 정수부 + 소수부(선택)
    match = re.search(r'-?\d+(?:\.\d+)?', (text or '').replace(',', ''))
    return float(match.group()) if match else None

def parse_name(raw):
    # "엘레이드(메가)¹\n2026년 9월 8일" → 이름 "메가 엘레이드", 변형 "1", 메모 "2026년 9월 8일"
    #
    # 이름 칸 하나에 네 가지가 섞여 들어오기 때문에 차례로 떼어낸다.
    #   ① 두 번째 줄 이후 = 메모 (출시 예정일 등)  ② '|' 뒤 = 메모  ③ 위 첨자 = 각주 번호(변형)
    #   ④ 괄호 안·공백 앞 토큰 = 폼 라벨
    lines = [line.strip() for line in raw.replace('\r', '').split('\n') if line.strip()]
    head, note = (lines[0] if lines else raw), ' '.join(lines[1:])
    # "엘레이드(메가) | 미출현" → 메모로 분리
    if '|' in head:
        head, extra = head.split('|', 1)
        note = (extra.strip() + ' ' + note).strip()
        head = head.strip()
    # 각주 위 첨자를 숫자 문자열로 바꾼다 ('¹' → '1'). 여러 개면 이어 붙는다
    variant = ''.join(SUPER.index(char) and str(SUPER.index(char)) or '0' for char in head if char in SUPER)
    # 변형을 뽑아낸 뒤 이름 본체에서는 위 첨자를 지운다
    head = ''.join(char for char in head if char not in SUPER).strip()
    labels = []
    # 괄호 안의 폼 표기를 모은다. 정규식 r'[\(（](.*?)[\)）]' 는 반각 '()' 와 전각 '（）' 를
    # 모두 받아들인다 — 시트가 둘을 섞어 쓴다. (.*?) 는 최소 일치라 괄호쌍마다 따로 잡힌다
    for group in re.findall(r'[\(（](.*?)[\)）]', head):
        # 괄호 하나에 폼이 여러 개 나열될 수 있다: "(메가X/메가Y)" → r'[,/]+' 로 분리
        for token in re.split(r'[,/]+', group):
            # FORM_MAP 키는 공백 없는 소문자 형태라 r'\s+' 로 공백을 모두 지워 맞춘다
            key = re.sub(r'\s+', '', token).lower()
            if key:
                labels.append(FORM_MAP.get(key, token.strip()))
    # 괄호 부분을 통째로 지워 종 이름만 남긴다
    head = re.sub(r'[\(（].*?[\)）]', '', head).strip()
    parts = head.split()
    # 맨 뒤 토큰이 종 이름, 그 앞의 토큰들은 '알로라 라이츄'처럼 앞에 붙는 폼 표기
    base = parts[-1] if parts else head
    for part in parts[:-1]:
        labels.append(FORM_MAP.get(part.lower(), part))
    # 섀도우는 폼 라벨이 아니라 이름 맨 앞 접두어라서 따로 처리한다
    shadow = '섀도우' in labels
    others = [label for label in labels if label and label != '섀도우']
    name = ' '.join(others + [base]).strip()
    name = ALIAS.get(name, name)
    return (f'섀도우 {name}' if shadow else name), variant, note

def parse(path):
    # CSV 한 장에는 속성별 표(블록)가 위에서 아래로 여러 개 이어져 있다.
    # 헤더 행을 만나면 새 블록이 시작된 것으로 보고 열 위치를 다시 잡는다
    rows = list(csv.reader(open(path, encoding='utf-8-sig')))
    report = [f'# {path}: {len(rows)} rows']
    blocks, columns, block = [], None, None
    for row_index, row in enumerate(rows):
        cells = [cell.strip() for cell in row]
        # 헤더 판정: 포켓몬·일반공격·DPS 세 열이 한 줄에 모두 있으면 헤더 행
        if HEADER['name'] in cells and HEADER['fast'] in cells and HEADER['dps'] in cells:
            # 헤더 셀은 '종합(%)▼'처럼 장식이 붙을 수 있어 접두 일치로 찾는다
            def find(label):
                for index, cell in enumerate(cells):
                    if cell == label or (len(label) > 1 and cell.startswith(label)):
                        return index
                return None
            # 시트 버전마다 열 순서·유무가 달라서 위치를 하드코딩하지 않고 매번 찾아낸다
            columns = {field: find(label) for field, label in HEADER.items()}
            columns = {field: index for field, index in columns.items() if index is not None}
            # '평가' 열이 '18열'처럼 이름 없이 오는 블록: 종합(%) 바로 오른쪽
            if 'tier' not in columns and 'score' in columns:
                columns['tier'] = columns['score'] + 1
            # 마지막 '전체' 표: 속성 열이 따로 있음
            if '속성' in cells:
                columns['type'] = cells.index('속성')
            if block:
                blocks.append(block)
            # marker = 이 블록의 속성 (0열 병합 셀에서 나중에 채워진다)
            block = {'marker': None, 'rows': [], 'overall': '속성' in cells}
            if len(blocks) == 0:
                report.append(f'row {row_index}: header cols {columns}')
            continue
        if not columns or not block:
            continue
        # 열이 잘려 짧은 행도 있어서 범위를 넘으면 빈 문자열로 취급한다
        def get(field):
            return cells[columns[field]] if field in columns and columns[field] < len(cells) else ''
        # 병합된 0열에 속성이 한 번만 적혀 있다 → 만났을 때 블록 속성으로 기억
        if cells and cells[0] in KO_TYPE:
            block['marker'] = KO_TYPE[cells[0]]
        if not get('name'):
            continue
        name, variant, note = parse_name(get('name'))
        fast, charged = get('fast'), get('charged')
        block['rows'].append({
            # raw는 시트 원문 그대로 보관 — 이름 매칭 실패 시 리포트와 폴백에 쓴다
            'raw': get('name'), 'name': name, 'variant': variant, 'note': note,
            # 기술명 뒤의 '*'는 이벤트 한정(엘리트) 기술 표시
            'fast': fast, 'charged': charged, 'elite': '*' in fast or '*' in charged,
            'fast_type': KO_TYPE.get(get('fast_type')), 'charged_type': KO_TYPE.get(get('charged_type')),
            'dps': num(get('dps')), 'tdo': num(get('tdo')), 'er': num(get('er')), 'score': num(get('score')),
            'dps_pct': num(get('dps_pct')), 'tdo_pct': num(get('tdo_pct')), 'tier': get('tier'), 'cp': num(get('cp')),
            'type': KO_TYPE.get(get('type')),
        })
    if block:
        blocks.append(block)
    sections = {}
    for block in blocks:
        if not block['rows']:
            continue
        # 맨 아래 '게임프레스 데이터 기준' 표는 다른 출처라 제외 (전체 탭은 자체 계산 유지)
        if block['overall']:
            report.append(f'skipped gamepress overall block ({len(block["rows"])} rows)')
            continue
        type_name = block['marker']
        if not type_name:
            # 병합 셀을 못 읽은 블록: 차징공격 타입의 최빈값을 그 블록의 속성으로 본다
            from collections import Counter
            counter = Counter(entry['charged_type'] for entry in block['rows'] if entry['charged_type'])
            type_name = counter.most_common(1)[0][0] if counter else 'unknown'
        # 종합(%)이 없는 행은 순위를 매길 수 없으므로 버린다
        scored_rows = [entry for entry in block['rows'] if entry['score'] is not None]
        for index, entry in enumerate(scored_rows):
            entry['rank'] = index + 1
        sections.setdefault(type_name, []).extend(scored_rows)
    report.append('sections: ' + ', '.join(f'{type_name}:{len(entries)}' for type_name, entries in sections.items()))
    return sections, report

def attach_meta(sheet):
    # 시트에는 이름·수치만 있고 스프라이트·타입·영문명이 없다 → pve_full.json의 메타에서 이름으로 붙인다.
    # 붙이지 못한 이름은 돌려줘서 리포트에 남긴다 (시트 표기가 바뀌면 여기서 드러난다)
    meta = json.load(open('data/pve_full.json', encoding='utf-8'))['meta'] if os.path.exists('data/pve_full.json') else {}
    meta_by_name = {entry['name']: entry for entry in meta.values()}
    unmatched = {}
    for type_name, entries in sheet.items():
        for entry in entries:
            matched = meta_by_name.get(entry['name'])
            # 시트에는 아직 게임에 안 나온 종도 실린다 → 프론트에서 [미출시] 태그를 달 수 있게 표시
            entry['released'] = entry['name'] in released_names
            if matched:
                entry['sprite'], entry['types'], entry['en'] = matched['sprite'], matched['types'], matched['en']
            else:
                # 미출시 메가 등: 기본 종 스프라이트로 대체
                base_species = meta_by_name.get(entry['name'].split()[-1])
                entry['sprite'], entry['types'], entry['en'] = (base_species['sprite'] if base_species else None), (base_species['types'] if base_species else []), (base_species['en'] if base_species else entry['raw'])
                unmatched[entry['name']] = entry['raw']
    return unmatched

if __name__ == '__main__':
    result, full_report = {}, []
    # data/sheet_<키>.csv 를 모두 처리한다. 파일 하나가 결과의 최상위 키 하나
    for filename in sorted(os.listdir('data')):
        if not (filename.startswith('sheet_') and filename.endswith('.csv')):
            continue
        key = filename[len('sheet_'):-4]
        try:
            parsed, file_report = parse(f'data/{filename}')
            unmatched = attach_meta(parsed)
            file_report.append(f'name not matched ({len(unmatched)}): ' + json.dumps(unmatched, ensure_ascii=False)[:1500])
            result[key] = parsed
        except Exception as error:
            # 시트 하나가 깨져도 나머지는 계속 처리하고, 실패 사실만 리포트에 남긴다
            file_report = [f'# {filename}: parse failed: {error!r}']
        full_report += file_report + ['']
    json.dump(result, open('data/sheet.json', 'w', encoding='utf-8'), ensure_ascii=False)
    open('data/sheet_report.txt', 'w', encoding='utf-8').write('\n'.join(full_report))
    print('\n'.join(full_report)[:2500])
