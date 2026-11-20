# Performance testing on a phone (Pixel 9)

This needs a build that includes M54. Until M54 is deployed, these URLs do nothing extra on the live site.

A perf run **never changes your save**. It runs in a read-only session: you can play afterwards, but nothing from the run is kept.
Close the tab when the results card appears, and reopen the game normally.

## Before you start
1. Plug the phone in or charge it above 50%. Close other apps. Set screen brightness to normal.
2. Open the game once normally and tap **Continue**, so a character exists.
3. Use Chrome. Turn the phone to **portrait**, which is how the numbers on this side were measured.

## The three measurements (about 70 s each)
Open each URL, put the phone down, and don't touch the screen until the card appears (about 5 s warm-up plus 60 s).

| Scene | URL |
|---|---|
| Meadow (spawn hub, one slow 360° camera turn) | `https://chrism2598-sudo.github.io/broken-vale/?q=lite&tod=0.42&perf=1&perfrun=meadow` |
| Castle (Pale Keep great hall, still camera) | `https://chrism2598-sudo.github.io/broken-vale/?q=lite&tod=0.42&perf=1&perfrun=castle` |
| Under the bridge (busiest Lite view, camera sways) | `https://chrism2598-sudo.github.io/broken-vale/?q=lite&tod=0.42&perf=1&perfrun=underbridge` |

**Optional:** repeat any of them with `q=high` instead of `q=lite`.

## What to send back
- **A screenshot of each results card.** It is the bordered box in the middle of the screen.
  - The top line must say **DEVICE**. **HEADLESS ESTIMATE** means it came from our test machine, not your phone.
  - Card fields:
    - FPS avg and 1% low (the slowest 1% of frames).
    - Frame time avg, p50, p95, p99 and max (ms).
    - Long frames over 33 ms and over 50 ms.
    - Draw calls and triangles.
    - Load time (first frame and ready).
    - JS heap memory, or "memory: unavailable" if Chrome doesn't expose it. This is JS heap only, not GPU or total memory.
    - Device line: screen, cores, RAM class, GPU name, user agent, and the build file name.
- **Optional:** tap **Copy JSON** and paste the text into a message. It has the same numbers.

## Live overlay (no run)
Add `?perf=1` to any game URL, for example `https://chrism2598-sudo.github.io/broken-vale/?perf=1`.
- A small box in the bottom-left shows live FPS, frame-time stats over the last 300 presented frames, long-frame counts, draw calls and triangles, load time, and memory.
- It counts **presented** frames, so the "Smooth" motion setting (about 30 fps pacing) is shown the way you see it.
- Without `perf=1`, the overlay code is never downloaded.

## How to read the numbers
- **Smooth** motion targets an even ~30 fps, so 30 FPS avg with a few long frames is the goal there. **Fast** motion targets the display rate.
- Long frames over 50 ms are visible hitches. A handful per minute is OK; dozens are not.
- Lite budget: ≤ 200 draw calls (under the bridge sits exactly at 200).
