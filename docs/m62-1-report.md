# M62.1 report · Wind Shrine Journal label fix + closed playtest kit

**Status:** implemented, tested, verified (internal/emulated). Tagged locally **release-M62.1**. Not pushed, not deployed.
Spec: docs/m62-1-spec.md. Logs (untracked): /workspace/vale3d/logs/m62-1/ (gates.log, final/, rerun/).

## Change
- `src/journal.ts` only: Journal heading `Wind Shrine (optional)` → `Wind Shrine (needed for the Beacon)`. (The Journal renders section headings in capitals via CSS.)
- Not changed (noted in the spec): the Wayfinder's spoken "optional trial" line (NPC dialogue) and the HUD shrine pill, which says "(optional)" before Chapter I is complete and "blessing opens the Updraft" after.
- Code commit ae5c431. Prod bundle index-BX1wNavJ.js, diag index-D9jzTqmP.js (M61 was index-BigYTxm4.js / index-FBiM_kDm.js; the label string is the only source change).

## Gates (code commit ae5c431, one at a time, ports 8099 build / 8094 rollback dir)
- 13 suites: post, opening, world, ground, quests, castle, stair, cave, combat, finale, outlook, plate, title: all PASS.
- Full qa-run: PASS (errors []). qa-save: PASS. Rollback M62.1 → release-M54 (index-Dan1OPQt.js) → M62.1: PASS.
- Shaders PASS. Draw calls identical to M61 at all 5 views (358/350/308/400/160); hub triangles 1,272,980 vs 1,273,308 is the known run-to-run variance (same values seen M53–M61).
- Perfrun PASS (headless estimate only), perf HUD PASS, diag smoke PASS, M57 diag PASS.
- qa-onboard PASS; new-player follow-screen and novice runs PASS; readability 8/8 rows.
- m60-progress: first run 19/21. The two failing checks ("banner overlaps nothing" at 412×915 and 360×740, banner not visible when measured) are a **pre-existing harness race**: the test re-shows the level banner and waits 400 ms while the game's own 3.2 s timer can clear it. Reproduced on the unchanged live M61 build (2 of 3 runs failed the same 2 checks). Harness fixed (re-show synchronously inside the measurement, test-only); then 21/21 on 3/3 runs on M62.1 and 3/3 on M61.
- Targeted m621-label: PASS (new heading in 4 save states, no Journal line calls the Wind Shrine optional, Warden/Echo Grove/keeps "(optional)" unchanged, prod+diag bundles carry the new literal and not the old, no page errors). First run reported 8 fails because the test compared case-sensitively against capitalised headings; test fixed, game unchanged.
- Minimum free memory during gates: 2.1 GB (post), otherwise ≥3.4 GB. No environment errors.

## Playtest kit (docs/, copies in /workspace/vale3d/playtest/)
playtest-invite.txt, playtest-questionnaire.txt, playtest-log-template.md, playtest-observer-notes.txt. **No outside playtest has happened yet**; nothing in this milestone is player data.
