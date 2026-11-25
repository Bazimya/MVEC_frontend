import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import SponsoredProducts from "../components/SponsoredProducts";
import { loadCatalog, mapBackendProduct } from "../services/catalogApi";
import { advertisementsApi } from "../API/advertisements";
import Storefront from "../components/Storefront";
import HeroBanner from "../components/HeroBanner";
import Icon from "../components/Icon";
import ProductImage from "../components/ProductImage";
import ProductCard from "../components/ProductCard";
import { useAuth } from "../context/AuthContext";
import { ratingLabel } from "../utils/format";

const BEST_SELLERS = 8;
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

/** Shown while no paid ad is live: the marketplace pitch, and an invitation to advertise. */
function WelcomeHero({ advertiseLink, sellerHome }) {
  return (
    <section className="home-hero">
      <div className="home-hero-copy">
        <h1>Trusted sellers,<br /><em>everyday finds</em></h1>
        <p>Rwanda&apos;s marketplace. Pay with mobile money, and the seller is paid only once your order arrives.</p>
        <div className="home-hero-actions">
          <Link to="/shop" className="btn-dark">Shop the marketplace</Link>
          <Link to={sellerHome || "/signup"} state={sellerHome ? undefined : { role: "vendor" }} className="btn-line">
            {sellerHome ? "Go to dashboard" : "Start selling"}
          </Link>
        </div>
      </div>
      <div className="home-hero-media">
        <div className="home-hero-slide">
          <img src="/hero-standin.jpg" alt="Shopping bags" loading="eager" />
          <Link to={advertiseLink} className="home-hero-tag">
            <small>Your products here</small>
            <b>Advertise on Ikiguzi</b>
            <span>Get started <Icon name="arrow" size={14} /></span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
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

  // Paid placements: the hero and the featured row only ever show products
  // whose ad campaign an Ikiguzi admin approved and that is live now.
  const [heroAds, setHeroAds] = useState([]);
  const [featuredAds, setFeaturedAds] = useState([]);
  useEffect(() => {
    let mounted = true;
    const toProducts = (ads) => ads.map((ad) => mapBackendProduct(ad.product)).filter((p) => p && p.id);
    advertisementsApi.getLive("HOMEPAGE_HERO", 12).then((ads) => mounted && setHeroAds(ads)).catch(() => {});
    advertisementsApi.getLive("FEATURED", 12).then((ads) => mounted && setFeaturedAds(toProducts(ads))).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Each live ad becomes a slide with its own title and description; every slide
  // shows 5 seconds. The server decides which ads are live; the page only shows them.
  const slides = useMemo(() => heroAds.map((ad) => {
    const product = mapBackendProduct(ad.product);
    if (!product?.id) return null;
    return {
      key: ad.id || product.id,
      product,
      title: ad.title || product.name,
      description: ad.description || "",
    };
  }).filter(Boolean), [heroAds]);

  useEffect(() => {
    let mounted = true;
    loadCatalog().then((cat) => {
      if (!mounted) return;
      setCatalog(cat);
      setStatus(cat.error ? "error" : "ready");
    });
    return () => { mounted = false; };
  }, []);

  const { products, vendors } = catalog;
  const loading = status === "loading";
  // Popular = best rated with the most reviews; ties keep newest first.
  const popular = [...products].sort((a, b) => (b.rating * Math.log1p(b.reviews)) - (a.rating * Math.log1p(a.reviews))).slice(0, BEST_SELLERS);
  // The catalog comes newest first; new arrivals skip what Best sellers already shows.
  const newArrivals = products.filter((p) => !popular.includes(p)).slice(0, NEW_ARRIVALS);
  const deals = products.filter((p) => p.oldPrice > p.price && p.stock > 0);
  const dealImage = (deals[0] || products[0])?.image;
  const sellImage = (products[1] || products[0])?.image;
  // One page for everyone: it signs people in, explains who can advertise, or books the ad.
  const advertiseLink = "/advertise";
  const sellerHome = { vendor: "/vendor", supplier: "/supplier", affiliate: "/affiliate", super_admin: "/admin" }[user?.role];

  return (
    <Storefront>
      <main className={`home enter-${entrance.turn % 2}`}>
        <HeroBanner slides={slides} advertiseLink={advertiseLink} empty={<WelcomeHero advertiseLink={advertiseLink} sellerHome={sellerHome} />} />

        {status === "error" && (
          <div className="form-alert error" role="alert">
            We could not load the marketplace right now. Check your connection and try again.{" "}
            <button type="button" className="text-btn" onClick={() => load(true)}>Retry</button>
          </div>
        )}

        <section className="home-section">
          <SectionHead title="Best sellers" to="/shop" />
          {loading ? <SkeletonGrid count={8} /> : (
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

        {products.length > 0 && (
          <section className="home-promos">
            <Link to={deals.length ? "/shop?deal=true" : "/shop"} className="home-promo pink">
              <span>
                <h3>{deals.length ? "Deal days" : "New every day"}</h3>
                <p>{deals.length ? `${deals.length} product${deals.length === 1 ? " is" : "s are"} on sale right now.` : "Fresh products from sellers across Rwanda."}</p>
                <em className="btn-dark">{deals.length ? "Shop deals" : "Browse the shop"} <Icon name="arrow" size={15} /></em>
              </span>
              {dealImage && <ProductImage src={dealImage} alt="" />}
            </Link>
            <Link to={sellerHome || "/signup"} state={sellerHome ? undefined : { role: "vendor" }} className="home-promo brand">
              <span>
                <h3>{sellerHome ? "Your store" : "Sell on Ikiguzi"}</h3>
                <p>{sellerHome ? "Orders, payouts and advertising in one place." : "Open a store free and reach buyers across Rwanda."}</p>
                <em className="btn-dark">{sellerHome ? "Open dashboard" : "Start selling"} <Icon name="arrow" size={15} /></em>
              </span>
              {sellImage && <ProductImage src={sellImage} alt="" />}
            </Link>
          </section>
        )}

        {featuredAds.length > 0 && (
          <section className="home-section">
            <SectionHead title="Featured" />
            <div className="home-rail">
              {featuredAds.map((p) => <ProductCard key={p.id} p={p} label="Sponsored" />)}
            </div>
          </section>
        )}

        <SponsoredProducts surface="home" catalog={products} limit={4} title="Featured by sellers" />

        {newArrivals.length > 0 && (
          <section className="home-section">
            <SectionHead title="New arrivals" to="/shop" />
            <div className="product-grid">
              {newArrivals.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          </section>
        )}

        {vendors.length > 0 && (
          <section className="home-section">
            <SectionHead title="Trusted stores" to="/vendors" />
            <div className="home-stores">
              {vendors.slice(0, 4).map((v) => (
                <Link to={`/vendors/${v.id}`} className="home-store" key={v.id}>
                  {v.logoUrl
                    ? <ProductImage className="home-store-logo" src={v.logoUrl} alt="" />
                    : <span className="home-store-logo" aria-hidden="true">{(v.name || "S").charAt(0)}</span>}
                  <span>
                    <b>{v.name}</b>
                    <small>{v.category} · ★ {ratingLabel(v.rating)} · {v.products} product{v.products === 1 ? "" : "s"}</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </Storefront>
  );
}
