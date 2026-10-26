import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductConfigurator } from "@/components/shop/ProductConfigurator";
import { getOpenBatch, getProduct, getProducts } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  return product ? { title: product.name, description: product.description } : {};
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
  const [product, batch] = await Promise.all([getProduct(slug), getOpenBatch()]);
  if (!product) notFound();

  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductConfigurator product={product} batch={batch ? { name: batch.name, closesAt: batch.closes_at, estDelivery: batch.est_delivery } : null} />
    </Suspense>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]" aria-hidden>
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
