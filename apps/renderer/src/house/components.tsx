import React from 'react'
import { cancelRender, continueRender, delayRender, Img } from 'remotion'
import './fonts.css'
import { HOUSE, HOUSE_FONT_FAMILIES, HOUSE_FONTS, HOUSE_GRAIN_IMAGE, HOUSE_GRAIN_OPACITY, HOUSE_HALFTONE } from './geometry'

/** The house colours a frame is drawn in: ink, cream and mint, and the one
 *  section colour the piece belongs to. */
export interface HouseTokens {
  ink: string
  inkDeep: string
  inkSoft: string
  cream: string
  mint: string
  section: string
}

export interface HouseImage {
  src: string
  pixelWidth: number
  pixelHeight: number
}

const SAMPLE_TEXT = 'Aa0Ā'

/** Holds the frame until the four house faces are loaded, so the first frame
 *  and every still are set in them. */
export function HouseFontsGate() {
  const [handle] = React.useState(() => delayRender('makeyourmindup house fonts'))
  React.useEffect(() => {
    const faces = [
      `400 64px "${HOUSE_FONT_FAMILIES.display}"`,
      `900 68px "${HOUSE_FONT_FAMILIES.structure}"`,
      `600 44px "${HOUSE_FONT_FAMILIES.structure}"`,
      `italic 400 52px "${HOUSE_FONT_FAMILIES.dek}"`,
      `500 28px "${HOUSE_FONT_FAMILIES.data}"`,
      `600 40px "${HOUSE_FONT_FAMILIES.data}"`,
    ]
    Promise.all(faces.map((face) => document.fonts.load(face, SAMPLE_TEXT)))
      .then(() => continueRender(handle))
      .catch((error: unknown) => cancelRender(error))
  }, [handle])
  return null
}

/** Fractal noise at 7%, the last layer of a dark block. */
export function Grain() {
  return <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: HOUSE_GRAIN_IMAGE, opacity: HOUSE_GRAIN_OPACITY, pointerEvents: 'none', mixBlendMode: 'screen' }} />
}

/** A section's colour block with its halftone ink dots. */
export function ColourBlock({ tokens }: { tokens: HouseTokens }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: tokens.section }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: HOUSE_HALFTONE.image, backgroundSize: `${HOUSE_HALFTONE.size}px ${HOUSE_HALFTONE.size}px`, pointerEvents: 'none' }} />
    </div>
  )
}

/** The mint highlighter swipe behind the one loud word, skewed 8 degrees.
 *  `display` is the swipe in an Anton headline. */
export function Swipe({ children, tokens, display = false }: { children: React.ReactNode; tokens: HouseTokens; display?: boolean }) {
  const inset = display ? HOUSE.swipe.display : HOUSE.swipe.text
  return (
    <span style={{ position: 'relative', zIndex: 0, color: tokens.ink, padding: `0 ${HOUSE.swipe.paddingEm}em`, whiteSpace: 'nowrap', ...(display ? { display: 'inline-block', lineHeight: HOUSE.swipe.display.lineHeight } : {}) }}>
      <span aria-hidden style={{ position: 'absolute', zIndex: -1, left: `${inset.left}em`, right: `${inset.right}em`, top: `${inset.top}em`, bottom: `${inset.bottom}em`, background: tokens.mint, transform: `skewX(${HOUSE.swipe.skewDegrees}deg)` }} />
      {children}
    </span>
  )
}

/** Text with its one swiped word (an index into `text.split(/(\s+)/)`). */
export function SwipedText({ text, swipeIndex, tokens, display = false }: { text: string; swipeIndex: number; tokens: HouseTokens; display?: boolean }) {
  return <>{text.split(/(\s+)/).map((part, index) => index === swipeIndex
    ? <Swipe key={index} tokens={tokens} display={display}>{part}</Swipe>
    : <React.Fragment key={index}>{part}</React.Fragment>)}</>
}

