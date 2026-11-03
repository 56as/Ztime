export const refreshGlyph='<svg class="review-refresh-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5 M19.4 11a7.4 7.4 0 1 0-2 6.5"/></svg>';
export function refreshControl(attribute, page) {
  if(page)return `<button ${attribute} class="sand-seal sand-motion" aria-label="刷新${page}" title="刷新${page}"><img src="./brand-icon.png" alt=""></button>`;
  return `<button ${attribute} class="refresh-control" aria-label="更新" title="更新">${refreshGlyph}</button>`;
}
