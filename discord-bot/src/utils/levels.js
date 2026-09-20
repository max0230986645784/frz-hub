export function levelForXp(xp) {
  let level = 0;
  while (xp >= 5 * level ** 2 + 50 * level + 100) level += 1;
  return level;
}
