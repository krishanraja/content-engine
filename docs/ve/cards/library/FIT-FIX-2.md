# Stress inputs: cut at word boundaries, and never truncate real content

Edit library.html, library.json and NOTES.md in this folder only. Do not commit. Do not launch a browser.

The host render now shows zero fit failures. But the `long` stress case fills slots with text sliced at max_chars mid-word, so sheets show "...HOW MUCH DOES A PLAY C" and "...COUNT WHEN TH". That reads as if the templates truncate content.

1. Build stress inputs from whole words only: the longest run of whole words that is at most max_chars, ending on a complete word, plus a question mark where the slot is a question.
2. State the contract in library.json (`content_contract`) and NOTES.md: real content is never truncated or ellipsed. Text over max_chars or max_lines at min size is refused, with the red REFUSED stamp on stress sheets and a refusal on export.
3. Make the fitter enforce point 2. If any code path slices text to max_chars, remove it.
