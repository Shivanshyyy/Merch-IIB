import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductConfigurator } from "@/components/shop/ProductConfigurator";
import { getOpenBatch, getProduct, getProducts } from "@/lib/catalog";
import { ogImageFor } from "@/lib/og";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site-url";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  const image = { url: ogImageFor(product.slug), width: 1200, height: 630, alt: product.name };
  return {
    title: product.name,
    description: product.description,
    openGraph: { title: product.name, description: product.description, images: [image] },
    twitter: { card: "summary_large_image", title: product.name, description: product.description, images: [image.url] },
  };
}

export default function ProductPage({ params }: Props) {
  return (
    <div className="pt-[var(--nav-h)]">
      <Suspense fallback={<ProductSkeleton />}>
        <Product params={params} />
      </Suspense>
    </div>
  );
}

async function Product({ params }: Props) {
  const { slug } = await params;
  const [product, batch, settings] = await Promise.all([getProduct(slug), getOpenBatch(), getSettings()]);
  if (!product) notFound();

  // Search engines and share cards: what this is, what it costs, and that it is a preorder.
  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: `${base}${ogImageFor(product.slug)}`,
    brand: { "@type": "Brand", name: settings.brand },
    offers: {
      "@type": "Offer",
      url: `${base}/shop/${product.slug}`,
      price: product.price_inr,
      priceCurrency: "INR",
      availability: batch ? "https://schema.org/PreOrder" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <Suspense fallback={<ProductSkeleton />}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ProductConfigurator product={product} batch={batch ? { name: batch.name, closesAt: batch.closes_at, estDelivery: batch.est_delivery } : null} />
    </Suspense>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid min-h-[calc(100svh-var(--nav-h)+2rem)] content-start gap-10 lg:grid-cols-[1.15fr_1fr]" aria-hidden>
      <div className="skeleton aspect-square" />
      <div className="shell grid content-start gap-6 py-10">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-14 w-3/4" />
        <div className="skeleton h-10 w-32" />
        <div className="skeleton h-40 w-full" />
      </div>
    </div>
  );
}
