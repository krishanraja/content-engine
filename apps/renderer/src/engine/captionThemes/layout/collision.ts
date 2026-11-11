// @ts-nocheck
// Vendored from github.com/vshukla7/remotion-captions-themes@c2cfe29cb732bf01aac2a92b84f58fda28fc182e (MIT, see LICENSE beside this folder).
// Kept as published so a theme can be refreshed from upstream; the engine adapter is ../ThemedCaption.tsx.
import { LayoutBox } from "./types";

export function collisionRate(a: LayoutBox, b: LayoutBox): number {
  const xOverlap = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  );
  const yOverlap = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  );
  const overlapArea = xOverlap * yOverlap;
  
  if (overlapArea <= 0) return 0;
  
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const smallerArea = Math.min(areaA, areaB);
  
  return smallerArea > 0 ? overlapArea / smallerArea : 0;
}
