"""Genere tests/reference_pybc.json avec py-ballisticcalc (solveur independant).
Usage : uv run --no-project --with py-ballisticcalc python tools/reference_pybc.py
Conventions converties : cadran h (12h = face, 3h = de droite) -> direction_from = 180 + 30h deg."""
import json, os
from py_ballisticcalc import (Calculator, Shot, Weapon, Ammo, Atmo, Wind, DragModel,
                              TableG1, TableG7, Distance, Velocity, Temperature, Angular, Unit)
CASES = [
    dict(name="ref308_G7", table="G7", bc=0.243, mv_fps=2600, wind_kmh=10, clock=3, alt=0, temp=15),
    dict(name="ref308_G1", table="G1", bc=0.505, mv_fps=2600, wind_kmh=10, clock=3, alt=0, temp=15),
    dict(name="65cm_hot_alt", table="G7", bc=0.326, mv_fps=2710, wind_kmh=15, clock=10, alt=1500, temp=30),
    dict(name="308_cold_head", table="G7", bc=0.243, mv_fps=2600, wind_kmh=20, clock=12, alt=0, temp=-10),
]
out = []
for c in CASES:
    dm = DragModel(c["bc"], TableG7 if c["table"] == "G7" else TableG1)
    atmo = Atmo(altitude=Distance.Meter(c["alt"]), temperature=Temperature.Celsius(c["temp"]), humidity=0)
    weapon = Weapon(sight_height=Distance.Centimeter(5), twist=0)
    ammo = Ammo(dm, Velocity.FPS(c["mv_fps"]))
    calc = Calculator()
    zero = Shot(weapon=weapon, ammo=ammo, atmo=atmo)
    calc.set_weapon_zero(zero, Distance.Meter(100))
    shot = Shot(weapon=weapon, ammo=ammo, atmo=atmo,
                winds=[Wind(Velocity.KMH(c["wind_kmh"]), Angular.Degree(180 + 30 * c["clock"]))])
    res = calc.fire(shot, trajectory_range=Distance.Meter(1000), trajectory_step=Distance.Meter(100))
    rows = []
    for r in res.trajectory:
        d = r.distance >> Distance.Meter
        if d < 50: continue
        rows.append(dict(distance=round(d, 3), y_cm=r.height >> Distance.Centimeter,
                         z_cm=r.windage >> Distance.Centimeter, v_ms=r.velocity >> Velocity.MPS, tof=r.time))
    out.append(dict(case=c, pressure_hPa=atmo.pressure >> Unit.hPa, rows=rows))
p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tests", "reference_pybc.json")
json.dump(out, open(p, "w"), indent=1)
for o in out:
    print(o["case"]["name"], round(o["pressure_hPa"], 2))
    for r in o["rows"]: print("  %6.1f  y=%8.2f  z=%7.2f  v=%6.1f" % (r["distance"], r["y_cm"], r["z_cm"], r["v_ms"]))
