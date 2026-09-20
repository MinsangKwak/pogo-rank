import unittest
from hotsearch_build import country_rows

def row(name, country, count):
    return {'dimensionValues': [{'value': name}, {'value': country}], 'metricValues': [{'value': str(count)}]}

class CountrySearchTests(unittest.TestCase):
    def test_country_totals_include_rows_outside_top_ten(self):
        data = [row('포켓몬'+str(i), 'KR', i+1) for i in range(12)]
        result = country_rows(data + [row('피카츄', 'US', 3)], {})
        self.assertEqual(result[0]['total'], 78)
        self.assertEqual(len(result[0]['rows']), 10)
        self.assertEqual(result[0]['rows'][0]['count'], 12)
        self.assertEqual(result[1]['code'], 'US')
    def test_invalid_rows_are_not_exposed(self):
        self.assertEqual(country_rows([{}, row('(not set)', 'KR', 4), row('피카츄', '(not set)', 4), row('피카츄', 'KR', 'nan'), row('피카츄', 'KR', -1)], {}), [])

if __name__ == '__main__':
    unittest.main()
