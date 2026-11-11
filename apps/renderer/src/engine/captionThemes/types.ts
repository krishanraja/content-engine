// @ts-nocheck
// Vendored from github.com/vshukla7/remotion-captions-themes@c2cfe29cb732bf01aac2a92b84f58fda28fc182e (MIT, see LICENSE beside this folder).
// Kept as published so a theme can be refreshed from upstream; the engine adapter is ../ThemedCaption.tsx.
export interface WordTiming {
  text: string;
  start: number; // seconds
  end: number;   // seconds
  emphasis?: boolean;
}

export interface CaptionLine {
  words: WordTiming[];
}

export interface CaptionsData {
  lines: CaptionLine[];
}

export interface CaptionThemeProps {
  primaryColor?: string;
  secondaryColor?: string;
  data: CaptionsData;
  theme?: string;
  fontSize?: number | string;
}

export interface InternalThemeProps {
  primaryColor: string;
  secondaryColor: string;
  data: CaptionsData;
  fontSize?: number | string;
}

