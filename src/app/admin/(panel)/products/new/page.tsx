import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductForm } from "@/components/admin/ProductForm";
import { FreshOnVisit } from "@/components/ui/FreshOnVisit";
import { requireAdmin } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "New product" };

export default function NewProductPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <Link href="/admin/products" className="admin-label underline underline-offset-4 hover:text-fg">
          ← Products
        </Link>
        <h1 className="t-display mt-3 text-3xl">New product</h1>
      </div>
      <Suspense fallback={<div className="skeleton h-96" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  await requireAdmin();
  return (
    <FreshOnVisit>
      <ProductForm />
    </FreshOnVisit>
  );
}
