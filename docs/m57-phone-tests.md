# M57 phone tests · diagnostics only (draw breakdown, emergency-downscale A/B, stall log)

Diag build only (`/diag/`). It never writes your save. Each link runs by itself and ends on a results card. Tap **Copy JSON** and paste it into the chat.
**Rest the phone 5 minutes between tests** (screen off, not charging). Keep the phone still and don't switch apps during a run; if you do, the stall log records it.
Every JSON now includes `world` (save state summary), `stallLog` (focus, visibility, resize, pixel-ratio and WebGL-context events), and per run `stalls` (rAF gaps over 100 ms with nearby events), `gameSecs`, `camStart` and `callsPer10s`.

1. **Under the bridge, draw breakdown** (most informative: explains 195 vs 307 draws; about 1.5 min)
   https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=fast&diag=underbridge&warm=5&cool=15&seq=base&draws=1
2. **Meadow, Fast: adaptive off / production adaptive / emergency downscale, twice for thermal drift** (about 8.5 min: six 60 s runs, 20 s cool-downs)
   https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=fast&diag=meadow&warm=5&cool=20&seq=adaptoff,base,adaptfast,adaptoff,base,adaptfast
3. **Castle hall, Fast, production adaptive, repeated** (about 3 min)
   https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=fast&diag=castle&warm=5&cool=20&seq=base,base
4. **Meadow, Smooth (30 fps), repeated, for the stall** (about 3 min)
   https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=smooth&diag=meadow&warm=5&cool=20&seq=base,base

Notes. `adaptfast` is a diag-only copy of the production controller plus a severe-stutter rule: 3 or more frames over 50 ms within 1 s jump straight down 2 levels, at most once per second. Production is unchanged, and the floor stays 0.8. `adaptfloorX` exists for measurement only and isn't in these links. `&draws=1` adds a little CPU overhead, so it's used only in test 1.
