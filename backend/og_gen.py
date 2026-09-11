# ─────────────────────────────────────────────────────────────────────────────
# og_gen.py — 공유 미리보기(OG) 이미지 생성기 (2026-09-08 v2.27.0)
#
# 무엇을 만드나
#   frontend/static/og.png  1200 × 630, 도트(픽셀아트) 스타일.
#   카카오톡·디스코드·X 에 링크를 붙이면 이 그림이 카드로 뜬다.
#
# 왜 도트인가
#   서비스가 다루는 게임의 도감 스프라이트가 전부 픽셀 그림이다. 미리보기만 매끈한 벡터면
#   링크를 눌러 들어온 화면과 결이 어긋난다. 글자까지 5×7 픽셀 폰트로 직접 찍어 한 벌로 맞춘다.
#
# 왜 외부 라이브러리를 안 쓰나
#   icon_gen.py 와 같은 이유 — 이 저장소는 파이썬 표준 라이브러리만 쓴다(README 의 약속).
#   PNG 는 청크 몇 개라 손으로 쓸 수 있다. Pillow 를 들이면 빌드 환경이 무거워진다.
#
# 언제 다시 실행하나
#   빌드마다 돌리지 않는다. 문구·색·모양을 바꿀 때만 손으로 실행해 결과를 커밋한다.
#     python3 backend/og_gen.py
# ─────────────────────────────────────────────────────────────────────────────

import struct
import zlib
import os

WIDTH, HEIGHT = 1200, 630
CELL = 6                      # 도트 한 칸 = 6px. 200 × 105 칸짜리 격자가 된다

# 다크 테마 토큰과 같은 값 (frontend/styles/tokens.css)
# 2026-09-12 v3.7.0 팔레트가 두 번 바뀌는 동안(v3.0.0 인디고 · v3.7.0 몬스터볼 빨강)
# 이 파일만 v2 시절 초록에 멈춰 있었다. 공유 카드가 서비스와 다른 색이면 눌러 들어온 순간 어긋난다
BG = (10, 10, 15)             # --bg 다크 (잉크블랙)
FG = (245, 245, 250)          # --fg 다크
MUTED = (139, 139, 163)       # --muted 다크
ACCENT = (255, 95, 82)        # --accent 다크 — 몬스터볼 빨강
LINE = (38, 38, 58)           # --line 다크
BALL_RED = (229, 55, 46)      # --brand 라이트 (#e5372e) — 공의 위 절반은 원작 그대로

# 5×7 픽셀 글꼴 — 필요한 글자만 직접 찍는다. 각 줄의 '#' 이 켜진 픽셀
FONT = {
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'C': ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'G': ['.####', '#....', '#....', '#..##', '#...#', '#...#', '.####'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'N': ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
}


def blank():
    return [[BG for _ in range(WIDTH)] for _ in range(HEIGHT)]


# 도트 격자 좌표(칸 단위)에 사각형을 찍는다 — 픽셀이 아니라 칸으로 생각해야 도트가 어긋나지 않는다
def cell_rect(canvas, cx, cy, cw, ch, color):
    for y in range(cy * CELL, min((cy + ch) * CELL, HEIGHT)):
        row = canvas[y]
        for x in range(cx * CELL, min((cx + cw) * CELL, WIDTH)):
            row[x] = color


# 5×7 글꼴로 문자열을 찍는다. scale 은 글자 한 픽셀이 차지하는 칸 수
def draw_text(canvas, text, cx, cy, scale, color, spacing=1):
    pen = cx
    for char in text.upper():
        glyph = FONT.get(char)
        if glyph is None:
            pen += (5 + spacing) * scale
            continue
        for row_index, row in enumerate(glyph):
            for col_index, mark in enumerate(row):
                if mark == '#':
                    cell_rect(canvas, pen + col_index * scale, cy + row_index * scale, scale, scale, color)
        pen += (5 + spacing) * scale
    return pen


# 몬스터볼 — icon_gen.py 와 같은 모양이되 도트 격자에 맞춰 계단지게 그린다.
# 매끈한 원을 그리면 이 이미지 안에서 그것만 튄다.
# 2026-09-12 v3.7.0 선으로만 그리던 것을 **채운다** — 위 빨강 · 아래 흰색 · 가운데 검은 띠.
# 카카오톡·디스코드 미리보기는 작게 뜨는데, 선으로만 그린 공은 그 크기에서 그냥 동그라미다
def draw_ball(canvas, center_cx, center_cy, radius_cells):
    stroke = max(2, radius_cells // 7)
    button = max(2, radius_cells // 3)
    for cy in range(center_cy - radius_cells - 1, center_cy + radius_cells + 2):
        for cx in range(center_cx - radius_cells - 1, center_cx + radius_cells + 2):
            dx, dy = cx - center_cx + 0.5, cy - center_cy + 0.5
            dist = (dx * dx + dy * dy) ** 0.5
            if dist > radius_cells + stroke / 2:
                continue
            # 안쪽부터 바깥으로 한 겹씩 — 나중에 칠한 것이 위로 온다
            color = BALL_RED if dy < 0 else FG
            on_ring = abs(dist - radius_cells) < stroke / 2
            on_band = abs(dy) < stroke / 2 and dist < radius_cells and abs(dx) > button + stroke * 0.4
            on_button_ring = abs(dist - button) < stroke / 2
            if on_ring or on_band or on_button_ring:
                color = BG            # 테두리·띠는 바탕색 — 공만 떠 보인다
            elif dist < button:
                color = FG            # 단추 속은 흰색
            cell_rect(canvas, cx, cy, 1, 1, color)


def write_png(canvas, path):
    raw = bytearray()
    for row in canvas:
        raw.append(0)                       # 필터 없음
        for r, g, b in row:
            raw.extend((r, g, b))

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))

    ihdr = struct.pack('>IIBBBBB', WIDTH, HEIGHT, 8, 2, 0, 0, 0)   # 컬러타입 2 = RGB (투명도 불필요)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)
    print(path, f'{len(png) / 1024:.0f}KB')


def main():
    canvas = blank()
    cols, rows = WIDTH // CELL, HEIGHT // CELL      # 200 × 105 칸

    # 테두리 한 줄 — 카드가 어두운 배경에 묻히지 않게
    cell_rect(canvas, 0, 0, cols, 1, LINE)
    cell_rect(canvas, 0, rows - 1, cols, 1, LINE)
    cell_rect(canvas, 0, 0, 1, rows, LINE)
    cell_rect(canvas, cols - 1, 0, 1, rows, LINE)

    # 왼쪽: 서비스 이름 두 줄
    draw_text(canvas, 'POGO', 12, 30, 3, FG)
    draw_text(canvas, 'PLAN', 12, 55, 3, ACCENT)

    # 이름 아래 밑줄 — 화면의 강조선과 같은 뜻
    cell_rect(canvas, 12, 78, 76, 1, LINE)

    # 한 줄 설명은 한글이라 픽셀 글꼴로 찍을 수 없다(자모 조합이 필요하다).
    # 없는 글자를 억지로 그리는 대신 점선 한 줄로 자리를 표시하고, 문구는 og:description 이 맡는다
    for i in range(14):
        cell_rect(canvas, 12 + i * 5, 85, 3, 2, MUTED)

    # 오른쪽: 몬스터볼
    draw_ball(canvas, cols - 42, rows // 2, 26)

    os.makedirs('frontend/static', exist_ok=True)
    write_png(canvas, 'frontend/static/og.png')


if __name__ == '__main__':
    main()
