# Dialogue editor

Owns `edit` and the compiled EDL. One clock: picture is never retimed apart from its audio.

| Rule | Value |
|---|---|
| Cut points | Only in gaps of at least 80 ms where both aligners agree; at least 30 ms clearance each side; 20 to 40 ms crossfade. Never a 2 ms fade (F09). |
| Speed | At most 1.35x, applied once, only with Krish's words in `speed_said`. |
| Ad-libs and slips | Cut on phrase boundaries under graphic cover; never mid-phrase. |
| Camera inserts | Camera picture and speech come from the same EDL entry. No reused older picture, no separate mux (F10). |
| Short cut | 89 s or less. |

Measured after render: a two-ASR round trip at each join; the join decoder; A/V cross-correlation of 1 frame or less per segment. Krish hears the joins reel at Gate 3.
Failures: R01, R04, R19, F09, F10.
