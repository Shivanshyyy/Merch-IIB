import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductForm } from "@/components/admin/ProductForm";
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
  const product = await db().getProductById(id).catch(() => null);
  if (!product) notFound();
  return (
    <>
      <h1 className="t-display text-3xl">{product.name}</h1>
      <FreshOnVisit>
        <ProductForm key={product.id} product={product} />
      </FreshOnVisit>
    </>
  );
}