/** A sticker: the voice in miniature, slapped on and tilted. */
export function Sticker({ text, background, tokens, style, sizePx = HOUSE.sticker.size, paddingX = HOUSE.sticker.paddingX, paddingY = HOUSE.sticker.paddingY }: { text: string; background: string; tokens: HouseTokens; style: React.CSSProperties; sizePx?: number; paddingX?: number; paddingY?: number }) {
  return (
    <div style={{
      position: 'absolute',
      fontFamily: HOUSE_FONTS.data,
      fontWeight: HOUSE.sticker.weight,
      fontSize: sizePx,
      lineHeight: HOUSE.sticker.lineHeight,
      letterSpacing: `${HOUSE.sticker.letterSpacingEm}em`,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      color: tokens.ink,
      background,
      border: `${HOUSE.sticker.border}px solid ${tokens.ink}`,
      borderRadius: 999,
      padding: `${paddingY}px ${paddingX}px`,
      boxShadow: `${HOUSE.sticker.shadow}px ${HOUSE.sticker.shadow}px 0 ${tokens.ink}`,
      ...style,
    }}>{text}</div>
  )
}

/** The section pill: the section's name in mono, lowercase, joined by dots.
 *  On ink it is ink on the section colour; on a colour block, the reverse. */
export function SectionPill({ label, tokens, onColour, sizePx = HOUSE.pill.size }: { label: string; tokens: HouseTokens; onColour: boolean; sizePx?: number }) {
  return (
    <span style={{
      fontFamily: HOUSE_FONTS.data,
      fontWeight: HOUSE.pill.weight,
      fontSize: sizePx,
      letterSpacing: `${HOUSE.pill.letterSpacingEm}em`,
      padding: `${HOUSE.pill.paddingY}px ${HOUSE.pill.paddingX}px`,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      background: onColour ? tokens.ink : tokens.section,
      color: onColour ? tokens.section : tokens.ink,
    }}>{label}</span>
  )
}

/** A mono label: Plex Mono 500, tracked, uppercase. */
export function MonoLabel({ children, style, sizePx = HOUSE.mono.size }: { children: React.ReactNode; style?: React.CSSProperties; sizePx?: number }) {
  return <span style={{ fontFamily: HOUSE_FONTS.data, fontWeight: HOUSE.mono.weight, fontSize: sizePx, letterSpacing: `${HOUSE.mono.letterSpacingEm}em`, textTransform: 'uppercase', whiteSpace: 'nowrap', ...style }}>{children}</span>
}

/** A pinned logo file, whole and untouched, at a width. It sits above every
 *  grain layer, because the brand book lets the logo take no effects. */
export function HouseLogo({ image, width }: { image: HouseImage; width: number }) {
  return <Img src={image.src} style={{ display: 'block', position: 'relative', zIndex: 1, width, height: width * image.pixelHeight / image.pixelWidth, maxWidth: 'none' }} />
}

/** The mark on its ink tile, with grain on the tile but never on the mark
 *  (left off where the tile sits on an ink card whose own grain already
 *  covers it). */
export function MarkTile({ image, size, imageWidth, tokens, style, grain = true }: { image: HouseImage; size: number; imageWidth: number; tokens: HouseTokens; style?: React.CSSProperties; grain?: boolean }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, background: tokens.ink, display: 'grid', placeItems: 'center', ...style }}>
      <HouseLogo image={image} width={imageWidth} />
      {grain ? <Grain /> : null}
    </div>
  )
}

/** The ticker's star, drawn so it is the same on every machine. */
export function TickerStar({ color }: { color: string }) {
  const size = HOUSE.band.starSize
  const width = size * 0.84
  const height = size * 1.164
  const radius = size * 0.3
  const cx = width * 0.46
  const cy = height * 0.55
  const c = radius * 0.25
  const path = `M ${cx} ${cy - radius} Q ${cx + c} ${cy - c} ${cx + radius} ${cy} Q ${cx + c} ${cy + c} ${cx} ${cy + radius} Q ${cx - c} ${cy + c} ${cx - radius} ${cy} Q ${cx - c} ${cy - c} ${cx} ${cy - radius} Z`
  return <svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', flex: 'none' }}><path d={path} fill={color} /></svg>
}
