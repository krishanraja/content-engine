/** AI keeps ink beneath a 45 degree inkSoft hatch, including mixed layers. */
export const hatch = (ink: string, inkSoft: string) => `repeating-linear-gradient(45deg, transparent 0px, transparent 7px, ${inkSoft} 7px, ${inkSoft} 9px), linear-gradient(${ink}, ${ink})`
