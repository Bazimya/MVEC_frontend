// Category helpers shared by the header's Categories menu and the Shop filter.
// Categories come from the API as a flat list; a sub-category carries its
// parent's id in `parentId`.

const idOf = (c) => String(c?.id || c?._id || '');
const parentOf = (c) => (c?.parentId ? String(c.parentId) : '');

/**
 * [{ ...root, children: [...] }] sorted by name. A sub-category whose parent is
 * missing from the list (hidden or deleted) is shown as a main category instead
 * of disappearing.
 */
export function groupCategories(list) {
  const all = (Array.isArray(list) ? list : []).filter((c) => c?.name);
  const ids = new Set(all.map(idOf));
  const byName = (a, b) => a.name.localeCompare(b.name);
  const childrenOf = (parent) => all.filter((c) => parentOf(c) === idOf(parent) && idOf(c) !== idOf(parent)).sort(byName);

  const roots = all.filter((c) => !parentOf(c) || !ids.has(parentOf(c)));
  // Anything no real root leads to (a category that is its own parent, or a loop
  // in the data) would vanish from the menu: show it as a main category instead.
  const reached = new Set();
  const visit = (c) => { if (!reached.has(idOf(c))) { reached.add(idOf(c)); childrenOf(c).forEach(visit); } };
  roots.forEach(visit);
  for (const c of all) {
    if (!reached.has(idOf(c))) { roots.push(c); visit(c); }
  }
  return roots.sort(byName).map((root) => ({ ...root, children: childrenOf(root) }));
}

/**
 * Names that count as "in" `name` when shopping: the category itself and every
 * sub-category beneath it, so choosing "Fashion" also shows products filed under
 * "Fashion > Shoes". An unknown name matches only itself.
 */
export function namesWithin(list, name) {
  const all = Array.isArray(list) ? list : [];
  const names = new Set([name]);
  const start = all.find((c) => c?.name === name);
  if (!start) return names;
  const seen = new Set([idOf(start)]);
  const queue = [idOf(start)];
  while (queue.length) {
    const parent = queue.shift();
    for (const c of all) {
      if (parentOf(c) === parent && !seen.has(idOf(c))) {
        seen.add(idOf(c));
        names.add(c.name);
        queue.push(idOf(c));
      }
    }
  }
  return names;
}
