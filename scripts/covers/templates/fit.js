async function fitCover() {
  await Promise.all([...document.images].map(image => image.decode()));
  await Promise.all([...document.fonts].map(font => font.load()));
  await document.fonts.ready;
  for (const element of document.querySelectorAll('[data-fit]')) {
    let size = Number(element.dataset.fit);
    element.style.fontSize = size + 'px';
    while (size > 8 && (element.scrollHeight > element.clientHeight + 1 ||
                        element.scrollWidth > element.clientWidth + 1)) {
      element.style.fontSize = --size + 'px';
    }
    if (element.hasAttribute('data-bottom')) {
      const inner = element.querySelector('.inner');
      element.style.paddingTop = Math.max(0, element.clientHeight - inner.offsetHeight) + 'px';
    }
  }
  const regions = [];
  const bounds = (role, rect) => regions.push({role, left: rect.left, top: rect.top,
                                               right: rect.right, bottom: rect.bottom});
  for (const element of document.querySelectorAll('.fit')) {
    if (element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1) {
      throw new Error('Cover text overflows at minimum size');
    }
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim() || node.parentElement.closest('script,svg')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) bounds('text', rect);
  }
  bounds('mark', document.querySelector('.wm').getBoundingClientRect());
  const proof = document.querySelector('.paper');
  if (proof) bounds('proof', proof.getBoundingClientRect());
  const photo = document.querySelector('.ph');
  if (photo) {
    const rect = photo.getBoundingClientRect();
    if (getComputedStyle(photo).objectFit === 'contain') bounds('subject', rect);
    else {
      const [x, y] = getComputedStyle(photo).objectPosition.split(' ').map(v => parseFloat(v) / 100);
      const px = rect.left + rect.width * x;
      const py = rect.top + rect.height * y;
      bounds('subject', {left: px, right: px, top: py, bottom: py});
    }
  }
  return regions;
}
window.coverReady = fitCover();
