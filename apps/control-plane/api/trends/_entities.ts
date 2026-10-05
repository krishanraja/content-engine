// Alias matching for the entity layer. Pure, no client, no I/O.
//
// The nine lanes are a taxonomy of SUBJECTS: model, economics, governance. They
// answer "is agentic orchestration rising" and they cannot answer "how is
// Anthropic's share of coverage moving against OpenAI", because until
// trend_entities there was no company, lab, model or person anywhere in the
// system. Every competitive question is about things that act.
//
// This is the cheap extractor and deliberately the first one: curated aliases,
// word-boundary matched, no model call, no key, fully deterministic. It misses
// a lab nobody has added to the registry, and that miss is visible and fixed by
// adding a row, which is a much better failure than an LLM quietly inventing an
// entity or tagging one company three ways.

export interface Entity {
  slug: string
  aliases: string[]
}

/**
 * One case-insensitive, word-bounded matcher per alias.
 *
 * The boundaries are the whole quality of the series. Without them 'rag'
 * matches 'fragment' and 'storage', 'mcp' matches inside an identifier, and
 * the chart looks busy while meaning nothing. A false positive here does not
 * throw: it inflates somebody's share of voice for months and the chart gives
 * no hint.
 *
 * The boundary is letters AND digits, not the \b of a plain word boundary, so
 * 'gpt' does not match inside 'gpt5'. The alias is escaped because real ones
 * contain dots ('x.ai') and hyphens ('gpt-4'), and an unescaped dot matches
 * any character, which is the same bug wearing a different hat.
 */
export function aliasMatcher(alias: string): RegExp {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu')
}

/**
 * Which entities a piece of text mentions, with the alias that matched so a
 * bad alias can be found and fixed rather than merely distrusted.
 *
 * An entity is returned once however many of its aliases hit, or an entity
 * with more synonyms in the registry would outrank one with fewer purely
 * because somebody was more thorough writing it up.
 */
export function matchEntities(
  text: string,
  entities: Entity[],
): Array<{ slug: string; matchedOn: string }> {
  const out: Array<{ slug: string; matchedOn: string }> = []
  for (const entity of entities) {
    for (const alias of entity.aliases) {
      if (!alias) continue
      if (aliasMatcher(alias).test(text)) {
        out.push({ slug: entity.slug, matchedOn: alias })
        break
      }
    }
  }
  return out
}
