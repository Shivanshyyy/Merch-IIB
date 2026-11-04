import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductPhotos } from "@/components/admin/ProductPhotos";
import { ProductTermsForm } from "@/components/admin/ProductTermsForm";
import { FreshOnVisit } from "@/components/ui/FreshOnVisit";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Edit product" };

type Props = { params: Promise<{ id: string }> };

export default function EditProductPage({ params }: Props) {
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/admin/products" className="admin-label underline underline-offset-4 hover:text-fg">
        ← Products
      </Link>
      <Suspense fallback={<div className="skeleton h-96" aria-hidden />}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const d = db();
  const product = await d.getProductById(id).catch(() => null);
  if (!product) notFound();
  const [terms, designers] = await Promise.all([d.getProductTerms(product.id), d.listDesigners()]);
  // Approved designers, plus whoever the product is already attached to (even if paused since).
  const options = designers.filter((x) => x.status === "approved" || x.id === terms?.designer_id);
  return (
    <>
      <h1 className="t-display text-3xl">{product.name}</h1>
      <FreshOnVisit>
        <ProductForm key={product.id} product={product} />
        <div className="mt-10">
          <ProductPhotos productId={product.id} photos={product.photos} />
        </div>
        <div className="mt-10">
          <ProductTermsForm priceInr={product.price_inr} productId={product.id} terms={terms} designers={options.map((x) => ({ id: x.id, name: x.full_name, rate: x.commission_pct }))} />
        </div>
      </FreshOnVisit>
    </>
  );
}
