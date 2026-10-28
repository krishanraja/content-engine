/** Direct port of ref/H/build.py: eight unknowns, h22 fixed at one. */
export type Point = readonly [number, number]
export type Homography = readonly [Point3, Point3, Point3]
type Point3 = readonly [number, number, number]
export function homography(src: readonly Point[], dst: readonly Point[]): Homography {
  if (src.length !== 4 || dst.length !== 4) throw new Error('homography needs four point pairs')
  const a: number[][] = []
  src.forEach(([x, y], i) => {
    const [X, Y] = dst[i]!
    a.push([x,y,1,0,0,0,-X*x,-X*y,X], [0,0,0,x,y,1,-Y*x,-Y*y,Y])
  })
  for (let col = 0; col < 8; col++) {
    let pivot = col
    for (let row = col + 1; row < 8; row++) if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row
    ;[a[col], a[pivot]] = [a[pivot]!, a[col]!]
    const divisor = a[col]![col]!
    if (Math.abs(divisor) < 1e-12) throw new Error('singular homography')
    for (let j = col; j <= 8; j++) a[col]![j] = a[col]![j]! / divisor
    for (let row = 0; row < 8; row++) if (row !== col) {
      const factor = a[row]![col]!
      for (let j = col; j <= 8; j++) a[row]![j] = a[row]![j]! - factor * a[col]![j]!
    }
  }
  const h = a.map(row => row[8]!)
  return [[h[0]!,h[1]!,h[2]!], [h[3]!,h[4]!,h[5]!], [h[6]!,h[7]!,1]]
}
export function matrix3d(h: Homography): string {
  return 'matrix3d(' + [h[0][0],h[1][0],0,h[2][0],h[0][1],h[1][1],0,h[2][1],0,0,1,0,h[0][2],h[1][2],0,1].map(x => x.toFixed(8)).join(',') + ')'
}
