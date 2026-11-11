// @ts-nocheck
// Vendored from github.com/vshukla7/remotion-captions-themes@c2cfe29cb732bf01aac2a92b84f58fda28fc182e (MIT, see LICENSE beside this folder).
// Kept as published so a theme can be refreshed from upstream; the engine adapter is ../ThemedCaption.tsx.
export type AnchorName =
  | "center" | "top" | "bottom" | "left" | "right"
  | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export interface FontSpec {
  family: string;
  size: number;
  weight: number | string;
  letterSpacing?: number;
}

export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
  anchors: Record<AnchorName, { x: number; y: number }>;
}

export type RelationType = "above" | "below" | "leftOf" | "rightOf" | "anchorTo";

export interface RelationSpec {
  type: RelationType;
  target: string;
  targetAnchor?: AnchorName;
  gap?: number;
  align?: AnchorName;
}

export interface TextElementSpec {
  id: string;
  text: string;
  font: FontSpec;
  relation?: RelationSpec;
}

export interface ComputedTextElement extends LayoutBox {
  id: string;
  text: string;
}

export interface LayoutResult {
  elements: Record<string, ComputedTextElement>;
  collisionRate: (idA: string, idB: string) => number;
}
