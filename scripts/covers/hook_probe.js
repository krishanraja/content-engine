() => {
  // The first fitted box is the lead figure on number-led covers and the headline on every other wide.
  const hook = document.querySelector('[data-box] .fit');
  if (!hook) throw new Error('Wide cover has no fitted headline or figure');
  hook.setAttribute('data-gate-hook', '');
  const walker = document.createTreeWalker(hook, NodeFilter.SHOW_TEXT);
  const glyphs = [];
  const faces = new Map();
  const range = document.createRange();
  while (walker.nextNode()) {
    const text = walker.currentNode;
    const style = getComputedStyle(text.parentElement);
    for (const match of text.data.matchAll(/[\p{L}\p{N}\p{S}%]/gu)) {
      range.setStart(text, match.index);
      range.setEnd(text, match.index + match[0].length);
      const rect = range.getBoundingClientRect();
      glyphs.push([rect.left, rect.top, rect.right, rect.bottom]);
    }
    if (!/[\p{L}\p{N}\p{S}%]/u.test(text.data)) continue;
    const properties = Object.fromEntries(Array.from(style)
      .filter(k => k.startsWith('font-') || k === '-webkit-font-smoothing' || k === 'text-rendering')
      .map(k => [k, style.getPropertyValue(k)]));
    faces.set(JSON.stringify(properties), properties);
  }
  if (!glyphs.length) throw new Error('Wide headline or figure contains no measurable type');
  return {glyphs, faces: [...faces.values()]};
}
