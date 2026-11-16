/** Spot inks, paper and shadow. All still colour values live here, including device tokens. */
const inks = [
  ['#0C1512','#7EF0C0','#F4EFE4'], ['#121918','#B7A6FF','#F3EEDF'],
  ['#171C19','#E8CD85','#FFF5DC'], ['#080E12','#8BD9CB','#EAF4EF'],
  ['#15202B','#69C6ED','#F4F6ED'], ['#24192E','#EBA8B5','#FCF0E3'],
  ['#081E18','#81F1AD','#E6EFE1'], ['#232623','#B5C98B','#F8F1DA'],
  ['#18232A','#B0D8EC','#E8F1F3'], ['#3A2721','#E6AA73','#FFF3D9'],
  ['#172436','#F2C66F','#F4ECDD'], ['#242018','#CF724B','#F8E8CB'],
  ['#18252A','#8EC1AC','#FFF6DA'], ['#23182C','#C9A3E8','#F1E7DB'],
  ['#283129','#A7CD70','#F7F1E2'], ['#292236','#D9B5DC','#FFF3EA'],
  ['#272A32','#9EB9DC','#F4EEDF'], ['#302419','#F0CE84','#FEF2D1'],
  ['#14312D','#8AC8B7','#EAF6DD'], ['#2F2632','#E2A090','#FFF4ED'],
  ['#232F3A','#E5CE9C','#F3F0E4'], ['#19272B','#80D2C2','#F5F0DA'],
  ['#292330','#B7B2EC','#F5EEEB'], ['#2D2B20','#C4CE88','#FFF8DC'],
  ['#302623','#DDAC95','#F9EEE2'], ['#202B34','#A4C8E1','#EEF4ED'],
  ['#292031','#D3A5CF','#FAF0E8'], ['#20312E','#9AD4BB','#F4F8E6'],
  ['#32291C','#E4BD76','#FFF3DA'], ['#22253A','#ACB5EB','#EFEFF5'],
  ['#342225','#E9A8B1','#FFF0ED'], ['#192E34','#9ACFD5','#F1F6EF'],
  ['#2B3020','#C8D191','#F9F6DD'], ['#332733','#DAB2D2','#FCF1F6'],
  ['#1C2D2A','#95D9C7','#EFF9E8'], ['#302B25','#E6C3A0','#FFF2DE'],
  ['#262D3B','#B4C6E9','#F1F4F8'], ['#342C23','#D8C09B','#FFF8EB'],
  ['#23352E','#A9D4B0','#F5F8E7'], ['#38292E','#E4B4BD','#FFF3F2'],
  ['#1B3036','#98CDDF','#ECF5F7'], ['#303125','#D4D39A','#FAF9E5'],
  ['#30273C','#CDB4EC','#F5F0FA'], ['#362A21','#ECC396','#FFF6E4'],
  ['#213536','#A4D4D1','#F0F9F1'], ['#332A34','#DFB6D8','#FBF0F9'],
  ['#2C3425','#BED6A1','#F8FAEC'], ['#29303C','#AEC7E6','#F0F4FC'],
] as const
export type Palette = { ground: string; ink: string; signal: string; paper: string; shade: string }
export const PALETTES: Record<string, Palette> = Object.fromEntries(inks.map(([ink,signal,paper], i) =>
  [`ink-${i}`, { ground: ink, ink, signal, paper, shade: ink }]))
export const tokensFor = (p: Palette) => ({ ink:p.ink, inkDeep:p.ink, inkSoft:p.ink, cream:p.paper, mint:p.signal, channel:p.signal })
