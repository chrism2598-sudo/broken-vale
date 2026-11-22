# M62.1 spec · Wind Shrine Journal label fix

**Approved:** C S, Nov 22 2026 (M62 decision 2). **Base:** release-M61 = 0d70840. **Branch:** m62-1.

## Problem (from M62, code inspection)
The Journal heading reads "Wind Shrine (optional)", but the Hollow Beacon that ends Chapter I is locked until the shrine's Windward Blessing is earned (journal.ts Beacon section; beacon Updraft check).

## Change (the only change)
- `src/journal.ts`: heading `Wind Shrine (optional)` → `Wind Shrine (needed for the Beacon)`.
- No other text, gameplay, UI layout, save format, graphics, audio or performance change. No new lore or names.

## Not changed (out of scope, noted)
- The Wayfinder's spoken line "The Wind Shrine up the path holds an optional trial." (NPC dialogue; canon rule).
- The HUD shrine pill, which says "(optional)" before Chapter I is complete and "blessing opens the Updraft" after (main.ts). Not Journal text.
These can be raised with C S separately if the playtest shows confusion.

## Acceptance
- Full V2 RC gate set on the exact commit, one heavy test at a time.
- New targeted test `tools/m621-label.cjs`: new heading present in four save states (0 seals, 2 seals, Chapter I done with shrine unsolved, shrine solved); no Journal line calls the Wind Shrine optional; Warden/Echo Grove/keeps "(optional)" headings unchanged; prod and diag bundles contain the new literal and not the old one; no page errors.
- Tag release-M62.1 locally; deploy zip /workspace/vale3d-m62-1-release.zip (git archive of the tag, no refs/ or logs/). Not pushed or deployed by me.
