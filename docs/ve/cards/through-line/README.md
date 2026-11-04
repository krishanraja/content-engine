# through_line: the card for the object that carries a piece

`ve-through-line-1.fields.json` holds the fields `ve card` turns into a Codex card. It is not dispatched yet, by rule:

- F33: the engine is frozen during a piece, and this changes the renderer.
- F39: during a piece, Codex makes only that piece's named plates.

Dispatch it after Friday 13 Nov is filed:

1. On a home computer, run `ve card docs/ve/cards/through-line/ve-through-line-1.fields.json`. This writes the card with the local worktree and carries the data-story motion style and recipe.
2. Dispatch it through the lane with a Control Center booking.
3. Run `ve verify-card`.
4. Render Monday's proof window through ve and set it beside his approved cut (`mon02-tall`) for his eye.

Why it exists:
- His favourite cut, Monday 2 Nov, was one object (`config/ve/recipes/data-story.json`).
- ve can draw only per-beat devices, so the recipe cannot be built through ve until this device exists.
