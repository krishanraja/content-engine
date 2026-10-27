# Device contract (ve)

A device is a persistent, state-driven object. It is never a scene.

## Files

`apps/renderer/src/engine/devices/<id>/` holds:
- `index.tsx`: the component;
- `schema.ts`: zod schema for `object.params`;
- `fixture.json`: a minimal EngineRenderProps slice;
- `device.test.ts`.

## Signature

```ts
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps): JSX.Element
```

- **`frame` is passed in.** Do not call `useCurrentFrame()` in a device. `FormatMaster` calls it once and passes it down.
- **State comes only from `stateAt(events, object.obj, frame)`.** Animation comes only from `progress()` and `drift()` in `../clock`.

## Rules

1. **Pure function of `(frame, events, object)`.** No `f % N`, no `Math.random`, no wall clock, no fetch.
2. **Every state change is an event.** Between events the device holds its state and drifts. It never redraws on its own.
3. **Colours come from `tokens` only. Raw hex is refused.**
   - `tokens.mint` means answer, brand or next action.
   - `tokens.channel` is series identity only, never a status colour.
4. **Type roles:**
   - Anton for headlines and big numbers;
   - Archivo for structure and quoted answers;
   - Fraunces italic for the human line;
   - Plex Mono for labels, dates and provenance.

   Use the `HOUSE_FONTS` names from `../../house/geometry`.
5. **Numbers.** A device that shows a number reads it from `object.dataset` and shows `dataset.producerLabel` somewhere legible. `unit` and `denominator` never change during the object's life.
6. **Logos** come in as images and are never rotated.
7. **Both aspects are authored.**
   - `box` is the layout slot in frame pixels.
   - Design for 1080x1920 slots and 1920x1080 slots separately. Never scale one into the other.
8. **Motion grammar is slide, drop, slap.** Timing comes from `MOTION`:
   - enter 12 frames;
   - exit 6 frames;
   - stagger 3 frames;
   - slap 5 frames;
   - drop 8 frames.
9. **The test renders stills at given frames from `fixture.json` and asserts state.** For example: no tick before its event frame, a tick 6 frames after it, and a denominator that never changes.
