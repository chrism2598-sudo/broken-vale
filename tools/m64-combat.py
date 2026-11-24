#!/usr/bin/env python3
"""M64 computed balance: stun-lock (before/after poise), attack-token overlap, weapon roles, recovery speed, wind-ups.
Mirrors src/mobs.ts (stagger, wind-up, recover, hit-stop), src/combat.ts (swing cadence, hitAt 0.42, finisher x1.25, +0.3 stagger)
and src/roam.ts (attack token). Fixed 1/120 s steps. Evidence type: COMPUTED BALANCE (no players)."""
DT = 1 / 120
W = {  # id: (dmg, reach, swing, combo, stagger, heavy, heavyCost)
 'rusty': (1, 1, 0.36, 3, 0, 2.2, 30), 'spear': (1.15, 1.45, 0.42, 2, 0.4, 2.2, 28), 'maul': (2, 0.95, 0.72, 2, 1.1, 4, 40),
 'tide': (1.5, 1.15, 0.34, 3, 0.3, 3, 30), 'knight': (1.4, 1.15, 0.36, 3, 0.25, 3, 24), 'halberd': (1.4, 1.75, 0.5, 2, 0.9, 3.2, 34),
 'ember': (1.8, 1.1, 0.44, 3, 0.45, 3.8, 38), 'harpoon': (1.3, 1.5, 0.36, 3, 0.35, 3.0, 26)}
FOES = {'husk': (0.95, 1.1), 'shade': (0.7, 0.8), 'sentinel': (0.85, 1.1), 'cultist': (0.8, 1.1), 'brute': (1.15, 1.1), 'zealot': (1.05, 1.1)}

def strikes(w, T):
    """Times and stagger of light hits when the player mashes attack (queued combo, as combat.ts)."""
    dmg, reach, sw, combo, stg, *_ = W[w]; out = []; t = 0; step = 0
    while t < T:
        fin = step == combo - 1; dur = sw * (1.25 if fin else 1)
        out.append((t + dur * 0.42, stg + (0.3 if fin else 0), dmg * (1.5 if fin else 1))); t += dur; step = (step + 1) % combo
    return out

def lock(w, foe, poise, T=20.0):
    """One foe in reach, player mashes light attacks for T s. Returns (blows the foe lands, wind-ups started, longest gap between foe blows)."""
    windup, recover = FOES[foe]; hits = strikes(w, T); hi = 0
    st, t, stop = 'chase', 0.0, 0.0; stunT, poiseT, maxStun = 0.0, 0.0, 0.0
    blows, winds, last, gap, now = 0, 0, 0.0, 0.0, 0.0
    while now < T:
        while hi < len(hits) and hits[hi][0] <= now:
            s = hits[hi][1]; hi += 1; stop = 0.09 if s >= 0.8 else 0.055
            if poise:
                if poiseT <= 0 and stunT >= 1.5:
                    poiseT = 3.0
                    if st == 'stagger': st, t = 'chase', 0.0
                if poiseT > 0: continue
                if s >= 0.8 or st != 'windup': st, t = 'stagger', (0.9 if s >= 0.8 else 0.35)
            elif s >= 0.8 or st != 'windup': st, t = 'stagger', (0.9 if s >= 0.8 else 0.35)
        stunT = stunT + DT if st == 'stagger' else max(0.0, stunT - DT); poiseT = max(0, poiseT - DT); maxStun = max(maxStun, stunT)
        if stop > 0: stop -= DT
        else:
            t -= DT
            if st == 'chase': st, t = 'windup', windup; winds += 1
            elif st == 'windup' and t <= 0: st, t = 'recover', recover; blows += 1; poiseT = 0; stunT = 0.0; gap = max(gap, now - last); last = now
            elif st in ('recover', 'stagger') and t <= 0: st = 'chase'
        now += DT
    gap = max(gap, T - last); return blows, winds, gap, maxStun

