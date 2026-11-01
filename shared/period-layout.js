export const cardTitles = {trend:'使用时间', ranking:'应用排行', compare:'期间对比'};

export function validCardLayout(rows) {
  return Array.isArray(rows) && rows.length === Object.keys(cardTitles).length &&
    rows.every(row => row && Object.hasOwn(cardTitles,row.key) && typeof row.visible === 'boolean') &&
    new Set(rows.map(row => row.key)).size === rows.length;
}

export function defaultCardLayout() {
  return Object.keys(cardTitles).map(key => ({key,visible:key!=='compare'}));
}
