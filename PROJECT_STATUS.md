# PROJECT STATUS

## Version

V1 (feature frozen)

## État global

STABLE

Réserve : validé sur Edge/Chromium (émulation iPhone, Android, desktop). Pas encore testé sur un iPhone
physique avec Safari (voir « Tests restant à effectuer »).

## Étape actuelle

CHECKPOINT 10 : stabilisation V1 terminée. Prochaine étape : test sur appareil réel, puis V2 (non commencée).

## Étapes terminées

* [x] Architecture
* [x] Moteur balistique
* [x] Conversions
* [x] Écran Calc
* [x] Réticules
* [x] Calibration
* [x] Profils
* [x] PWA
* [x] Responsive
* [x] Tests
* [x] Polish final

## Fonctionnalités terminées

* **Moteur** (`<script id="core">`, sans DOM) : point matériel 3DOF, RK4 (pas 1 ms), tables G1/G7 standard,
  zéro résolu numériquement dans l'atmosphère de référence du profil, vent décomposé (travers exact + effet
  face/dos), atmosphère OACI à partir de l'altitude + température saisie, table de tir 50 m.
* **Conversions centralisées** (`Core.Units`) : m/yd/cm/in/ft, m/s/fps/km/h/mph, rad/MOA/MIL, °C/°F,
  écart linéaire ↔ angle (atan exact). Clics dérivés des unités (`Core.CLICKS`), arrondi `clicksFor`.
