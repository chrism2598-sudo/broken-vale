# M62 difficulty curve: player power vs foe toughness per main-path stage, computed from the shipping constants (release-M61).
# Evidence type: CODE/DATA INSPECTION (no play data). Run: python3 tools/m62-curve.py > logs/m62/curve.txt
import math
# quest.ts / warden.ts / keeper.ts / main.ts constants (release-M61)
SEAL, QUEST, SHRINE, WARDEN, ECHO, BEACON, CAVE, COAST, SEA, KEEPER, LAMP = 50, 80, 35, 40, 20, 60, 40, 30, 45, 60, 70
LV_STEP, LV_CAP, WHET = 0.03, 13, 0.15
lvl = lambda xp: 1 + xp // 50
bonus = lambda xp: LV_STEP * min(lvl(xp) - 1, LV_CAP - 1)
# combat.ts weapons: dmg, swing, combo
W = {'rusty': (1.0, .36, 3), 'spear': (1.15, .42, 2), 'maul': (2.0, .72, 2), 'knight': (1.4, .36, 3), 'halberd': (1.4, .5, 2),
     'ember': (1.8, .44, 3), 'tide': (1.5, .34, 3), 'harpoon': (1.3, .36, 3)}
# mobs.ts foes: hp, dmg to player (hearts), windup s
F = {'husk': (3, 1, .95), 'shade': (5, 1, .7), 'sentinel(keep)': (4, 1, .85), 'cultist': (5, 1, .8), 'barrow dead': (4, 1, .9),
     'drowned': (5, 1, .9), 'brute': (9, 2, 1.15), 'zealot': (12, 2, 1.05), 'Ossric (king)': (26, 2, 1.0)}
def hits(w, hp, mul):
    d, sw, c = W[w]; n = 0; tot = 0
    while tot < hp - 1e-9: tot += d * mul * (1.5 if n % c == c - 1 else 1); n += 1
    return n
# main-path stages: (label, cumulative main-path XP, whetstones a main-path player is likely to have, weapons on/next to the path)
main = []; xp = 0
for lab, add in [('Start', 0), ('Seal 1 (Forge)', SEAL), ('Seal 2', SEAL), ('Seal 3', SEAL), ('Seal 4 + Vale Walker', SEAL + QUEST),
                 ('Wind Shrine', SHRINE), ('Echo Grove', ECHO), ('Beacon (end Ch I)', BEACON), ('Cave (start Ch II)', CAVE),
                 ('Coast', COAST), ('Sea cave', SEA), ('Keeper', KEEPER), ('Lamp (ending)', LAMP)]:
    xp += add; main.append((lab, xp))
print('MAIN PATH (no optional XP, no whetstones)')
print('stage | xp | level | blow mul | rusty hits: husk/shade/brute | foe dmg to a 3-heart hero')
for lab, x in main:
    m = 1 + bonus(x)
    print(f'{lab} | {x} | {lvl(x)} | x{m:.2f} | {hits("rusty",3,m)}/{hits("rusty",5,m)}/{hits("rusty",9,m)} | 1 heart (2 from brute/zealot/king)')
print('\nPOWER BANDS (mul = 1 + 0.15*whet + 0.03*min(level-1,12))')
for lab, whet, x in [('Opening, Lv1, 0 whet', 0, 0), ('End Ch I main path, 0 whet', 0, 395), ('End Ch I, 2 keep whetstones', 2, 395),
                     ('Ending main path, 0 whet', 0, 640), ('Ending main path, Lv13, 1 coast whetstone', 1, 640), ('Thorough, Lv13, 4 whet (cap)', 4, 2000)]:
    m = 1 + WHET * whet + bonus(x)
    print(f'\n{lab}: x{m:.2f}')
    for w in ['rusty', 'maul', 'knight', 'halberd', 'ember', 'tide', 'harpoon']:
        print('  ' + w.ljust(8) + ' hits-to-kill: ' + ', '.join(f'{k} {hits(w, hp, m)}' for k, (hp, _, _) in F.items()))
print('\nBOSSES: Warden HP 6 (stagger window on stagger>=1, damage 1/heart). Keeper HP 6, x keeperMul, damage only in low-tide windows.')
for lab, m in [('x1.00', 1), ('x1.36', 1.36), ('x1.96', 1.96)]:
    print(f'  {lab}: Warden light hits rusty {hits("rusty",6,m)} maul {hits("maul",6,m)} ember {hits("ember",6,m)}; Keeper light hits rusty {hits("rusty",6,m)} tide-blade(x1.5) {hits("tide",4,m)} harpoon(x1.3) {hits("harpoon",6/1.3,m)}')
print('\nPLAYER SIDE: 3 hearts (+1 Sefa heartstone, max 4). Full heal after 5-6 s out of combat. Defeat = respawn at nearest fire/entry, no XP or item loss.')
print('Foe stats never scale with chapter, level or time. Chapter II adds one regular foe (Tide-Wight, hp5/dmg1 = a slower Gloam Shade).')
# ---------------- M63 before/after (roam.ts foeScale: hp x(1+0.1t), wind-up x(1-0.03t), speed x(1+0.04t), notice x(1+0.05t);
# t = seals claimed, +1 in Chapter II, max 5; foe HP rounded to whole points; damage unchanged) ----------------
print('\nM63 BEFORE -> AFTER (main path, no whetstones; Rusty Sword light hits to kill; challenge = foe HP / hero blow, 1.00 = opening)')
print('stage | tier | hero mul | husk hp b->a, hits | shade hp b->a, hits | brute hp b->a, hits | challenge b->a | shade wind-up s b->a')
fsc = lambda t: (1 + 0.1 * t, 1 - 0.03 * t)
for lab, x, t in [('Start (0 seals)', 0, 0), ('After seal 1', 50, 1), ('After seal 2', 100, 2), ('After seal 3', 150, 3), ('After seal 4 + Vale Walker', 280, 4),
                  ('End Ch I (Beacon lit) / Ch II', 395, 5), ('Ending (Lv 13)', 640, 5)]:
    m = 1 + bonus(x); hk, wk = fsc(t)
    cells = []
    for hp in (3, 5, 9):
        a = max(1, round(hp * hk)); cells.append(f'{hp}->{a}, {hits("rusty", hp, m)}->{hits("rusty", a, m)}')
    print(f'{lab} | {t} | x{m:.2f} | ' + ' | '.join(cells) + f' | {1/m:.2f}->{hk/m:.2f} | {0.7:.2f}->{0.7*wk:.2f}')
print('Thorough player at the ending (x1.96): challenge 0.51 -> %.2f' % (1.5 / 1.96))
print('Seal guards (new): seal 2 Sentinel+Husk, seal 3 +Sentinel, seal 4 +Gloam Brute; HP at their tier: seal 2 [4,3], seal 3 [5,4,5], seal 4 [5,4,5,12].')
