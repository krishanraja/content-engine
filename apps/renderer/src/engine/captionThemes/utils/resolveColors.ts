// @ts-nocheck
// Vendored from github.com/vshukla7/remotion-captions-themes@c2cfe29cb732bf01aac2a92b84f58fda28fc182e (MIT, see LICENSE beside this folder).
// Kept as published so a theme can be refreshed from upstream; the engine adapter is ../ThemedCaption.tsx.
const DEFAULT_COLOR = "#FFFFFF";

export function resolveColors(primaryColor?: string, secondaryColor?: string) {
  if (!primaryColor && !secondaryColor) {
    return { primary: DEFAULT_COLOR, secondary: DEFAULT_COLOR };
  }
  if (primaryColor && !secondaryColor) {
    return { primary: primaryColor, secondary: primaryColor };
  }
  if (!primaryColor && secondaryColor) {
    return { primary: secondaryColor, secondary: secondaryColor };
  }
  return { primary: primaryColor!, secondary: secondaryColor! };
}
