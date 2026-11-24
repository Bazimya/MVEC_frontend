import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { categoriesApi } from '../API/categories';
import { mapBackendCategory } from '../services/catalogApi';
import { useLoader } from '../lib/useLoader';
import { groupCategories } from '../utils/categories';

/** The shop's categories, straight from the API (never a fixed list), grouped main category → sub-categories. */
export function useNavCategories() {
  const { data, loading, error, reload } = useLoader(['nav', 'categories'], () => categoriesApi.getAll().then((r) => (r.categories || []).map(mapBackendCategory).filter(Boolean)));
  const groups = useMemo(() => groupCategories(data || []), [data]);
  return { groups, loading, error, reload };
}

const shopLink = (name) => `/shop?category=${encodeURIComponent(name)}`;

/** What goes inside the menu: loading, a retry on error, an empty note, or the categories. */
function CategoryList({ menu, active, onPick }) {
  const { groups, loading, error, reload } = menu;
  if (loading) {
    return <div className="cats-state" aria-busy="true"><span className="cats-skel" /><span className="cats-skel" /><span className="cats-skel" /><span className="cats-skel" /></div>;
  }
  if (error) {
    return <div className="cats-state note" role="alert">We couldn&apos;t load the categories. <button type="button" className="text-btn" onClick={reload}>Try again</button></div>;
  }
  if (!groups.length) return <div className="cats-state note">No categories yet. Sellers are still setting up.</div>;
  return (
    <div className="cats-grid">
      {groups.map((g) => (
        <div className="cats-group" key={g.id || g.name}>
          <Link to={shopLink(g.name)} onClick={onPick} className={'cats-main' + (active === g.name ? ' is-active' : '')} aria-current={active === g.name ? 'page' : undefined}>
            {g.name}{g.productCount > 0 && <em>{g.productCount}</em>}
          </Link>
          {g.children.map((c) => (
            <Link key={c.id || c.name} to={shopLink(c.name)} onClick={onPick} className={'cats-sub' + (active === c.name ? ' is-active' : '')} aria-current={active === c.name ? 'page' : undefined}>
              {c.name}{c.productCount > 0 && <em>{c.productCount}</em>}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

const Chevron = ({ open }) => <svg className={'cats-chev' + (open ? ' open' : '')} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;

/**
 * Header "Categories" with a dropdown. A mouse opens it on hover, and a click,
 * Enter or Space toggles it (touch and keyboard); Escape, a click outside, or
 * moving focus away closes it. The list loads with the page and is cached.
 */
export function CategoriesDropdown({ active, menu, closeSignal }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const timer = useRef(null);
  const panelId = useId();

  useEffect(() => { setOpen(false); }, [closeSignal]); // a page change closes it
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', esc); };
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const hover = (on) => (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(timer.current);
    // A short grace period so crossing the gap to the panel doesn't close it.
    timer.current = setTimeout(() => setOpen(on), on ? 60 : 160);
  };

  return (
    <div
      className="cats-wrap"
      ref={wrap}
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
    >
      <button type="button" className={'cats-btn' + (active ? ' is-active' : '')} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
        Categories <Chevron open={open} />
      </button>
      {open && (
        <div className="cats-panel" id={panelId}>
          <CategoryList menu={menu} active={active} onPick={() => setOpen(false)} />
          <Link to="/shop" className="cats-all" onClick={() => setOpen(false)}>Browse all products</Link>
        </div>
      )}
    </div>
  );
}

/** The phone drawer's version: a row that expands in place. */
export function CategoriesAccordion({ active, menu }) {
  const [open, setOpen] = useState(Boolean(active));
  const panelId = useId();
  return (
    <div className="cats-acc">
      <button type="button" className="cats-acc-btn" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
        <span>Categories</span> <Chevron open={open} />
      </button>
      {open && (
        <div id={panelId} className="cats-acc-body">
          <CategoryList menu={menu} active={active} />
          <Link to="/shop" className="cats-all">Browse all products</Link>
        </div>
      )}
    </div>
  );
}
