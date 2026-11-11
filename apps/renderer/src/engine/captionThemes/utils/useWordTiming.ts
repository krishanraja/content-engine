// @ts-nocheck
// Vendored from github.com/vshukla7/remotion-captions-themes@c2cfe29cb732bf01aac2a92b84f58fda28fc182e (MIT, see LICENSE beside this folder).
// Kept as published so a theme can be refreshed from upstream; the engine adapter is ../ThemedCaption.tsx.
import { useCurrentFrame, useVideoConfig } from "remotion";
import { WordTiming, CaptionsData } from "../types";

export interface WordWithState extends WordTiming {
  isActive: boolean;
  isPast: boolean;
  lineIdx: number;
  wordIdx: number;
}

export function useWordTiming(data: CaptionsData) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  let activeWord: WordTiming | null = null;
  let activeLineIndex = -1;
  let activeWordIndex = -1;

  const words: WordWithState[] = [];

  data.lines.forEach((line, lineIdx) => {
    line.words.forEach((word, wordIdx) => {
      const isActive = time >= word.start && time < word.end;
      const isPast = time >= word.end;
      if (isActive) {
        activeWord = word;
        activeLineIndex = lineIdx;
        activeWordIndex = wordIdx;
      }
      words.push({
        ...word,
        isActive,
        isPast,
        lineIdx,
        wordIdx,
      });
    });
  });

  return {
    frame,
    fps,
    time,
    activeWord,
    activeLineIndex,
    activeWordIndex,
    words,
  };
}
