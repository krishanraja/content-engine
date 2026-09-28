/** Advance widths of the house faces, in thousandths of an em, read from the
 *  brand kit's own font files (the same files the approved mock used) with
 *  fontTools. Variable faces were instanced at the axes the house style uses.
 *  They let the Studio size a headline and measure a card before it renders,
 *  so the same text always gets the same layout. Kerning is left out, which
 *  errs on the wide side. */

const CHARACTERS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~‘’“”–…£€·×'

const TABLES = {
  // Anton 400.
  anton: [234, 229, 429, 546, 462, 1057, 520, 214, 291, 291, 452, 355, 236, 311, 229, 405, 494, 331, 494, 494, 494, 494, 494, 494, 494, 494, 242, 245, 321, 311, 321, 492, 864, 485, 479, 474, 493, 412, 399, 485, 499, 227, 466, 472, 397, 746, 498, 486, 472, 494, 477, 461, 396, 474, 469, 712, 484, 446, 410, 318, 405, 318, 474, 365, 317, 483, 501, 491, 498, 488, 280, 504, 505, 243, 263, 491, 248, 758, 499, 497, 501, 498, 347, 475, 305, 499, 461, 696, 459, 461, 386, 340, 216, 340, 493, 235, 232, 464, 463, 311, 708, 474, 525, 234, 347],
  // Fraunces italic 400 at optical size 52 (its size on a carousel cover).
  fraunces: [192, 306, 324, 622, 554, 692, 654, 158, 351, 348, 601, 528, 226, 358, 220, 436, 641, 422, 574, 525, 552, 542, 582, 498, 550, 582, 274, 283, 494, 532, 494, 462, 844, 620, 646, 633, 730, 614, 586, 688, 767, 366, 355, 693, 545, 830, 682, 748, 640, 748, 668, 560, 569, 682, 603, 928, 633, 570, 592, 361, 416, 361, 422, 432, 215, 528, 530, 438, 536, 462, 302, 498, 550, 299, 284, 532, 294, 816, 564, 506, 524, 512, 444, 416, 348, 562, 536, 784, 556, 486, 474, 384, 297, 382, 589, 196, 188, 383, 373, 498, 744, 595, 662, 258, 481],
  // Archivo 700 at width 100 (the call card and the question).
  archivo700: [196, 301, 456, 600, 556, 973, 764, 253, 364, 364, 407, 641, 307, 333, 307, 300, 595, 596, 596, 596, 597, 595, 596, 596, 596, 595, 335, 335, 641, 641, 641, 613, 1001, 724, 722, 733, 739, 683, 622, 802, 754, 301, 603, 725, 591, 872, 754, 793, 681, 793, 730, 679, 641, 748, 694, 964, 706, 699, 653, 350, 300, 350, 641, 518, 228, 580, 608, 573, 608, 584, 325, 607, 602, 267, 264, 570, 267, 891, 602, 613, 608, 608, 380, 556, 342, 601, 547, 798, 572, 547, 519, 393, 253, 393, 641, 280, 280, 488, 488, 500, 973, 599, 599, 333, 641],
  // Archivo 600 at width 100 (a card's body).
  archivo600: [200, 292, 444, 583, 541, 966, 729, 246, 357, 357, 407, 636, 300, 333, 300, 298, 575, 576, 576, 576, 577, 575, 576, 576, 576, 575, 336, 336, 636, 636, 636, 613, 998, 709, 706, 721, 728, 672, 609, 794, 732, 282, 585, 695, 570, 844, 732, 782, 670, 782, 717, 667, 619, 724, 671, 954, 686, 677, 634, 339, 298, 339, 636, 507, 209, 556, 592, 547, 592, 561, 307, 591, 584, 252, 250, 543, 252, 861, 584, 598, 592, 592, 362, 541, 314, 583, 529, 758, 546, 529, 509, 394, 245, 394, 636, 280, 280, 482, 482, 500, 965, 580, 580, 333, 636],
  // Archivo 900 at width 112 (heavy: the captions).
  archivoHeavy: [233, 361, 545, 714, 676, 1080, 973, 300, 389, 389, 419, 703, 356, 373, 356, 307, 736, 698, 735, 737, 740, 737, 738, 709, 744, 738, 351, 356, 703, 703, 703, 674, 1120, 862, 851, 855, 852, 788, 734, 919, 917, 381, 714, 907, 724, 1071, 917, 917, 791, 917, 857, 799, 796, 908, 855, 1110, 866, 868, 796, 389, 307, 389, 703, 615, 325, 735, 728, 735, 728, 736, 455, 729, 725, 331, 328, 718, 331, 1096, 725, 736, 728, 728, 478, 676, 492, 725, 678, 1051, 746, 678, 618, 389, 287, 389, 703, 300, 300, 556, 556, 560, 1068, 730, 740, 374, 703],
} as const

