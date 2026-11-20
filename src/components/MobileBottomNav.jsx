import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { navForRole, mobilePrimaryByRole } from '../data/navItems';

// Public (storefront) bottom nav, exactly 5 items, no "More" needed.
const PUBLIC_ITEMS = [
  ['/', 'Home', 'home'],
  ['/shop', 'Shop', 'grid'],
  ['/cart', 'Cart', 'cart'],
  ['/wishlist', 'Wishlist', 'heart'],
];

const DASH_PREFIXES = ['/admin', '/vendor', '/supplier', '/affiliate', '/delivery'];
// Account settings per role (same as PORTAL_PROFILE in pages/Profile.jsx).
const ACCOUNT_PATH = { vendor: '/vendor/profile', super_admin: '/admin/profile', supplier: '/supplier/profile', affiliate: '/affiliate/profile', delivery: '/delivery/profile' };
// A signed-in shopper's "Account" sheet.
const BUYER_ACCOUNT = [
  ['/profile', 'My account', 'user'],
  ['/orders', 'Orders', 'box'],
  ['/account/returns', 'Returns', 'receipt'],
  ['/buyer/notifications', 'Notifications', 'bell'],
];
const MOBILE_BREAKPOINT = '(max-width: 900px)';

/**
 * True mobile-viewport gate. The bottom nav (and its "More" sheet, which
 * contains a link for every remaining nav item) must NEVER exist in the DOM
 * on a desktop-width viewport, relying on CSS alone to hide it is fragile
 * (stale bundles, specificity edge cases, browser quirks), so this hook
 * decides whether to render anything at all, in JavaScript, before the
 * component ever touches the DOM.
 */
function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mql = window.matchMedia(MOBILE_BREAKPOINT);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange); // Safari <14 fallback
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  return isMobile;
}

export default function MobileBottomNav() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Close the "More" sheet on every navigation.
  useEffect(() => { setSheetOpen(false); }, [loc.pathname]);

  // Hard gate: on a desktop-width viewport this component renders nothing at
  // all, not even hidden-via-CSS markup, so a wide viewport can never show
  // the "More" sheet's full link list inline at the bottom of the page.
  if (!isMobile) return null;

  const inDashboard = DASH_PREFIXES.some((p) => loc.pathname === p || loc.pathname.startsWith(p + '/'));
  const role = user?.role;

  let primary; // items shown directly as icons
  let overflow; // items tucked away behind "More"
  let brandLabel;

  if (inDashboard && role) {
    const all = navForRole(role);
    const primaryHrefs = mobilePrimaryByRole[role] || all.slice(0, 4).map((i) => i[0]);
    primary = primaryHrefs
      .map((href) => all.find((i) => i[0] === href))
      .filter(Boolean);
    overflow = all.filter((i) => !primaryHrefs.includes(i[0]));
    brandLabel = 'More tools';
  } else if (user) {
    // Signed in: the fifth tab opens the account sheet (with sign out).
    primary = PUBLIC_ITEMS;
    overflow = ACCOUNT_PATH[role] ? [[ACCOUNT_PATH[role].replace(/\/profile$/, '') || '/', 'Dashboard', 'grid'], ...BUYER_ACCOUNT.slice(1, 2)] : BUYER_ACCOUNT;
    brandLabel = 'Account';
  } else {
    primary = [...PUBLIC_ITEMS, ['/login', 'Sign in', 'user']];
    overflow = [];
    brandLabel = 'More';
  }

  // Every signed-in person can reach their account and sign out from the sheet.
  const hasMore = overflow.length > 0 || Boolean(user);
  const accountHref = ACCOUNT_PATH[role] || '/profile';
  const signOut = () => { setSheetOpen(false); logout(); navigate('/'); };
  const isActive = (href) => loc.pathname === href;

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Primary">
        {primary.slice(0, hasMore ? 4 : 5).map(([href, label, icon]) => (
          <Link
            key={href}
            to={href}
            className={'mbn-item' + (isActive(href) ? ' active' : '')}
          >
            <Icon name={icon} size={21} />
            <span>{label}</span>
          </Link>
        ))}
        {hasMore && (
          <button
            type="button"
            className={'mbn-item mbn-more' + (sheetOpen ? ' active' : '')}
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
          >
            <Icon name={inDashboard ? (sheetOpen ? 'plus' : 'grid') : 'user'} size={21} />
            <span>{inDashboard ? 'More' : 'Account'}</span>
          </button>
        )}
      </nav>

      {hasMore && (
        <>
          <div
            className={'mbn-backdrop' + (sheetOpen ? ' open' : '')}
            onClick={() => setSheetOpen(false)}
          />
          <div className={'mbn-sheet' + (sheetOpen ? ' open' : '')} role="dialog" aria-label={brandLabel}>
            <div className="mbn-sheet-handle" />
            {user && (
              <div className="mbn-account">
                <Link to={accountHref} className="mbn-account-who" onClick={() => setSheetOpen(false)}>
                  <span className="mbn-account-avatar">{(user.fullName || user.name || user.email || '?')[0]?.toUpperCase()}</span>
                  <span>
                    <b>{user.fullName || user.name || 'My account'}</b>
                    <small>Account settings</small>
                  </span>
                </Link>
                <button type="button" className="mbn-signout" onClick={signOut}>
                  <Icon name="logout" size={18} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
            <div className="mbn-sheet-head">{brandLabel}</div>
            <div className="mbn-sheet-grid">
              {overflow.map(([href, label, icon]) => (
                <Link
                  key={href}
                  to={href}
                  className={'mbn-sheet-item' + (isActive(href) ? ' active' : '')}
                  onClick={() => setSheetOpen(false)}
                >
                  <span className="mbn-sheet-icon"><Icon name={icon} size={20} /></span>
                  <small>{label}</small>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
