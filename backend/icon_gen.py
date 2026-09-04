# 2026-09-03 PWA 아이콘 생성기 (표준 라이브러리만): 어두운 바탕 + 몬스터볼 라인 아이콘
# 한 번 실행해 frontend/static/icon-192.png, icon-512.png 를 만든다 (빌드마다 재생성하지 않음)
#
# 입력 : 없음. 크기와 색만으로 픽셀을 직접 계산한다 (Pillow 같은 외부 의존성을 쓰지 않으려고 PNG를 손으로 쓴다)
# 출력 : frontend/static/icon-192.png, frontend/static/icon-512.png (manifest 의 PWA 아이콘)
# 관계 : 빌드 파이프라인과 분리되어 있다. 아이콘 모양이나 테마 색을 바꿀 때만 다시 실행한다.

import struct
import zlib
import os

# 프런트 다크 테마의 CSS 변수와 같은 값을 쓴다 (RGBA)
BACKGROUND_COLOR = (18, 19, 21, 255)       # --bg 다크
FOREGROUND_COLOR = (236, 237, 238, 255)    # --fg 다크


# size × size 몬스터볼 아이콘을 그려 PNG 원본 스캔라인 바이트를 돌려준다.
# 반환값은 각 줄 앞에 필터 바이트가 붙은 RGBA 픽셀 열이라 그대로 IDAT 에 압축해 넣을 수 있다.
def render_raw_scanlines(size):
    center_x = center_y = size / 2
    outer_radius = size * 0.30      # maskable 안전영역(중앙 60%) 안에 들어가게
    stroke_width = size * 0.055     # 원·가로줄·버튼에 공통으로 쓰는 선 두께
    button_radius = size * 0.085    # 가운데 버튼 원의 반지름
    raw_scanlines = bytearray()
    for y in range(size):
        scanline = bytearray([0])  # 필터 없음
        for x in range(size):
            # 픽셀 중심(+0.5)을 기준으로 재야 좌우·상하가 대칭이 된다
            delta_x = x - center_x + 0.5
            delta_y = y - center_y + 0.5
            distance = (delta_x * delta_x + delta_y * delta_y) ** 0.5
            color = BACKGROUND_COLOR
            # 바깥 원: 반지름에서 선 두께의 절반 안쪽까지
            on_outer_ring = abs(distance - outer_radius) < stroke_width / 2
            # 가운데 가로줄: 원 안쪽에서만 그리고, 버튼 주변은 살짝 여유(0.9)를 두고 비운다
            on_center_band = abs(delta_y) < stroke_width / 2 and distance < outer_radius and abs(delta_x) > button_radius + stroke_width * 0.9
            # 가운데 버튼 테두리
            on_button = abs(distance - button_radius) < stroke_width / 2
            if on_outer_ring or on_center_band or on_button:
                color = FOREGROUND_COLOR
            scanline.extend(color)
        raw_scanlines.extend(scanline)
    return bytes(raw_scanlines)


# size × size 아이콘을 그려 path 에 PNG 파일로 저장한다 (헤더·청크를 직접 만든다)
def write_png(size, path):
    raw_scanlines = render_raw_scanlines(size)

    # PNG 청크 = 길이(4바이트) + 타입 + 데이터 + CRC32(타입+데이터)
    def make_chunk(chunk_type, chunk_data):
        return struct.pack('>I', len(chunk_data)) + chunk_type + chunk_data + struct.pack('>I', zlib.crc32(chunk_type + chunk_data))

    # IHDR: 너비, 높이, 비트depth 8, 컬러타입 6(RGBA), 압축·필터·인터레이스 0
    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png_bytes = b'\x89PNG\r\n\x1a\n' + make_chunk(b'IHDR', ihdr_data) + make_chunk(b'IDAT', zlib.compress(raw_scanlines, 9)) + make_chunk(b'IEND', b'')
    open(path, 'wb').write(png_bytes)
    print(path, len(png_bytes), 'bytes')


os.makedirs('frontend/static', exist_ok=True)
write_png(192, 'frontend/static/icon-192.png')
write_png(512, 'frontend/static/icon-512.png')
