# Fix: tag-covers layout

On the host render of "tag-covers" (2400 x 1300) the cells overlap:
- T2's 700 px cover starts under T1's reduction column;
- T2's 150 and 56 px reductions land under S3g's cover.

Three cells of 700 + 24 + 150 px do not fit inside 2400 px with 48 px margins and 40 px gutters.

Fix: use the same cell layout as show-art-s1 (cover scaled to 567 px, with its own 150 and 56 px reductions in a column to its right, top aligned, caption under the cover), with three cells in one row inside the 48 px margins. Update the header to say 567 / 150 / 56 px. Keep the no-overflow assert passing. Edit study.html only; do not commit; do not launch Chromium.