def token(n, foe, on, T=20.0, gapS=0.45, wmax=2):
    """n identical foes in reach of an idle (blocking) player. Counts blow pairs that land < 0.30 s apart (too close to answer both)."""
    windup, recover = FOES[foe]; st = ['chase'] * n; tt = [0.0] * n; clock, lastW = 0.0, -9.0; times = []
    while clock < T:
        winding = sum(1 for s in st if s == 'windup')
        for i in range(n):
            tt[i] -= DT
            if st[i] == 'chase':
                if not on or (winding < wmax and clock - lastW >= gapS): st[i], tt[i] = 'windup', windup; winding += 1; lastW = clock
            elif st[i] == 'windup' and tt[i] <= 0: st[i], tt[i] = 'recover', recover; times.append(clock)
            elif st[i] == 'recover' and tt[i] <= 0: st[i] = 'chase'
        clock += DT
    times.sort(); close = sum(1 for a, b in zip(times, times[1:]) if b - a < 0.30)
    mingap = min((b - a for a, b in zip(times, times[1:])), default=0)
    return len(times), close, mingap

print('M64 · 1. STUN-LOCK — one foe in reach, player mashes light attacks for 20 s (computed balance)')
print('weapon | foe | foe blows landed b->a | wind-ups started b->a | longest stretch with no foe blow (s) b->a | longest unbroken stagger (s) b->a')
for w in W:
    for foe in ('husk', 'shade', 'brute'):
        b, a = lock(w, foe, False), lock(w, foe, True)
        print(f'{w} | {foe} | {b[0]}->{a[0]} | {b[1]}->{a[1]} | {b[2]:.1f}->{a[2]:.1f} | {b[3]:.2f}->{a[3]:.2f}')
print('\nM64 · 2. ATTACK TOKEN — n foes in reach, idle player, 20 s (computed balance). close = blows landing < 0.30 s apart')
print('group | blows b->a | close pairs b->a | min gap between blows (s) b->a')
for n, foe in ((2, 'husk'), (2, 'shade'), (3, 'shade'), (4, 'cultist')):
    b, a = token(n, foe, False), token(n, foe, True)
    print(f'{n}x {foe} | {b[0]}->{a[0]} | {b[1]}->{a[1]} | {b[2]:.2f}->{a[2]:.2f}')

print('\nM64 · 3. WEAPON ROLES (computed balance; light DPS = mashed combo vs one target, 1.00 dmg = 1 foe HP point at Lv1/no whetstone)')
print('weapon | light DPS | reach | stagger (light/finisher) | hard-staggers? | heavy dmg | heavy cost | heavy dmg per 10 stamina')
for w, (dmg, reach, sw, combo, stg, hv, hc) in W.items():
    cyc = sw * (combo - 1) + sw * 1.25; tot = dmg * (combo - 1) + dmg * 1.5
    print(f'{w} | {tot / cyc:.2f} | {reach:.2f} | {stg:.2f}/{stg + 0.3:.2f} | {"every hit" if stg >= 0.8 else "finisher" if stg + 0.3 >= 0.8 else "no (heavy only)"} | {hv:.1f} | {hc} | {hv / hc * 10:.2f}')

print('\nM64 · 4. OUT-OF-COMBAT RECOVERY (computed balance; overworld only — campfire rest, castle and barrow unchanged)')
print('hearts max | from | before: full at | after: full at (4 s calm, then +1 per 2.5 s)')
for mx in (3, 4, 6):
    for fr in (1, mx - 1):
        n = mx - fr; print(f'{mx} | {fr} | 6.0 s | {4 + 2.5 * (n - 1):.1f} s')
print('Between two fights 6 s apart, starting the 2nd at 1/3 hearts: before 3/3, after 2/3 (one heart gained at 4 s).')

print('\nM64 · 5. WIND-UPS (s, unchanged by M64; M63 tier scale x(1-0.03t)) and the token spacing')
print('foe | t0 | t1 | t2 | t3 | t4 | t5')
for foe, (wu, _) in FOES.items():
    print(foe + ' | ' + ' | '.join(f'{wu * (1 - 0.03 * t):.3f}' for t in range(6)))
print('Shortest wind-up anywhere: shade at tier 5 = %.3f s (parry window 0.24 s, roll i-frames 0.34 s). Token: next wind-up >= 0.45 s after the last; <= 2 at once.' % (0.7 * 0.85))