export type HouseFace = keyof typeof TABLES | 'mono'

const INDEX = new Map([...CHARACTERS].map((character, index) => [character, index]))

function advance(face: HouseFace, character: string): number {
  // IBM Plex Mono is monospaced at 600 units.
  if (face === 'mono') return 600
  const index = INDEX.get(character)
  return index === undefined ? 600 : TABLES[face][index]!
}

/** The width in pixels of a run of text, with CSS letter-spacing in ems
 *  (which the browser adds after every character, the last one included). */
export function textWidth(face: HouseFace, text: string, sizePx: number, letterSpacingEm = 0): number {
  let units = 0
  for (const character of text) units += advance(face, character) + letterSpacingEm * 1000
  return units * sizePx / 1000
}

/** Greedy word wrap, as a browser breaks at spaces. `extraEm` widens given
 *  words (the swipe's padding). Returns the lines. */
export function wrapWords(face: HouseFace, text: string, sizePx: number, maxWidthPx: number, letterSpacingEm = 0, extraEm: ReadonlyMap<number, number> = new Map()): string[][] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const space = textWidth(face, ' ', sizePx, letterSpacingEm)
  const lines: string[][] = []
  let line: string[] = []
  let width = 0
  words.forEach((word, index) => {
    const wordWidth = textWidth(face, word, sizePx, letterSpacingEm) + (extraEm.get(index) ?? 0) * sizePx
    const next = line.length ? width + space + wordWidth : wordWidth
    if (line.length && next > maxWidthPx) {
      lines.push(line)
      line = [word]
      width = wordWidth
    } else {
      line.push(word)
      width = next
    }
  })
  if (line.length) lines.push(line)
  return lines
}

export function widestLine(face: HouseFace, lines: string[][], sizePx: number, letterSpacingEm = 0): number {
  return Math.max(0, ...lines.map((line) => textWidth(face, line.join(' '), sizePx, letterSpacingEm)))
}

/** The largest display size, in whole pixels and no larger than the mock's,
 *  at which an Anton headline (uppercase, line height 0.88) fits the box. */
export function fitDisplaySize(text: string, options: { maxSizePx: number; minSizePx: number; maxWidthPx: number; maxHeightPx: number; lineHeight?: number; letterSpacingEm?: number; swipeWordIndex?: number }): { sizePx: number; lines: number } {
  const upper = text.toUpperCase()
  const lineHeight = options.lineHeight ?? 0.88
  const letterSpacing = options.letterSpacingEm ?? 0.005
  const extra = new Map(options.swipeWordIndex === undefined ? [] : [[options.swipeWordIndex, 0.2]])
  for (let size = options.maxSizePx; size > options.minSizePx; size -= 2) {
    const lines = wrapWords('anton', upper, size, options.maxWidthPx, letterSpacing, extra)
    const fits = lines.length * size * lineHeight <= options.maxHeightPx && widestLine('anton', lines, size, letterSpacing) <= options.maxWidthPx
    if (fits) return { sizePx: size, lines: lines.length }
  }
  return { sizePx: options.minSizePx, lines: wrapWords('anton', upper, options.minSizePx, options.maxWidthPx, letterSpacing, extra).length }
}
