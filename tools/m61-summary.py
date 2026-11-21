# M61 · summarise m61-ui.cjs JSON into a markdown table: python3 tools/m61-summary.py before.json [after.json]
import json,sys
def row(v,tag):
    out=[]
    for st in ['calm','combat','wpick','seal1','seal1b','journal','map','menu','settings']:
        m=v.get(st)
        if not m: continue
        small=sorted({f"{t['id'] or t['t'][:10]} {t['w']}x{t['h']}" for t in m['small']})
        hc=', '.join(f'{k} {p}%' for k,p in m['heroCover'].items() if k not in('journal','mapov','settings'))
        cc=', '.join(f'{k} {a}' for k,a in m['ctlCover'].items() if not k.startswith(('settings','journal','mapov')))
        pr=', '.join(f'{k} {a}' for k,a in m['pair'].items())
        blk=[c for c,ok in m['ctlFree'].items() if ok not in (True,None)]
        out.append(f"| {tag} | {st} | {len(small)}: {'; '.join(small)} | {m['font']['min']} / {m['font']['lt12']} | {hc or '–'} | {cc or '–'} | {pr or '–'} | {','.join(blk) or 'ok'} |")
    return out
for f in sys.argv[1:]:
    d=json.load(open(f));print(f'\n### {f}\n| view | state | targets <44 px | min font px / # <12 px | covers hero | covers controls (px²) | HUD-HUD overlaps (px²) | controls blocked |\n|---|---|---|---|---|---|---|---|')
    for tag,v in d['views'].items():
        for r in row(v,tag): print(r)
        print(f"| {tag} | notes | journal end close: {v.get('journalEndClose')} · combat engaged: {v.get('combatEngaged')} · coach at claim: {'on' if v.get('seal1Coach') else 'off'} · coach at +4.7 s: {'on' if v.get('seal1bCoach') else 'off'} |||||||")
