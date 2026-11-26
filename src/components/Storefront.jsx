import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Fragment, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import { useMarketplace } from '../context/MarketplaceContext';
import { loadCatalog } from '../services/catalogApi';
import { useLanguage } from '../context/LanguageContext';
import { notificationsApi } from '../API/notifications';
import ProductImage from './ProductImage';
import { money } from '../utils/format';
import TestModeBanner from './TestModeBanner';
import { CategoriesAccordion, CategoriesDropdown, useNavCategories } from './CategoriesMenu';

const DASHBOARD_BY_ROLE = { vendor: '/vendor', supplier: '/supplier', affiliate: '/affiliate', delivery: '/delivery', super_admin: '/admin' };
const NOTIFICATIONS_BY_ROLE = { vendor: '/vendor/notifications', supplier: '/supplier/notifications', affiliate: '/affiliate/notifications', delivery: '/delivery/notifications', super_admin: '/admin/notifications' };

/** The shop pages' frame: one header row, the page, a short footer. */
export default function Storefront({ children }) {
  const { user, logout } = useAuth();
  const { cartCount, wishlistCount, cartNotice, dismissCartNotice } = useMarketplace();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false); // the phone search row
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [catalog, setCatalog] = useState({ categories: [], products: [], vendors: [] });
  const [unread, setUnread] = useState(0);
  const searchRef = useRef(null);
  const categoryMenu = useNavCategories();

  useEffect(() => {
    let mounted = true;
    loadCatalog().then((cat) => mounted && setCatalog({
      categories: (cat.categories || []).map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean),
      products: cat.products || [],
      vendors: cat.vendors || [],
    }));
    return () => { mounted = false; };
  }, []);

  // Unread notifications badge (only meaningful when signed in).
  useEffect(() => {
    if (!user) { setUnread(0); return undefined; }
    let alive = true;
    const load = () => notificationsApi.getAll({ limit: 1 }).then((d) => alive && setUnread(d.unreadCount || 0)).catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => { alive = false; clearInterval(timer); };
  }, [user]);

  // Suggestions close on an outside click; everything closes on Escape.
  useEffect(() => {
    const onClick = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSuggestOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setSuggestOpen(false); setMenuOpen(false); setSearchOpen(false); } };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => { setSuggestOpen(false); setMenuOpen(false); setSearchOpen(false); }, [location.pathname, location.search]);

  const query = search.trim().toLowerCase();
  const suggestions = query ? catalog.products.filter((p) => `${p.name} ${p.brand || ''} ${p.vendor || ''} ${p.category || ''}`.toLowerCase().includes(query)).slice(0, 5) : [];
  const storeSuggestions = query ? catalog.vendors.filter((v) => `${v.name} ${v.category}`.toLowerCase().includes(query)).slice(0, 3) : [];
  const submitSearch = () => {
    if (!search.trim()) return;
    setSuggestOpen(false);
    navigate(`/shop?q=${encodeURIComponent(search.trim())}`);
  };
  const dashboard = DASHBOARD_BY_ROLE[user?.role];
  const notificationPath = NOTIFICATIONS_BY_ROLE[user?.role] || '/buyer/notifications';
  const accountPath = dashboard || '/profile';
  const links = [['/', t('home')], ['/shop', t('shop')], ['/deals', t('deals')], ['/vendors', t('vendors')], ['/buyer/recommendations', t('forYou')]];
  const activeCategory = location.pathname === '/shop' ? new URLSearchParams(location.search).get('category') || '' : '';
  const isActive = (to) => (to.includes('?') ? `${location.pathname}${location.search}` === to : location.pathname === to && !location.search.includes('deal='));

  return <div className="site">
    <TestModeBanner />
    <header className="site-header">
      <div className="site-bar">
        <button type="button" className="site-icon site-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-label="Menu">
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
        <Link to="/" className="site-logo">Ikiguzi</Link>
        <nav className="site-nav" aria-label="Main">
          {links.map(([to, label]) => <Fragment key={to}>
            <Link to={to} className={isActive(to) ? 'active' : undefined} aria-current={isActive(to) ? 'page' : undefined}>{label}</Link>
            {to === '/shop' && <CategoriesDropdown active={activeCategory} menu={categoryMenu} closeSignal={`${location.pathname}${location.search}`} />}
          </Fragment>)}
        </nav>
        <div className={'site-search' + (searchOpen ? ' open' : '')} ref={searchRef}>
          <form role="search" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
            <Icon name="search" size={17} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSuggestOpen(true); }}
              onFocus={() => setSuggestOpen(true)}
              placeholder="Search products and stores"
              aria-label={t('search')}
              maxLength={100}
            />
          </form>
          {suggestOpen && query && <div className="site-suggest">
            {suggestions.map((p) => <Link key={`p-${p.id}`} to={`/product/${p.id}`} onClick={() => setSearch('')}><ProductImage src={p.image} alt="" /><span><b>{p.name}</b><small>{p.category} · {money(p.price)}</small></span></Link>)}
            {storeSuggestions.map((v) => <Link key={`v-${v.id}`} to={`/vendors/${v.id}`} onClick={() => setSearch('')}><span className="site-suggest-avatar">{(v.name || 'S')[0]}</span><span><b>{v.name}</b><small>Store · {v.category}</small></span></Link>)}
            {!suggestions.length && !storeSuggestions.length && <p>No matching products or stores</p>}
            <button type="button" onClick={submitSearch}>See all results</button>
          </div>}
        </div>
        <div className="site-actions">
          <button type="button" className="site-icon site-search-btn" onClick={() => setSearchOpen((v) => !v)} aria-expanded={searchOpen} aria-label={t('search')}><Icon name="search" /></button>
          <ThemeToggle />
          <Link className="site-icon site-hide-sm" to="/wishlist" aria-label={`Wishlist, ${wishlistCount} items`}><Icon name="heart" />{wishlistCount > 0 && <em>{wishlistCount}</em>}</Link>
          {user && <Link className="site-icon site-hide-sm" to={notificationPath} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}><Icon name="bell" />{unread > 0 && <em>{unread > 9 ? '9+' : unread}</em>}</Link>}
          {user
            ? <Link className="site-icon site-hide-sm" to={accountPath} aria-label="My account"><Icon name="user" /></Link>
            : <Link className="site-signin" to="/login" state={{ from: `${location.pathname}${location.search}` }}>{t('signIn')}</Link>}
          <Link className="site-icon" to="/cart" aria-label={`Cart, ${cartCount} items`}><Icon name="cart" />{cartCount > 0 && <em>{cartCount}</em>}</Link>
        </div>
      </div>
      {menuOpen && <div className="site-drawer">
        <nav aria-label="Menu">
          {links.map(([to, label]) => <Fragment key={to}>
            <Link to={to}>{label}</Link>
            {to === '/shop' && <CategoriesAccordion active={activeCategory} menu={categoryMenu} />}
          </Fragment>)}
          <Link to="/orders">{t('orders')}</Link>
          {user && <Link to="/account/returns">Returns</Link>}
          {user && <Link to={accountPath}>{dashboard ? 'Dashboard' : 'My account'}</Link>}
          {user && <button type="button" onClick={() => { logout(); navigate('/'); }}>Sign out</button>}
        </nav>
      </div>}
    </header>
    {cartNotice && <div className="form-alert error site-notice" role="alert">{cartNotice} <button type="button" className="text-btn" onClick={dismissCartNotice}>Dismiss</button></div>}
    <div className="site-page">{children}</div>
    <footer className="site-footer">
      <div className="site-footer-main">
        <div className="site-footer-grid">
          <section className="site-footer-about" id="site-about" aria-labelledby="footer-about">
            <Link to="/" className="site-logo">Ikiguzi</Link>
            <h3 id="footer-about">Rwanda&apos;s marketplace</h3>
            <p>Discover trusted local products and sellers.</p>
          </section>
          <nav aria-label="Shop">
            <h3>Shop</h3>
            <Link to="/shop">All products</Link>
            <Link to="/deals">Deals</Link>
            <Link to="/vendors">Stores</Link>
          </nav>
          <nav aria-label="Help and orders">
            <h3>Help</h3>
            <Link to="/buyer/support">Customer support</Link>
            <Link to="/orders">Track an order</Link>
            <Link to="/account/returns">Returns</Link>
          </nav>
        </div>
        <div className="site-footer-bottom">
          <small>© {new Date().getFullYear()} Ikiguzi. All rights reserved.</small>
          <small className="site-footer-pay">MTN Mobile Money and Airtel Money</small>
          {user && <button type="button" className="link-btn" onClick={() => { logout(); navigate('/'); }}>Sign out</button>}
        </div>
      </div>
    </footer>
  </div>;
}
