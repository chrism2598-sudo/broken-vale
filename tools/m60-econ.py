# M60 audit: weapon maths + XP economy, computed from the shipping constants in src/ (combat.ts, mobs.ts, castle.ts, quest.ts ...).
import json, math, re, sys
src = open(sys.argv[1] if len(sys.argv) > 1 else 'src/combat.ts').read()
W = {}
for m in re.finditer(r"(\w+): \{ id: '\w+', name: '([^']+)'.*?dmg: ([\d.]+), heavy: ([\d.]+), reach: ([\d.]+), swing: ([\d.]+), combo: (\d), stagger: ([\d.]+), keeperMul: ([\d.]+), heavyCost: (\d+)", src, re.S):
    k, n, d, h, r, s, c, st, km, hc = m.groups(); W[k] = dict(name=n, dmg=float(d), heavy=float(h), reach=float(r), swing=float(s), combo=int(c), stagger=float(st), keeperMul=float(km), heavyCost=int(hc))
FOES = {'husk': 3, 'shade': 5, 'cultist': 5, 'brute': 9, 'zealot': 12, 'king': 26}
rows = []
for k, w in W.items():
    steps = [(w['dmg'] * (1.5 if i == w['combo'] - 1 else 1), w['swing'] * (1.25 if i == w['combo'] - 1 else 1)) for i in range(w['combo'])]
    dmg_c = sum(a for a, _ in steps); t_c = sum(b for _, b in steps)
    lightDps = dmg_c / t_c
    heavyT = 0.8 + w['swing'] * 1.5 + 0.08; heavyDps = w['heavy'] / heavyT
    def ttk(hp):  # light-combo seconds to kill (chained combos)
        t = 0; d = 0; i = 0
        while d < hp - 1e-9: a, b = steps[i % len(steps)]; d += a; t += b * 0.42 if d >= hp - 1e-9 else b; i += 1
        return round(t, 2)
    rows.append(dict(id=k, name=w['name'], lightDps=round(lightDps, 2), heavyDps=round(heavyDps, 2), heavyPerStam=round(w['heavy'] / w['heavyCost'], 3), reach=w['reach'], stagger=w['stagger'], firstHit=round(w['swing'] * 0.42, 2), ttk={f: ttk(hp) for f, hp in FOES.items()}))
for r in rows: print(json.dumps(r))
