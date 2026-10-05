// Tests du moteur (sans DOM). Usage : node tests/core.test.js
// Extrait le bloc <script id="core"> de index.html : on teste exactement le code livre.
const fs = require('fs'), path = require('path'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const Core = new Function(src + ';return Core;')();
const { Units, CLICKS, clicksFor, solve, buildInput, Profiles, defaultSession, ReticleState,
        calibrateBC, CalibrationPoint, Storage, migrate, BallisticProfile, CONFIG } = Core;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'reference_pybc.json'), 'utf8'));

let pass = 0, fail = 0;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
function test(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const ref308 = () => buildInput(Profiles.defaults()[0], defaultSession());
const mil = r => Units.fromSI(r, 'MIL'), moa = r => Units.fromSI(r, 'MOA');

console.log('Conversions');
test('3. fps -> m/s', () => { near(Units.convert(2600, 'fps', 'm/s'), 792.48, 1e-9, '2600 fps'); });
test('4. m/s -> fps', () => { near(Units.convert(800, 'm/s', 'fps'), 2624.6719, 1e-4, '800 m/s'); near(Units.convert(Units.convert(2710, 'fps', 'm/s'), 'm/s', 'fps'), 2710, 1e-9, 'aller-retour'); });
test('m <-> yards', () => { near(Units.convert(500, 'm', 'yd'), 546.8066, 1e-4, '500 m'); near(Units.convert(1000, 'yd', 'm'), 914.4, 1e-9, '1000 yd'); });
test('5. MOA -> MIL', () => { near(Units.convert(1, 'MOA', 'MIL'), 0.2908882, 1e-7, '1 MOA'); near(Units.convert(10, 'MOA', 'MIL'), 2.908882, 1e-6, '10 MOA'); });
test('6. MIL -> MOA', () => { near(Units.convert(1, 'MIL', 'MOA'), 3.4377468, 1e-7, '1 MIL'); });
test('7. cm -> MOA', () => {
  near(moa(Units.offsetToAngle(0.02908882, 100)), 1, 1e-6, '2.909 cm @100 m = 1 MOA');
  near(moa(Units.offsetToAngle(0.10, 100)), 3.4377, 1e-3, '10 cm @100 m');
  near(Units.angleToOffset(Units.toSI(1, 'MOA'), 500) * 100, 14.5444, 1e-3, '1 MOA @500 m en cm');
});
test('8. cm -> MIL', () => {
  near(mil(Units.offsetToAngle(0.10, 100)), 1, 1e-6, '10 cm @100 m = 1 MIL (atan, ecart 3e-7)');
  near(mil(Units.offsetToAngle(0.50, 500)), 1, 1e-6, '50 cm @500 m');
  near(Units.angleToOffset(Units.toSI(1, 'MIL'), 300) * 100, 30, 1e-4, '1 MIL @300 m = 30 cm');
});
test('temperature C <-> F', () => { near(Units.tempFromK(Units.tempToK(15, 'C'), 'F'), 59, 1e-9, '15C'); near(Units.tempToK(-40, 'F'), 233.15, 1e-9, '-40F'); });
test('9-12. valeurs de clic derivees de l\'unite', () => {
  near(CLICKS.moa_1_4.rad, Units.toSI(0.25, 'MOA'), 1e-15, '1/4 MOA');
  near(CLICKS.moa_1_8.rad, Units.toSI(0.125, 'MOA'), 1e-15, '1/8 MOA');
  near(CLICKS.mil_0_1.rad, 1e-4, 1e-15, '0.1 MIL');
  near(CLICKS.mil_0_2.rad, 2e-4, 1e-15, '0.2 MIL');
  const r = Units.toSI(4.0178, 'MIL');
  assert.strictEqual(clicksFor(r, 'mil_0_1'), 40); assert.strictEqual(clicksFor(r, 'mil_0_2'), 20);
  assert.strictEqual(clicksFor(r, 'moa_1_4'), Math.round(mil(r) * 3.4377468 / 0.25)); // 55
  assert.strictEqual(clicksFor(r, 'moa_1_8'), 110);
  assert.strictEqual(clicksFor(-r, 'mil_0_1'), -40);
});

console.log('Moteur balistique');
const cmpRef = (refCase, tolCm) => {
  const c = refCase.case;
  const inp = Core.BallisticInput({ mv: Units.toSI(c.mv_fps, 'fps'), bc: c.bc, dragModel: c.table, distance: 0,
    windSpeed: Units.toSI(c.wind_kmh, 'km/h'), windClock: c.clock, altitude: c.alt, temperature: Units.tempToK(c.temp, 'C'),
    zeroDistance: 100, sightHeight: 0.05, zeroAltitude: c.alt, zeroTemperature: Units.tempToK(c.temp, 'C') });
  for (const row of refCase.rows) {
    const s = solve({ ...inp, distance: row.distance });
    assert.ok(s.ok, 'solve ok @' + row.distance);
    const tol = tolCm * Math.max(1, row.distance / 500);
    near(s.drop * 100, row.y_cm, tol, `${c.name} chute @${row.distance} m`);
    near(s.drift * 100, row.z_cm, tol, `${c.name} derive @${row.distance} m`);
    near(s.velocity, row.v_ms, 0.5, `${c.name} vitesse @${row.distance} m`);
  }
};
test('1. G1 vs py-ballisticcalc (0-1000 m)', () => cmpRef(REF.find(r => r.case.name === 'ref308_G1'), 0.5));
test('2. G7 vs py-ballisticcalc (0-1000 m)', () => cmpRef(REF.find(r => r.case.name === 'ref308_G7'), 0.5));
test('G7 altitude 1500 m / 30 C / vent 10h vs py-ballisticcalc', () => cmpRef(REF.find(r => r.case.name === '65cm_hot_alt'), 0.5));
test('G7 froid -10 C / vent de face vs py-ballisticcalc', () => cmpRef(REF.find(r => r.case.name === '308_cold_head'), 0.5));
test('Reference .308 G7 0.243 2600 fps 500 m 10 km/h travers : plausible', () => {
  const s = solve(ref308());
  assert.ok(s.ok);
  near(mil(s.elevRad), 4.02, 0.05, 'elevation MIL');
  near(mil(s.windRad), 0.85, 0.03, 'vent MIL');
  near(moa(s.elevRad), Units.convert(mil(s.elevRad), 'MIL', 'MOA'), 1e-9, 'MOA = conversion centralisee de MIL');
  assert.ok(s.windRad > 0, 'vent de droite (3h) -> correction a droite');
  assert.ok(s.drift < 0, 'derive vers la gauche');
  assert.ok(s.mach > 1.2, 'supersonique a 500 m');
  near(s.elevRad, -Math.atan2(s.drop, 500), 1e-12, 'elevation = atan(chute/distance)');
});
test('convergence du pas d\'integration (1 ms vs 0.25 ms) < 1 mm a 1000 m', () => {
  const inp = { ...ref308(), distance: 1000 };
  const a = solve(inp); const dt = CONFIG.DT; CONFIG.DT = 0.00025; const b = solve(inp); CONFIG.DT = dt;
  near(a.drop, b.drop, 0.001, 'chute'); near(a.drift, b.drift, 0.001, 'derive');
});
test('atmosphere standard : rho(0 m, 15 C) = 1.225', () => { near(Core.atmosphere(0, 288.15).rho, 1.2250, 1e-4, 'rho'); near(Core.atmosphere(0, 288.15).a, 340.29, 0.05, 'a'); });
test('air moins dense (altitude) -> moins de chute', () => {
  const s0 = solve(ref308()), s1 = solve({ ...ref308(), altitude: 2000 });
  assert.ok(s1.drop > s0.drop);
});
test('BC plus eleve -> moins de chute et de derive', () => {
  const s0 = solve(ref308()), s1 = solve({ ...ref308(), bc: 0.3 });
  assert.ok(s1.drop > s0.drop && Math.abs(s1.drift) < Math.abs(s0.drift));
});

console.log('Vent');
const driftAt = clock => solve({ ...ref308(), windClock: clock }).drift;
test('13. vent plein travers : derive maximale (3h et 9h)', () => {
  const d = [1,2,3,4,5,6,7,8,9,10,11,12].map(h => Math.abs(driftAt(h)));
  near(d[2], Math.max(...d), 1e-3, '3h max'); near(d[8], Math.max(...d), 1e-3, '9h max');
});
test('14. vent de face (12h) : derive nulle', () => near(driftAt(12), 0, 1e-9, 'derive 12h'));
test('15. vent arriere (6h) : derive nulle', () => near(driftAt(6), 0, 1e-9, 'derive 6h'));
test('16. directions horaires : derive ~ sin(angle), signes corrects', () => {
  const full = driftAt(3);
  for (const h of [1, 2, 4, 5]) near(driftAt(h), full * Math.sin(h * Math.PI / 6), Math.abs(full) * 0.02, h + 'h');
  for (const h of [7, 8, 10, 11]) assert.ok(driftAt(h) > 0, h + 'h -> derive a droite');
  near(driftAt(9), -full, 1e-3, '9h symetrique de 3h');
  assert.ok(solve({ ...ref308(), windClock: 12, windSpeed: 10 }).drop < solve({ ...ref308(), windClock: 6, windSpeed: 10 }).drop, 'face -> plus de chute que dos');
});

console.log('Validation des entrees');
test('23. valeurs invalides refusees, jamais de NaN', () => {
  for (const [k, v] of [['bc', 0], ['mv', 0], ['distance', -10], ['temperature', 10], ['mv', NaN], ['bc', undefined], ['windClock', 13], ['windClock', 2.5], ['dragModel', 'G9']]) {
    const s = solve({ ...ref308(), [k]: v });
    assert.ok(!s.ok && s.errors.length, k + '=' + v + ' doit echouer');
    assert.ok(s.errors.some(e => e.field === k), 'erreur sur le champ ' + k);
  }
  const far = solve({ ...ref308(), distance: 2500, mv: 300, bc: 0.05 });
  assert.ok(!far.ok, 'distance hors domaine signalee');
});

console.log('Reticule / point d\'impact (§25)');
test('clics nuls : impact = -correction, position normalisee', () => {
  const s = solve(ref308());
  const r = ReticleState({ type: 'xmas', clickId: 'mil_0_1', solution: s });
  near(r.y, -mil(s.elevRad) / 10, 1e-12, 'y'); near(r.x, -mil(s.windRad) / 10, 1e-12, 'x');
  assert.ok(r.y < 0 && r.x < 0, 'impact bas-gauche');
});
test('clics = solution : impact au centre a un demi-clic pres, toutes valeurs de clic', () => {
  const s = solve(ref308());
  for (const id in CLICKS) {
    const r0 = ReticleState({ type: 'mildot', clickId: id, solution: s });
    const r = ReticleState({ type: 'mildot', clickId: id, clicksV: r0.needV, clicksH: r0.needH, solution: s });
    assert.ok(Math.abs(r.impactV) <= CLICKS[id].rad / 2 + 1e-12, id + ' V');
    assert.ok(Math.abs(r.impactH) <= CLICKS[id].rad / 2 + 1e-12, id + ' H');
  }
});
test('un clic deplace l\'impact exactement d\'une valeur de clic', () => {
  const s = solve(ref308());
  for (const id in CLICKS) {
    const a = ReticleState({ type: 'bdc', clickId: id, clicksV: 3, clicksH: -2, solution: s });
    const b = ReticleState({ type: 'bdc', clickId: id, clicksV: 4, clicksH: -1, solution: s });
    near(b.impactV - a.impactV, CLICKS[id].rad, 1e-15, id + ' V'); near(b.impactH - a.impactH, CLICKS[id].rad, 1e-15, id + ' H');
    near((b.y - a.y) * Core.RETICLES.bdc.halfSpanMil, Units.fromSI(CLICKS[id].rad, 'MIL'), 1e-12, id + ' y normalise');
  }
});
test('23. changement de reticule : meme impact angulaire, echelle propre', () => {
  const s = solve(ref308());
  const imp = ['mildot', 'moa', 'xmas', 'bdc'].map(t => ReticleState({ type: t, clickId: 'mil_0_1', clicksV: 20, solution: s }));
  for (const r of imp) { near(r.impactV, imp[0].impactV, 1e-15, r.type); if (!r.outOfView) near(r.y * r.halfSpanMil, mil(r.impactV), 1e-12, r.type + ' y'); }
});
test('hors champ signale et borne a [-1, 1]', () => {
  const s = solve({ ...ref308(), distance: 1000 });
  const r = ReticleState({ type: 'mildot', clickId: 'mil_0_1', solution: s });
  assert.ok(r.outOfView && r.y === -1);
});

test('24. changement de valeur de clic : correction angulaire conservee', () => {
  assert.strictEqual(Core.convertClicks(40, 'mil_0_1', 'mil_0_2'), 20);
  assert.strictEqual(Core.convertClicks(40, 'mil_0_1', 'moa_1_4'), 55);
  assert.strictEqual(Core.convertClicks(-8, 'mil_0_1', 'moa_1_8'), -22);
  assert.strictEqual(Core.convertClicks(0, 'moa_1_4', 'mil_0_1'), 0);
});
test('BDC : distance pour une graduation lue dans la table de la solution', () => {
  const s = solve(ref308());
  const d = Core.distanceForHold(s.table, s.elevRad);
  near(d, 500, 2, 'graduation = elevation a 500 m');
  assert.ok(Number.isNaN(Core.distanceForHold(s.table, Units.toSI(40, 'MIL'))), 'hors table -> NaN');
});

console.log('Calibration');
// Donnees synthetiques : "realite" = BC 0.230 ; l'utilisateur tire avec BC 0.243 et mesure l'ecart.
const truth = 0.230;
const mkPoint = (d, noiseCm = 0, shots = 3) => {
  const snap = { ...ref308(), distance: d, windSpeed: 0 };
  const real = solve({ ...snap, bc: truth }), pred = solve(snap);
  return CalibrationPoint({ distance: d, dV: real.drop - pred.drop + noiseCm / 100, dH: 0.02, shots, snapshot: snap });
};
test('17. mono-distance (600 m) : BC retrouve, statut indicatif', () => {
  const r = calibrateBC([mkPoint(600)]);
  assert.strictEqual(r.status, 'indicative'); near(r.bc, truth, 0.001, 'BC'); near(r.deltaPct, (truth / 0.243 - 1) * 100, 0.5, '%');
  assert.strictEqual(r.nPoints, 1); assert.strictEqual(r.nShots, 3);
});
test('18. multi-distance (400/600/800 m, bruit +/-3 cm) : BC ok', () => {
  const r = calibrateBC([mkPoint(400, 2), mkPoint(600, -3), mkPoint(800, 3)]);
  assert.strictEqual(r.status, 'ok'); near(r.bc, truth, 0.004, 'BC'); assert.strictEqual(r.nShots, 9);
});
test('impact plus haut que prevu -> BC calibre plus eleve', () => {
  const snap = { ...ref308(), distance: 700, windSpeed: 0 };
  const r = calibrateBC([CalibrationPoint({ distance: 700, dV: 0.15, dH: 0, shots: 1, snapshot: snap })]);
  assert.ok(r.bc > 0.243);
});
test('vitesse corrigee apres coup (chrono) : le BC ajuste utilise la nouvelle vitesse', () => {
  // realite : 2560 fps et BC 0.243 ; tirs effectues en croyant 2600 fps. Apres correction de la vitesse, BC ~ 0.243.
  const realMv = Units.toSI(2560, 'fps');
  const pts = [500, 700, 900].map(d => { const snap = { ...ref308(), distance: d, windSpeed: 0 };
    return CalibrationPoint({ distance: d, dV: solve({ ...snap, mv: realMv }).drop - solve(snap).drop, shots: 3, snapshot: snap }); });
  near(calibrateBC(pts, { bc: 0.243, mv: realMv }).bc, 0.243, 0.002, 'BC avec vitesse corrigee');
  assert.ok(calibrateBC(pts, { bc: 0.243 }).bc < 0.235, 'sans correction, le BC absorbe l erreur de vitesse');
});
test('donnees insuffisantes (150 m) : pas de faux BC', () => {
  const r = calibrateBC([mkPoint(150)]);
  assert.strictEqual(r.status, 'insufficient'); assert.strictEqual(r.bc, null);
});
test('donnees absurdes : non fiable, pas de BC', () => {
  const snap = { ...ref308(), distance: 600, windSpeed: 0 };
  const r = calibrateBC([CalibrationPoint({ distance: 600, dV: 5, dH: 0, shots: 1, snapshot: snap })]);
  assert.ok(r.bc === null && r.status === 'unreliable');
});
test('points incoherents signales', () => {
  const r = calibrateBC([mkPoint(500, 40), mkPoint(800, -60)]);
  assert.strictEqual(r.status, 'inconsistent');
});
test('aucun point', () => { const r = calibrateBC([]); assert.ok(r.bc === null && r.status === 'insufficient'); });

console.log('Profils / stockage');
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; };
test('19. sauvegarde + rechargement (26)', () => {
  const ls = mem(); const st = Storage.load(ls).state;
  st.profiles[0].bc = 0.25; st.session.distance = 650; st.prefs.distUnit = 'yd';
  Storage.save(ls, st); const back = Storage.load(ls).state;
  assert.deepStrictEqual(back, st);
});
test('20. modification + 22. changement de profil restaure les parametres', () => {
  const ls = mem(); const st = Storage.load(ls).state;
  const p2 = st.profiles[1]; p2.reticle = 'bdc'; p2.clickId = 'mil_0_2'; st.activeProfileId = p2.id;
  Storage.save(ls, st); const back = Storage.load(ls).state;
  const act = back.profiles.find(p => p.id === back.activeProfileId);
  assert.strictEqual(act.reticle, 'bdc'); assert.strictEqual(act.clickId, 'mil_0_2'); assert.strictEqual(act.bc, 0.326);
});
test('21. suppression du profil actif -> repli sur un profil existant', () => {
  const st = Core.defaultState(); const raw = { ...st, profiles: [st.profiles[1]] };
  const m = migrate(JSON.parse(JSON.stringify(raw)));
  assert.strictEqual(m.activeProfileId, st.profiles[1].id);
});
test('duplication : nouvel id, copie profonde', () => {
  const p = Profiles.defaults()[0]; p.calibration = [mkPoint(600)];
  const d = Profiles.duplicate(p);
  assert.notStrictEqual(d.id, p.id); d.calibration[0].dV = 9; assert.notStrictEqual(p.calibration[0].dV, 9);
});
test('donnees corrompues : reinitialisation + copie de secours', () => {
  const ls = mem(); ls.setItem(CONFIG.STORAGE_KEY, '{oops');
  const r = Storage.load(ls); assert.ok(r.warning); assert.strictEqual(r.state.profiles.length, 2);
  assert.strictEqual(ls.getItem(CONFIG.STORAGE_KEY + '.corrupt'), '{oops');
});
test('donnees partielles / ancienne version : champs reparés', () => {
  const m = migrate({ profiles: [{ name: 'X', bc: 0.4, dragModel: 'G1', reticle: 'zzz', clickId: 'nope' }], prefs: { distUnit: 'km' }, session: { distance: 'abc', windClock: 99 } });
  assert.strictEqual(m.profiles[0].reticle, 'mildot'); assert.strictEqual(m.profiles[0].clickId, 'mil_0_1');
  assert.strictEqual(m.prefs.distUnit, 'm'); assert.strictEqual(m.session.distance, 500); assert.strictEqual(m.session.windClock, 3);
  assert.strictEqual(m.schemaVersion, CONFIG.SCHEMA_VERSION);
});
test('schema plus recent : refuse proprement (pas d\'ecrasement silencieux)', () => {
  const ls = mem(); ls.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ schemaVersion: 99 }));
  assert.ok(Storage.load(ls).warning);
});
test('BC calibre utilise seulement si active', () => {
  const p = BallisticProfile({ bc: 0.243, bcCalibrated: 0.231 });
  assert.strictEqual(buildInput(p, defaultSession()).bc, 0.243);
  p.useCalibrated = true; assert.strictEqual(buildInput(p, defaultSession()).bc, 0.231);
});

console.log(`\n${pass} ok, ${fail} echec(s)`);
process.exit(fail ? 1 : 0);
