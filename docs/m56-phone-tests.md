# M56 phone tests · Lite adaptive render resolution

Diag build only (`/diag/`): it never writes your save. Each link runs by itself and shows a results card at the end. Tap **Copy JSON** and paste it into the chat.
**Rest the phone for 5 minutes between tests** (screen off, not charging), so heat doesn't skew the next one. Keep the phone still and don't touch the screen while a test runs.

1. **Meadow, Fast: adaptive off vs on** (most informative, about 2.5 min: 5 s warm-up, 60 s off, 15 s cool-down, 5 s warm-up, 60 s on)
   https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=fast&diag=meadow&warm=5&cool=15&seq=adaptoff,base
2. **Under the bridge, Fast, adaptive on** (about 1 min)
   https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=fast&diag=underbridge&warm=5&cool=15&seq=base
3. **Castle hall, Fast, adaptive on** (about 1 min)
   https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=fast&diag=castle&warm=5&cool=15&seq=base
4. **Meadow, Smooth (30 fps), unchanged** (adaptive stays off in Smooth; should match M55 test 5) (about 1 min)
   https://chrism2598-sudo.github.io/broken-vale/diag/?q=lite&tod=0.42&motion=smooth&diag=meadow&warm=5&cool=15&seq=base

What to read on each card: `adaptive res ON/off`, `PR now / min / max`, `steps (down/up)`, seconds at each ratio, and the usual fps, 1% low, p95, and long frames over 33 and 50 ms. Compare test 1's two rows directly. Compare tests 2 and 3 with the M55 baselines (meadow base 564 frames over 33 ms; under-bridge and castle from the M55 runs).
The JSON also carries `adapt.resizeMsMax`, the CPU time of the largest single resize step on the phone.
