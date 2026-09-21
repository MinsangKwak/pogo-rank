# ─────────────────────────────────────────────────────────────────────────────
# test_gameday_build.py — 이벤트에 걸린 도감번호 뽑기 (2026-09-21 v4.9.1)
#
# 맥스 먼데이·맥스 배틀 데이는 extraData 에 그림이 없어 이름이 **제목에만** 있다.
# 그 길이 막히면 담아 둔 포켓몬이 그날 다이맥스로 올라와도 소식에 안 뜬다 (제보).
# ─────────────────────────────────────────────────────────────────────────────
import unittest

from backend.gameday_build import build_events, title_dex_numbers

# 실제 이름표의 일부만 (영문 소문자 → 도감번호)
EN = {'articuno': 144, 'zapdos': 145, 'moltres': 146, 'sobble': 816, 'cinderace': 815, 'sneasel': 215}


def event(kind, name, start='2026-09-21T11:00:00.000', end=None, extra=None):
    return {'eventID': 'x', 'name': name, 'eventType': kind, 'start': start,
            'end': end or start, 'extraData': extra if extra is not None else {'generic': {}}}


class TitleDexTests(unittest.TestCase):
    def test_three_names_in_one_title(self):
        # 제보에 걸린 그 제목이다
        self.assertEqual(title_dex_numbers('Dynamax Articuno, Zapdos, and Moltres during Max Monday', EN),
                         [144, 145, 146])

    def test_single_name(self):
        self.assertEqual(title_dex_numbers('Dynamax Sobble during Max Monday', EN), [816])

    def test_gigantamax_battle_day(self):
        self.assertEqual(title_dex_numbers('Gigantamax Cinderace Max Battle Day', EN), [815])

    # 종이 안 적힌 제목은 빈 값이다 — 없는 것을 지어내지 않는다
    def test_generic_title_has_none(self):
        self.assertEqual(title_dex_numbers('Dynamax Max Battle Day', EN), [])

    # 이름표에 없는 종은 버린다 (CLAUDE.md §3)
    def test_unknown_name_is_dropped(self):
        self.assertEqual(title_dex_numbers('Dynamax Wobbuffet during Max Monday', EN), [])
        self.assertEqual(title_dex_numbers('Dynamax Sneasel and Wobbuffet during Max Monday', EN), [215])


class BuildEventsTests(unittest.TestCase):
    def test_max_monday_gets_dex_from_title(self):
        rows = build_events([event('max-mondays', 'Dynamax Articuno, Zapdos, and Moltres during Max Monday')], EN)
        self.assertEqual(rows[0]['dex'], [144, 145, 146])

    # 제목에서 뽑는 길은 이 두 종류에만 연다 — 다른 이벤트 제목의 이름은 그 종이 나온다는 뜻이 아니다
    def test_other_types_keep_image_only(self):
        rows = build_events([event('event', 'Sobble Community Day Classic')], EN)
        self.assertNotIn('dex', rows[0])

    # 그림이 있으면 그것이 먼저다 (제목은 받쳐 주는 길)
    def test_image_wins_when_present(self):
        extra = {'spotlight': {'image': 'https://x/pm215.icon.png'}}
        rows = build_events([event('max-mondays', 'Dynamax Sobble during Max Monday', extra=extra)], EN)
        self.assertEqual(rows[0]['dex'], [215])


if __name__ == '__main__':
    unittest.main()
