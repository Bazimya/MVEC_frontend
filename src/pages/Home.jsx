import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import { loadCatalog, mapBackendProduct } from "../services/catalogApi";
import { advertisementsApi } from "../API/advertisements";
import Storefront from "../components/Storefront";
import HeroBanner from "../components/HeroBanner";
import Icon from "../components/Icon";
import ProductCard from "../components/ProductCard";

const BEST_SELLERS = 4;
const NEW_ARRIVALS = 4;

function SkeletonGrid({ count = 4 }) {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <div className="product-card skeleton-card" key={i} />)}
    </div>
  );
}

function SectionHead({ title, to, label = "View all" }) {
  return (
    <div className="home-head">
      <h2>{title}</h2>
      {to && <Link to={to}>{label} <Icon name="arrow" size={15} /></Link>}
    </div>
  );
}

export default function Home() {
  const location = useLocation();

  // Every visit to "/" (arriving from another page, or pressing the Ikiguzi logo while already
  // here, scrolled or not) gets a new router key. Each new key flips between two identical
  // animations, which restarts the entrance with no reload and no scroll observer.
  const [entrance, setEntrance] = useState({ key: location.key, turn: 0 });
  if (entrance.key !== location.key) setEntrance({ key: location.key, turn: entrance.turn + 1 });
  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" }); // so the whole entrance is in view
  }, [location.key]);

  const [catalog, setCatalog] = useState({ products: [], categories: [], vendors: [] });
  const [status, setStatus] = useState("loading"); // loading | ready | error

  const load = useCallback((force = false) => {
    setStatus("loading");
    return loadCatalog(force).then((cat) => {
      setCatalog(cat);
      setStatus(cat.error ? "error" : "ready");
    });
  }, []);

  // Live product placements lead the carousel; the rest of the catalog fills it.
  const [heroAds, setHeroAds] = useState([]);
  const [featuredAds, setFeaturedAds] = useState([]);
  useEffect(() => {
    let mounted = true;
    advertisementsApi.getLive("HOMEPAGE_HERO", 12).then((ads) => mounted && setHeroAds(ads)).catch(() => {});
    advertisementsApi.getLive("FEATURED", 12).then((ads) => mounted && setFeaturedAds(ads)).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Sponsored products retain their booking IDs for view/click tracking.
  const slides = useMemo(() => {
    const unique = new Map();
    [...heroAds, ...featuredAds].forEach((ad) => {
      if (unique.size >= 12) return;
      const product = mapBackendProduct(ad.product);
      if (!product?.id || unique.has(String(product.id))) return;
      unique.set(String(product.id), {
        key: ad.id || String(product.id),
        product,
        description: ad.description || product.shortDescription || product.description || product.category,
      });
    });
    catalog.products.forEach((product) => {
      if (unique.size >= 12 || unique.has(String(product.id))) return;
      unique.set(String(product.id), {
        key: `product-${product.id}`,
        product,
        description: product.shortDescription || product.description || product.category,
      });
    });
    return [...unique.values()];
  }, [heroAds, featuredAds, catalog.products]);

  useEffect(() => {
    let mounted = true;
    loadCatalog().then((cat) => {
      if (!mounted) return;
      setCatalog(cat);
      setStatus(cat.error ? "error" : "ready");
    });
    return () => { mounted = false; };
  }, []);

  const { products } = catalog;
  const loading = status === "loading";
  // Popular = best rated with the most reviews; ties keep newest first.
  const popular = [...products].sort((a, b) => (b.rating * Math.log1p(b.reviews)) - (a.rating * Math.log1p(a.reviews))).slice(0, BEST_SELLERS);
  // The catalog comes newest first; new arrivals skip what Best sellers already shows.
  const newArrivals = products.filter((p) => !popular.includes(p)).slice(0, NEW_ARRIVALS);
  return (
    <Storefront>
      <main className={`home enter-${entrance.turn % 2}`}>
        <HeroBanner
          slides={slides}
          empty={loading
            ? <div className="hb-skeleton" aria-hidden="true">{Array.from({ length: 3 }, (_, i) => <span key={i} />)}</div>
            : <div className="hb-empty"><h1>Find something you&apos;ll love</h1><Link to="/shop">Browse products</Link></div>}
        />

        {status === "error" && (
          <div className="form-alert error" role="alert">
            We could not load the marketplace right now. Check your connection and try again.{" "}
            <button type="button" className="text-btn" onClick={() => load(true)}>Retry</button>
          </div>
        )}

        <section className="home-section">
          <SectionHead title="Best sellers" to="/shop" />
          {loading ? <SkeletonGrid count={BEST_SELLERS} /> : (
            <>
              <div className="product-grid">
                {popular.map((p) => <ProductCard key={p.id} p={p} />)}
              </div>
              {products.length === 0 && status === "ready" && (
                <div className="empty-state"><h3>No products yet</h3><p>Sellers are setting up their stores. Check back soon.</p></div>
              )}
            </>
          )}
        </section>

        {newArrivals.length > 0 && (
          <section className="home-section">
            <SectionHead title="New arrivals" to="/shop" />
            <div className="product-grid">
              {newArrivals.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          </section>
        )}
      </main>
    </Storefront>
  );
}
