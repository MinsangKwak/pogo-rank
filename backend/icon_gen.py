import struct, zlib, os
# 2026-09-03 PWA 아이콘 생성기 (표준 라이브러리만): 어두운 바탕 + 몬스터볼 라인 아이콘
# 한 번 실행해 frontend/static/icon-192.png, icon-512.png 를 만든다 (빌드마다 재생성하지 않음)

BG = (18, 19, 21, 255)       # --bg 다크
FG = (236, 237, 238, 255)    # --fg 다크

def draw(size):
    cx = cy = size / 2
    R = size * 0.30          # maskable 안전영역(중앙 60%) 안에 들어가게
    stroke = size * 0.055
    r_btn = size * 0.085
    px = bytearray()
    for y in range(size):
        row = bytearray([0])  # 필터 없음
        for x in range(size):
            dx, dy = x - cx + 0.5, y - cy + 0.5
            d = (dx * dx + dy * dy) ** 0.5
            c = BG
            ring = abs(d - R) < stroke / 2
            band = abs(dy) < stroke / 2 and d < R and abs(dx) > r_btn + stroke * 0.9
            btn = abs(d - r_btn) < stroke / 2
            if ring or band or btn: c = FG
            row.extend(c)
        px.extend(row)
    return bytes(px)

def png(size, path):
    raw = draw(size)
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    out = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(out)
    print(path, len(out), 'bytes')

os.makedirs('frontend/static', exist_ok=True)
png(192, 'frontend/static/icon-192.png')
png(512, 'frontend/static/icon-512.png')