* **Calc** : distance (stepper ±25 + saisie), vent + cadran horaire tactile (glisser possible), atmosphère,
  munition & zéro repliables, carte solution (seul coin coupé de l'UI) : distance, chute, dérive,
  élévation et vent en MIL **et** MOA, clics avec sens, 4 valeurs de clic, vitesse/Mach/temps de vol/BC,
  avertissements transsonique/subsonique, table de tir, note des limites du modèle. Virgule décimale acceptée.
* **Réticule** : MIL-Dot, MOA, Christmas Tree, BDC (graduations libellées en distance depuis la table de la
  solution). Point d'impact depuis `Core.ReticleState` uniquement (x/y normalisés −1..+1), pavé ▲▼◀▶,
  saisie directe, inversion de signe, « Solution » (applique les clics), « Zéro », résidu d'impact,
  indication hors champ. Changement de valeur de clic : clics convertis à angle constant.
* **Calibrage** : points (distance, écart V, écart H, nombre de tirs), conversion en direct et tableau
  Distance | Écart V | Écart H | MOA V | MOA H | MIL V | MIL H, BC ajusté (balayage log + section dorée,
  pondéré par les tirs, en angle), statuts FIABLE / INDICATIF / INCOHÉRENT / INSUFFISANT / NON FIABLE,
  distance minimale utile calculée pour le profil, bascule « Utiliser le BC calibré », recalcul différé
  si les paramètres du profil changent.
* **Profils** : créer, modifier (éditeur complet), dupliquer, supprimer (confirmation, jamais le dernier),
  sélectionner (restaure tous les paramètres, tourelles remises à zéro). Profil actif identifié.
* **Persistance** : localStorage `ballistic.v1`, schéma versionné (`schemaVersion`, table `MIGRATIONS`),
  réparation champ par champ des données partielles, copie de secours des données corrompues
  (`ballistic.v1.corrupt`), refus d'un schéma plus récent, sauvegarde différée + à la mise en arrière-plan.
* **PWA** : manifest, service worker (cache d'abord + mise à jour en arrière-plan), icônes 192/512/
  maskable/apple-touch, métadonnées iOS (standalone, barre d'état translucide, safe areas).
* **DA** : tokens moodboard v2, Segoe UI (repli system-ui/SF) + monospace pour les données, splash avec
  assemblage des triangles du vrai logo (~1.2 s, désactivé si « réduire les animations »), watermark 7 %.

## Fonctionnalités en cours

(aucune : V1 gelée)

## Bugs connus

(aucun connu)

Bugs trouvés et corrigés pendant les tests : débordement horizontal des grilles (tableaux), indicateur
« BC CAL. » non mis à jour hors Calc, BC calibré non recalculé quand le modèle G1/G7 ou la vitesse changent,
messages du moteur sans accents, contour du champ de réticule à épaisseur non fixe.

## Tests effectués

* `node tests/core.test.js` : **46/46**. Conversions (fps↔m/s, m↔yd, MOA↔MIL, cm↔MOA, cm↔MIL, °C↔°F),
  clics 1/4 MOA, 1/8 MOA, 0.1 MIL, 0.2 MIL, G1 et G7 vs référence externe, convergence du pas, atmosphère,
  sensibilités (altitude, BC), vent sur 12 directions (travers max, face/dos nul, ~sin(angle), signes),
  validation (BC=0, v=0, distance négative, température impossible, NaN, cadran invalide, hors domaine),
  point d'impact (§25), conversion de clics, BDC, calibrage mono/multi/insuffisant/absurde/incohérent/
  vitesse corrigée, stockage/migration/corruption/profils.
* **Référence externe** : py-ballisticcalc 3.0.0 (solveur indépendant), `tools/reference_pybc.py` →
  `tests/reference_pybc.json`. Écart < 0.5 cm et < 0.5 m/s de 100 à 1000 m sur 4 cas.
* **Exemple de référence** (.308 Win, G7 0.243, 2600 fps, 500 m, 10 km/h plein travers 3h ;
  hypothèses : zéro 100 m, lunette 5 cm, 15 °C, altitude 0, air sec) :
  chute −200.9 cm, élévation **4.02 MIL / 13.81 MOA** (40 clics 0.1 MIL, 20 × 0.2 MIL, 55 × 1/4 MOA,
  110 × 1/8 MOA), dérive −42.4 cm, vent **0.85 MIL / 2.91 MOA** (8 clics à droite), 514.6 m/s, Mach 1.51,
  temps de vol 0.78 s. py-ballisticcalc : −200.90 cm / −42.38 cm.
  Différences possibles avec Strelok/JBM : hauteur de lunette et distance de zéro choisies, humidité,
  pression station vs pression standard, dérive gyroscopique (≈ 5 à 8 cm à 500 m, non modélisée),
  table G7 identique mais BC éventuellement différent selon la source (Sierra publie des BC par plage de vitesse).
* `uv run --no-project --with playwright python tests/ui.test.py` (Edge) : **110/110**. Couvre §24 19 à 30 :
  profils (création, refus sans nom, modification, duplication, changement, suppression), réticules,
  valeurs de clic, recalcul dynamique, cadran, unités, erreurs sans NaN/Infinity, rechargement, données
  corrompues, **hors ligne** (SW actif, coupure réseau, rechargement), position SVG du point d'impact =
  solution + clics (§25), calibrage, absence de débordement et réticule visible en 375×667, 390×844,
  844×390, 667×375, 412×915 et 1440×900, cibles tactiles ≥ 36 px. Captures dans `tests/screens/`.

## Tests restant à effectuer

* iPhone réel, Safari : installation « Sur l'écran d'accueil », offline en mode standalone, encoche et
  barre Home, clavier décimal iOS, `<dialog>` (iOS ≥ 15.4), animation splash.
* Chrome Android réel : invite d'installation, icône maskable.
* Comparaison terrain avec Strelok sur les mêmes hypothèses.

## Décisions techniques importantes

* Moteur : point matériel 3DOF, RK4 en temps (pas 1 ms ; écart < 1 mm à 1000 m vs 0.25 ms), tables G1/G7 standard.
* Unités internes SI (m, m/s, s, K, Pa, rad). Conversion uniquement à l'affichage, via `Core.Units`.
* BC (lb/in²) converti en kg/m² (×703.0696) ; décélération = ρ·v²·Cd_std(M)·π / (8·BC_SI). Le calibre et
  la masse ne sont donc pas nécessaires au calcul (champ calibre descriptif).
* Atmosphère : pression OACI à l'altitude, densité via température saisie, air sec.
* Vent : cadran horaire, 12h = face, 3h = vient de droite. Vent = vitesse de l'air (traînée sur vitesse relative).
* Zéro résolu dans l'atmosphère de référence du profil (temp./altitude au zéro), sans vent.
* MOA vrai (1/60°), MIL vrai (mrad).
* Réticule : premier plan focal supposé ; coordonnées SVG en MIL ; `ReticleState` = seule source de position.
* Calibrage : prédiction « au moment du tir » = snapshot enregistré ; modèle ajusté = paramètres actuels du
  profil. BC et vitesse initiale sont indiscernables par la seule chute (documenté dans l'UI).
* Service worker en fichier séparé (impossible inline) ; en `file://`, l'app marche sans cache ni installation.
* Préparation V2 (rien d'Apple Watch développé) : `BallisticSolution` et `ReticleState` sont des objets
  sérialisables sans DOM ; un futur `WatchCardData` se dérive de `solution` (distance, elevRad, windRad,
  clics) et l'état réticule se redessine à partir de `x`, `y`, `type`, `clickId`.

## Fichiers importants

* `index.html` : application (splash, CSS, `<script id="core">` moteur, `<script id="ui">` interface)
* `sw.js` : service worker (incrémenter `VERSION` à chaque livraison)
* `manifest.webmanifest`, `icons/` : PWA
* `tests/core.test.js`, `tests/ui.test.py`, `tests/reference_pybc.json`, `tests/shot.py`, `tests/screens/`
* `tools/make_icons.py` (détourage logo + icônes), `tools/reference_pybc.py` (références externes)
* `Moodboard v2 — Ballistic App.html`, `logo propre sans bordure.jpg` : sources DA

## Prochaine action

Héberger en HTTPS (GitHub Pages, Netlify…) et tester sur iPhone réel. Ne pas commencer la V2 sans validation.

## Dernière modification

2026-10-05 : CHECKPOINTS 1 à 10 terminés, V1 gelée.
