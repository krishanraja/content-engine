import type { StoryStandoffProps } from './props'
import sunoLogo from './logos/suno-logo-cream.svg'
import warnerLogo from './logos/wmg-symbol-cream.svg'
import universalLogo from './logos/umg-logo-cream.svg'
import sonyLogo from './logos/sonymusic-symbol-cream.svg'

/** Monday 12 October (follow.the.money), the stand-off's default props.
 *  The logos are the official files, unaltered: Suno is
 *  docs/plans/2026-10-12-monday/logos/suno-logo-cream.svg; Warner, Universal
 *  and Sony are the individual marks embedded in cover-partners-cream.svg and
 *  cover-suing-cream.svg there (BMG, in the same file, is left out). */
export function mondayStandoffProps(shape: StoryStandoffProps['shape']): StoryStandoffProps {
  return {
    shape,
    seriesColour: '#FFD84D',
    seriesName: 'follow.the.money',
    left: { name: 'Suno', logos: [sunoLogo], tag: 'AI song app' },
    right: [
      { name: 'Warner', logos: [warnerLogo], tag: 'Suing', tagTone: 'coral', tagAfter: 'Paid', tagAfterTone: 'mint', switchesSides: true },
      { name: 'Universal', logos: [universalLogo], tag: 'Suing', tagTone: 'coral' },
      { name: 'Sony', logos: [sonyLogo], tag: 'Suing', tagTone: 'coral' },
    ],
    title: 'Who gets paid for AI songs?',
    titleEmphasis: 'gets paid',
    link: 'makeyourmindup.ai',
    commentQuestion: 'Should a singer get paid when an AI learns from their song?',
    nextLabel: 'Wednesday · under.the.hood',
    // The live brand files; story_io.py props embeds them as data URIs instead.
    brand: { wordmark: 'https://www.makeyourmindup.ai/brand/wordmark.png', masthead: 'https://www.makeyourmindup.ai/brand/masthead.png' },
  }
}
