#!/usr/bin/env python3
"""
앱 아이콘 생성 — `assets/app-icon-1024.png` 하나에서 iOS·Android 전부 만든다.

    python3 tools/make_app_icons.py

배경과 안전영역에 대한 판단 근거는 docs/12_APP_ICON.md §4 참조.
필요: Pillow (`pip3 install pillow`)
"""
from PIL import Image, ImageChops, ImageDraw
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'app-icon-1024.png')
RES = os.path.join(ROOT, 'app', 'android', 'app', 'src', 'main', 'res')
IOS = os.path.join(
    ROOT, 'app', 'ios', 'RouteFinding', 'Images.xcassets', 'AppIcon.appiconset'
)

DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
#: 적응형 아이콘 안전영역은 66/108(=61.1%). 조금 더 여유를 둔다.
SAFE = 0.58


def main() -> int:
    if not os.path.exists(SRC):
        print(f'원본이 없다: {SRC}', file=sys.stderr)
        return 1

    src = Image.open(SRC).convert('RGB')
    if src.size != (1024, 1024):
        print(f'경고: 원본이 1024x1024 가 아니다 ({src.size})', file=sys.stderr)

    background = src.getpixel((4, 4))

    # ── iOS: 1024 한 장이면 된다 (Xcode 가 나머지를 만든다) ──────────────
    os.makedirs(IOS, exist_ok=True)
    # ⚠️ RGB 로 저장 — 알파 채널이 있으면 애플이 업로드를 거부한다
    src.save(os.path.join(IOS, 'AppIcon.png'), optimize=True)
    with open(os.path.join(IOS, 'Contents.json'), 'w') as f:
        json.dump(
            {
                'images': [
                    {
                        'filename': 'AppIcon.png',
                        'idiom': 'universal',
                        'platform': 'ios',
                        'size': '1024x1024',
                    }
                ],
                'info': {'author': 'xcode', 'version': 1},
            },
            f,
            indent=2,
        )

    # ── Android: 원본에서 '내용'만 잘라 둔다 (적응형 전경용) ─────────────
    diff = ImageChops.difference(
        src, Image.new('RGB', src.size, background)
    ).convert('L')
    bbox = diff.point(lambda v: 255 if v > 28 else 0).getbbox()
    content = src.crop(bbox)

    for name, mult in DENSITIES.items():
        size = int(48 * mult)
        mip = os.path.join(RES, f'mipmap-{name}')
        os.makedirs(mip, exist_ok=True)

        square = src.resize((size, size), Image.LANCZOS)
        square.save(os.path.join(mip, 'ic_launcher.png'), optimize=True)

        # 원형(Android 7.1 이하에서 쓰인다) — 바깥은 투명
        round_icon = square.convert('RGBA')
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        round_icon.putalpha(mask)
        round_icon.save(os.path.join(mip, 'ic_launcher_round.png'), optimize=True)

        # 적응형 전경: 배경색으로 채우고 내용만 안전영역에 (docs/12 §4)
        fg_size = int(108 * mult)
        canvas = Image.new('RGB', (fg_size, fg_size), background)
        scale = (fg_size * SAFE) / max(content.size)
        w, h = (max(1, int(content.size[0] * scale)), max(1, int(content.size[1] * scale)))
        canvas.paste(
            content.resize((w, h), Image.LANCZOS),
            ((fg_size - w) // 2, (fg_size - h) // 2),
        )
        drw = os.path.join(RES, f'drawable-{name}')
        os.makedirs(drw, exist_ok=True)
        canvas.convert('RGBA').save(
            os.path.join(drw, 'ic_launcher_foreground.png'), optimize=True
        )

    anydpi = os.path.join(RES, 'mipmap-anydpi-v26')
    os.makedirs(anydpi, exist_ok=True)
    # monochrome 은 일부러 뺐다 — 전경이 불투명이라 테마 아이콘이 통짜가 된다
    xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background" />\n'
        '    <foreground android:drawable="@drawable/ic_launcher_foreground" />\n'
        '</adaptive-icon>\n'
    )
    for f in ('ic_launcher.xml', 'ic_launcher_round.xml'):
        with open(os.path.join(anydpi, f), 'w') as fp:
            fp.write(xml)

    values = os.path.join(RES, 'values')
    os.makedirs(values, exist_ok=True)
    with open(os.path.join(values, 'ic_launcher_background.xml'), 'w') as fp:
        fp.write(
            '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
            f'    <color name="ic_launcher_background">#{background[0]:02X}'
            f'{background[1]:02X}{background[2]:02X}</color>\n</resources>\n'
        )

    print(f'배경색 #{background[0]:02X}{background[1]:02X}{background[2]:02X} · 내용 {bbox}')
    print('iOS 1개 + Android 20개 생성 완료')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
