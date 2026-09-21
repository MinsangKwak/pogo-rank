# schedule_build.py 검사 — python3 -m unittest backend.test_schedule_build
# 원본 한 줄이 달력 한 줄로 어떻게 바뀌는지 손으로 적은 예로 고정한다. 이름은 지어내지 않고 못 찾으면 영문 그대로임을 함께 본다
import unittest
from datetime import date

from backend.schedule_build import Namer, build_months, merge_snapshot, month_slices, normalize, split_names

NAMES = {'144': '프리져', '145': '썬더', '146': '파이어', '487': '기라티나', '642': '볼트로스', '6': '리자몽', '816': '울머기', '570': '조로아'}
FORMS = {'816': {'types': ['water']}, '144': {'types': ['ice', 'flying']}}
ENGLISH = {'articuno': 144, 'zapdos': 145, 'moltres': 146, 'giratina': 487, 'thundurus': 642, 'charizard': 6, 'sobble': 816, 'zorua': 570}
NAMER = Namer(NAMES, FORMS, ENGLISH)


def event(kind, name, start, end, event_id='x', extra=None):
    return {'eventType': kind, 'name': name, 'start': start, 'end': end, 'eventID': event_id, 'extraData': extra or {}}


class NamerTest(unittest.TestCase):
    def test_split_oxford_comma(self):
        self.assertEqual(split_names('Articuno, Zapdos, and Moltres'), ['Articuno', 'Zapdos', 'Moltres'])
        self.assertEqual(split_names('Xerneas and Yveltal'), ['Xerneas', 'Yveltal'])

    def test_prefix_and_form(self):
        self.assertEqual(NAMER.korean('Mega Charizard X'), ('메가X 리자몽', 6))
        self.assertEqual(NAMER.korean('Giratina (Origin Forme)'), ('기라티나 (오리진폼)', 487))
        self.assertEqual(NAMER.korean('Giratina (Origin)'), ('기라티나 (오리진폼)', 487))
        self.assertEqual(NAMER.korean('Dynamax Sobble'), ('다이맥스 울머기', 816))

    def test_unknown_is_none(self):
        # 이름표에 없으면 None — 한글을 지어내지 않는다
        self.assertIsNone(NAMER.korean('Pikachu'))
        self.assertIsNone(NAMER.korean('Mega Pikachu'))


class NormalizeTest(unittest.TestCase):
    def test_max_monday_spans_the_week_with_type(self):
        row = normalize(event('max-mondays', 'Dynamax Sobble during Max Monday', '2026-09-28T06:00:00.000', '2026-09-28T21:00:00.000'), NAMER)
        self.assertEqual((row['cat'], row['start'], row['end'], row['t']), ('dmax', '2026-09-28', '2026-10-04', 'water'))
        self.assertEqual(row['label'], 'D-MAX 울머기 (맥스 먼데이 9/28)')

    def test_max_monday_trio(self):
        row = normalize(event('max-mondays', 'Dynamax Articuno, Zapdos, and Moltres during Max Monday', '2026-09-21T06:00:00.000', '2026-09-21T21:00:00.000'), NAMER)
        self.assertEqual(row['label'], 'D-MAX 프리져 · 썬더 · 파이어 (맥스 먼데이 9/21)')
        self.assertEqual(row['t'], 'ice')

    def test_shadow_raid_gets_prefix(self):
        extra = {'raidbattles': {'bosses': [{'name': 'Thundurus (Incarnate)'}]}}
        row = normalize(event('raid-battles', 'Shadow Thundurus (Incarnate Forme) in Shadow Raids', '2026-09-09T06:00:00.000', '2026-10-06T22:00:00.000', extra=extra), NAMER)
        self.assertEqual((row['cat'], row['label']), ('shadow', '주말 섀도우 레이드: 섀도우 볼트로스 (화신폼)'))

    def test_unknown_boss_keeps_english_title(self):
        extra = {'raidbattles': {'bosses': [{'name': 'Pikachu'}]}}
        row = normalize(event('raid-battles', 'Pikachu in 5-star Raid Battles', '2026-09-09T06:00:00.000', '2026-09-10T22:00:00.000', extra=extra), NAMER)
        self.assertEqual((row['cat'], row['label']), ('raid5', 'Pikachu in 5-star Raid Battles'))

    def test_community_day_and_raid_day(self):
        extra = {'communityday': {'spawns': [{'name': 'Zorua'}]}}
        self.assertEqual(normalize(event('community-day', 'Zorua Community Day', '2026-10-10T14:00:00.000', '2026-10-10T17:00:00.000', extra=extra), NAMER)['label'], '커뮤니티 데이: 조로아')
        self.assertEqual(normalize(event('community-day', 'November Community Day', '2026-11-21T14:00:00.000', None), NAMER)['label'], '11월 커뮤니티 데이')
        self.assertEqual(normalize(event('raid-day', 'Super Mega Raid Day', '2026-10-31T14:00:00.000', None), NAMER)['label'], '슈퍼 메가 레이드 데이')
        # 종을 못 찾으면 영문 그대로
        self.assertEqual(normalize(event('raid-day', 'Staraptor Super Mega Raid Day', '2026-09-19T14:00:00.000', None), NAMER)['label'], 'Staraptor Super Mega Raid Day')

    def test_skips(self):
        self.assertIsNone(normalize(event('go-battle-league', 'Great League', '2026-09-15T20:00:00.000Z', None), NAMER))
        self.assertIsNone(normalize(event('event', '???', '2026-10-04T10:00:00.000', None), NAMER))
        self.assertIsNone(normalize(event('raid-day', 'Staraptor Super Mega Raid Day', None, None), NAMER))


class MonthTest(unittest.TestCase):
    def test_slices_across_months(self):
        row = {'start': '2026-09-29', 'end': '2026-10-05'}
        self.assertEqual(list(month_slices(row)), [('2026-09', 29, 30), ('2026-10', 1, 5)])

    def test_build_months_shape(self):
        rows = {'a': {'start': '2026-09-28', 'end': '2026-10-04', 'cat': 'dmax', 'label': 'D-MAX 울머기 (맥스 먼데이 9/28)', 't': 'water'},
                'b': {'start': '2026-10-02', 'end': '2026-10-02', 'cat': 'event', 'label': 'Patterns of the Wild'}}
        months = build_months(rows, '2026-09-21')
        self.assertEqual(list(months), ['2026-09', '2026-10'])
        self.assertEqual(months['2026-10']['ym'], {'y': 2026, 'm': 10})
        self.assertEqual(months['2026-10']['items'], [
            {'s': 2, 'e': 2, 'cat': 'event', 'label': 'Patterns of the Wild', 'auto': True},
            {'s': 1, 'e': 4, 'cat': 'dmax', 'label': 'D-MAX 울머기 (맥스 먼데이 9/28)', 'auto': True, 't': 'water'},
        ])

    def test_snapshot_keeps_recent_and_drops_old(self):
        previous = {'old': {'end': '2026-01-01', 'label': 'x'}, 'seen': {'end': '2026-09-01', 'label': 'y'}, 'blank': {'end': '2026-09-15', 'label': '???'}}
        fresh = {'seen': {'end': '2026-09-02', 'label': 'y2'}, 'new': {'end': '2026-10-01', 'label': 'z'}}
        merged = merge_snapshot(previous, fresh, date(2026, 9, 21))
        self.assertEqual(sorted(merged), ['new', 'seen'])
        self.assertEqual(merged['seen']['label'], 'y2')


if __name__ == '__main__':
    unittest.main()
