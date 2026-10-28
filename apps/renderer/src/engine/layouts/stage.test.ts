import { describe, expect, it } from 'vitest'
import { slotsFor } from './index'

const previous = {
  "9:16": {
    "P1": [
      {
        "left": 120,
        "top": 288,
        "width": 768,
        "height": 552
      },
      {
        "left": 144,
        "top": 312,
        "width": 720,
        "height": 160
      }
    ],
    "P3": [
      {
        "left": 120,
        "top": 288,
        "width": 768,
        "height": 324
      },
      {
        "left": 120,
        "top": 624,
        "width": 768,
        "height": 216
      },
      {
        "left": 120,
        "top": 852,
        "width": 660,
        "height": 290
      }
    ],
    "P6": [
      {
        "left": 120,
        "top": 288,
        "width": 768,
        "height": 552
      },
      {
        "left": 424,
        "top": 576,
        "width": 464,
        "height": 264
      }
    ],
    "F1": [
      {
        "left": 120,
        "top": 852,
        "width": 660,
        "height": 290
      },
      {
        "left": 120,
        "top": 288,
        "width": 768,
        "height": 400
      },
      {
        "left": 120,
        "top": 700,
        "width": 768,
        "height": 140
      }
    ],
    "F3": [
      {
        "left": 120,
        "top": 376,
        "width": 768,
        "height": 464
      },
      {
        "left": 120,
        "top": 288,
        "width": 768,
        "height": 72
      }
    ]
  },
  "16:9": {
    "P1": [
      {
        "left": 96,
        "top": 208,
        "width": 1728,
        "height": 572
      },
      {
        "left": 132,
        "top": 232,
        "width": 640,
        "height": 200
      }
    ],
    "P3": [
      {
        "left": 96,
        "top": 208,
        "width": 1026,
        "height": 420
      },
      {
        "left": 1140,
        "top": 54,
        "width": 684,
        "height": 726
      },
      {
        "left": 96,
        "top": 640,
        "width": 1026,
        "height": 140
      }
    ],
    "P6": [
      {
        "left": 96,
        "top": 208,
        "width": 1728,
        "height": 572
      },
      {
        "left": 998,
        "top": 400,
        "width": 826,
        "height": 380
      }
    ],
    "F1": [
      {
        "left": 1176,
        "top": 54,
        "width": 648,
        "height": 490
      },
      {
        "left": 96,
        "top": 208,
        "width": 1056,
        "height": 572
      },
      {
        "left": 1176,
        "top": 560,
        "width": 648,
        "height": 220
      }
    ],
    "F3": [
      {
        "left": 96,
        "top": 208,
        "width": 1728,
        "height": 572
      },
      {
        "left": 900,
        "top": 70,
        "width": 924,
        "height": 96
      }
    ]
  }
} as const

describe('STAGE slots', () => {
  it.each([
    ['9:16', { left: 0, top: 0, width: 1080, height: 1920 }],
    ['16:9', { left: 0, top: 0, width: 1920, height: 1080 }],
  ] as const)('uses the whole %s canvas for every device', (aspect, canvas) => {
    expect(slotsFor('STAGE', aspect)).toEqual([canvas])
    const boxes = slotsFor('STAGE', aspect, 3)
    expect(boxes).toEqual([canvas, canvas, canvas])
    boxes[0]!.left = 10
    expect(boxes[1]).toEqual(canvas)
    expect(slotsFor('STAGE', aspect)).toEqual([canvas])
    expect(slotsFor('STAGE', aspect, 0)).toEqual([])
  })

  for (const aspect of ['9:16', '16:9'] as const) {
    for (const layout of ['P1', 'P3', 'P6', 'F1', 'F3'] as const) {
      it(`preserves ${layout} in ${aspect}, ignoring count`, () => {
        expect(slotsFor(layout, aspect)).toEqual(previous[aspect][layout])
        expect(slotsFor(layout, aspect, 3)).toEqual(previous[aspect][layout])
      })
    }
  }
})
