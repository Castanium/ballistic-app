"""Captures d'ecran rapides. Usage : uv run --no-project --with playwright python tests/shot.py URL out.png [w h] [js]"""
import sys, asyncio
from playwright.async_api import async_playwright
async def main():
    url, out = sys.argv[1], sys.argv[2]
    w, h = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (390, 844)
    js = sys.argv[5] if len(sys.argv) > 5 else None
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="msedge")
        pg = await b.new_page(viewport={"width": w, "height": h}, device_scale_factor=2, has_touch=True, is_mobile=w < 900)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
        await pg.goto(url); await pg.wait_for_timeout(1800)
        if js: print(await pg.evaluate(js)); await pg.wait_for_timeout(400)
        await pg.screenshot(path=out, full_page="--full" in sys.argv)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
