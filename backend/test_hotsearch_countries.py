import unittest
from hotsearch_build import country_rows, MIN_ROW_COUNT, MIN_ROWS, MIN_COUNTRY

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

if __name__ == '__main__':
    unittest.main()
