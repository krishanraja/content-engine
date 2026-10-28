/** JSON-value transport: escape values only; keys retain their original spelling. */
function mapStrings<T>(value: T, transform: (text: string) => string): T {
  if (typeof value === 'string') return transform(value) as T
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, transform)) as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, transform)])) as T
  }
  return value
}

export function toAsciiProps<T>(value: T): T {
  return mapStrings(value, (text) => text.replace(/[\\\u007f-\uffff]/g,
    (unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`))
}

export function fromAsciiProps<T>(value: T): T {
  // One pass preserves literal escape text whose backslash was itself escaped.
  return mapStrings(value, (text) => text.replace(/\\u([0-9a-f]{4})/g,
    (_, hex: string) => String.fromCharCode(parseInt(hex, 16))))
}

/** In-place radix-2 FFT, used to avoid billions of multiply-adds per 10 s probe. */
function fft(real: Float64Array, imaginary: Float64Array, inverse = false): void {
  const n = real.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const oldReal = real[i]!
      const oldImaginary = imaginary[i]!
      real[i] = real[j]!
      imaginary[i] = imaginary[j]!
      real[j] = oldReal
      imaginary[j] = oldImaginary
    }
  }
  for (let size = 2; size <= n; size *= 2) {
    const angle = (inverse ? 2 : -2) * Math.PI / size
    const stepReal = Math.cos(angle)
    const stepImaginary = Math.sin(angle)
    for (let start = 0; start < n; start += size) {
      let wr = 1
      let wi = 0
      for (let j = 0; j < size / 2; j++) {
        const a = start + j
        const b = a + size / 2
        const br = real[b]! * wr - imaginary[b]! * wi
        const bi = real[b]! * wi + imaginary[b]! * wr
        real[b] = real[a]! - br
        imaginary[b] = imaginary[a]! - bi
        real[a] = real[a]! + br
        imaginary[a] = imaginary[a]! + bi
        const nextReal = wr * stepReal - wi * stepImaginary
        wi = wr * stepImaginary + wi * stepReal
        wr = nextReal
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) {
    real[i] = real[i]! / n
    imaginary[i] = imaginary[i]! / n
  }
}

/** Positive means rendered audio is late: rendered[i + lag] matches stem[i]. */
export function lagSamples(rendered: Float32Array, stem: Float32Array, maxLag: number): number {
  if (!Number.isInteger(maxLag) || maxLag < 0 || Math.min(rendered.length, stem.length) <= maxLag) {
    throw new Error('lagSamples requires nonempty signals longer than the nonnegative integer maxLag')
  }
  let size = 1
  while (size < rendered.length + stem.length - 1) size *= 2
  const rr = new Float64Array(size)
  const ri = new Float64Array(size)
  const sr = new Float64Array(size)
  const si = new Float64Array(size)
  const renderedEnergy = new Float64Array(rendered.length + 1)
  const stemEnergy = new Float64Array(stem.length + 1)
  for (let i = 0; i < rendered.length; i++) {
    const sample = rendered[i]!
    if (!Number.isFinite(sample)) throw new Error('rendered audio has nonfinite samples')
    rr[i] = sample
    renderedEnergy[i + 1] = renderedEnergy[i]! + sample * sample
  }
  for (let i = 0; i < stem.length; i++) {
    const sample = stem[i]!
    if (!Number.isFinite(sample)) throw new Error('stem audio has nonfinite samples')
    sr[stem.length - 1 - i] = sample
    stemEnergy[i + 1] = stemEnergy[i]! + sample * sample
  }
  if (!renderedEnergy[rendered.length] || !stemEnergy[stem.length]) {
    throw new Error('cannot measure lag of silent audio')
  }
  fft(rr, ri)
  fft(sr, si)
  for (let i = 0; i < size; i++) {
    const real = rr[i]! * sr[i]! - ri[i]! * si[i]!
    ri[i] = rr[i]! * si[i]! + ri[i]! * sr[i]!
    rr[i] = real
  }
  fft(rr, ri, true)
  let bestLag = 0
  let bestScore = -Infinity
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const startRendered = Math.max(0, lag)
    const startStem = Math.max(0, -lag)
    const count = Math.min(rendered.length - startRendered, stem.length - startStem)
    const energy = (renderedEnergy[startRendered + count]! - renderedEnergy[startRendered]!) *
      (stemEnergy[startStem + count]! - stemEnergy[startStem]!)
    if (energy <= 0) continue
    const score = rr[stem.length - 1 + lag]! / Math.sqrt(energy)
    if (score > bestScore + 1e-12 || (Math.abs(score - bestScore) <= 1e-12 && Math.abs(lag) < Math.abs(bestLag))) {
      bestScore = score
      bestLag = lag
    }
  }
  return bestLag === 0 ? 0 : bestLag
}
