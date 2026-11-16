# M37 findings (append-only log; read first after an interruption)
Build: dist index-DgAteKyR.js (includes the fixes below). Server: 8090, pid 340137 (mine).
## Fixes (in src, uncommitted)
- FIXED shrine plinth sink 0.54 m at (-34,-40.5): STANDS shrine-step r7.5 / shrine-base r6.5 (src/shrine.ts). Walk castle route re-run: no shrine sink.
- FIXED console warning "toNonIndexed already non-indexed" (src/landmarks.ts slabs + shoulders).
## Left
- THREE.Clock deprecated warning: harmless, lives in the main loop (M11 motion area).
- walk ridge: 0.41/0.30 transient stair "sinks" = step-up lag, qa-opening/qa-stair pass.
- walk castle: "sinks" at (-45,-56) top 1.1-1.8 and (-74,-100) top 7-10 = overhead geometry (footProbe blocked:false, 'opening' ruin / Wing Gate arch), false positives.
- audit UI overlap sea-cave action x cbt: cbt container rect only, visually fine.
- perf: track view Lite 174 calls / 821k tris (over ~720k); night-hub 221 calls (night roamers). Not fixed yet.
## Suites (post-fix build)
- PASS: post(High+Lite, 0 shader errs), opening, world, ground, quests, castle, stair, cave, combat, finale, outlook, plate, title.
- qa-run: running with 1800 s timeout (was exit 124 at 700 s: slow real-time tide waits).
- qa-run: PASS (exit 0, 0 FAIL, errors []) with 1800 s timeout; the old exit 124 "frame detached" was the 700 s runner timeout killing it mid-wait (keeper fight, old-save migration, pose checks all pass). No code fix needed; run it with timeout >= 1800.
- glitch probe tools/m37-glitch.cjs (needs &tod= in URL, qa=1 alone locks day light): PASS old v1 save loads (xp 40, spawn 0,6); calm at spawn shows only Use/Jump (combat btns hidden); jump air->landed, no stuck jump; night: 10 groups present, 0 mobs inside blocked geometry (also after reload); combat btns stay hidden 16 m from idle night group and after leaving to day; errors [].
- camera: keep hall, player backed to the east wall facing west -> castle.clampCam pulls the camera in/up (no see-through); shot shots/m37-camwall.png. Cave/sea/keep use their own clampCam (qa-run keeper + cave pass). PASS.
- perf flags LEFT: track view (wagon track toward hub) Lite ~174 calls/821k tris; night-hub ~221 calls. Official perf views (meadow 657k/178, keep 675k/191) within caps; fixing needs grass/roamer batching, not a small safe change.
