// @ts-nocheck
// Vendored from github.com/vshukla7/remotion-captions-themes@c2cfe29cb732bf01aac2a92b84f58fda28fc182e (MIT, see LICENSE beside this folder).
// Kept as published so a theme can be refreshed from upstream; the engine adapter is ../ThemedCaption.tsx.
import { RelationSpec, LayoutBox } from "./types";

export function resolveRelation(
  spec: RelationSpec,
  targetBox: LayoutBox,
  selfSize: { width: number; height: number }
): { x: number; y: number } {
  const gap = spec.gap ?? 0;
  const targetAnchor = spec.targetAnchor ?? "center";
  const anchorPoint = targetBox.anchors[targetAnchor] ?? targetBox.anchors.center;
  
  let x = anchorPoint.x;
  let y = anchorPoint.y;

  switch (spec.type) {
    case "above":
      x = targetBox.x + (targetBox.width - selfSize.width) / 2;
      y = targetBox.y - selfSize.height - gap;
      break;
    case "below":
      x = targetBox.x + (targetBox.width - selfSize.width) / 2;
      y = targetBox.y + targetBox.height + gap;
      break;
    case "leftOf":
      x = targetBox.x - selfSize.width - gap;
      y = targetBox.y + (targetBox.height - selfSize.height) / 2;
      break;
    case "rightOf":
      x = targetBox.x + targetBox.width + gap;
      y = targetBox.y + (targetBox.height - selfSize.height) / 2;
      break;
    case "anchorTo":
      x = anchorPoint.x - selfSize.width / 2;
      y = anchorPoint.y - selfSize.height / 2;
      break;
  }

  return { x, y };
}
