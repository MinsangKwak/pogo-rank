import unittest
from hotsearch_build import country_rows, pick_rows, MIN_ROW_COUNT, MIN_ROWS, MIN_COUNTRY, WINDOWS

def row(name, country, count):
    return {'dimensionValues': [{'value': name}, {'value': country}], 'metricValues': [{'value': str(count)}]}

class CountrySearchTests(unittest.TestCase):
    def test_country_totals_include_rows_outside_top_ten(self):
        # 1·2회짜리 둘은 줄 문턱(3)에 걸려 합에서도 빠진다 — 3..12 의 합 75
        data = [row('포켓몬'+str(i), 'KR', i+1) for i in range(12)]
        result = country_rows(data, {})
        self.assertEqual(result[0]['total'], 75)
        self.assertEqual(len(result[0]['rows']), 10)
        self.assertEqual(result[0]['rows'][0]['count'], 12)

    # "많이 검색해야 나타난다" — 줄 하나로는 나라가 못 선다
    def test_country_needs_enough_rows_and_total(self):
        self.assertEqual(country_rows([row('피카츄', 'US', 3)], {}), [])
        few = [row('포켓몬'+str(i), 'JP', MIN_ROW_COUNT) for i in range(MIN_ROWS - 1)]
        self.assertEqual(country_rows(few, {}), [])
        enough = [row('포켓몬'+str(i), 'JP', MIN_COUNTRY) for i in range(MIN_ROWS)]
        self.assertEqual([g['code'] for g in country_rows(enough, {})], ['JP'])
    def test_invalid_rows_are_not_exposed(self):
        self.assertEqual(country_rows([{}, row('(not set)', 'KR', 4), row('피카츄', '(not set)', 4), row('피카츄', 'KR', 'nan'), row('피카츄', 'KR', -1)], {}), [])

class GlobalSearchTests(unittest.TestCase):
    def one(self, name, count):
        return {'dimensionValues': [{'value': name}], 'metricValues': [{'value': str(count)}]}

    # 줄이 MIN_ROWS 에 못 미치면 표를 통째로 비운다 — main 은 그때 다음 창(7일)으로 넓힌다
    def test_too_few_rows_empties_the_table(self):
        few = [self.one('포켓몬'+str(i), MIN_ROW_COUNT) for i in range(MIN_ROWS - 1)]
        self.assertEqual(pick_rows(few, {}), [])
        enough = few + [self.one('뮤츠', MIN_ROW_COUNT)]
        self.assertEqual(len(pick_rows(enough, {})), MIN_ROWS)

    def test_low_counts_and_not_set_are_dropped(self):
        rows = [self.one('(not set)', 50), self.one('피카츄', MIN_ROW_COUNT - 1)] + [self.one('포켓몬'+str(i), 9) for i in range(3)]
        self.assertEqual([r['name'] for r in pick_rows(rows, {})], ['포켓몬0', '포켓몬1', '포켓몬2'])

    # 하루 → 일주일 순서다. 뒤집히면 늘 일주일 창만 쓰게 된다
    def test_windows_widen(self):
        self.assertEqual([w for w, _ in WINDOWS], ['1d', '7d'])

if __name__ == '__main__':
    unittest.main()
