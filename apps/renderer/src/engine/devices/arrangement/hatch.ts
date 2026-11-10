/** Eight-pixel, 45-degree cream machine hatch over ink. */
export const hatch = (ink: string, cream: string) => `repeating-linear-gradient(45deg, transparent 0px, transparent 7px, color-mix(in srgb, ${cream} 30%, transparent) 7px, color-mix(in srgb, ${cream} 30%, transparent) 8px), linear-gradient(${ink}, ${ink})`
