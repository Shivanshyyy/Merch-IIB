import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/token";
import { DEMO_COOKIE } from "@/lib/auth/cookies";
import { authMode } from "@/lib/auth/mode";
import { loginPath } from "@/lib/auth/next";

const NEEDS_LOGIN = /^\/(orders|account|order\/[^/]+\/pay)\/?$/;

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Admin panel: everything except the login page needs a valid signed cookie.
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "private, no-store");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  // Pages that need an account. A visitor with no session cookie at all gets a real redirect before anything renders; sending
  // them from inside the page instead would paint a skeleton first and then swap the whole page (a flash and a layout shift).
  if (NEEDS_LOGIN.test(pathname)) {
    const mode = authMode();
    const signedIn = mode === "demo" ? req.cookies.has(DEMO_COOKIE) : mode === "supabase" ? req.cookies.getAll().some((c) => c.name.startsWith("sb-")) : true;
    if (!signedIn) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = loginPath(pathname + search).slice("/login".length);
      return NextResponse.redirect(url);
    }
  }

  // Customers: refresh an expiring Supabase session. Server Components can't write cookies, so it has to happen here.
  // Skipped entirely (no network call) unless the request already carries Supabase auth cookies.
  if (authMode() === "supabase" && req.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    try {
      let res = NextResponse.next({ request: req });
      const supabase = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        cookieOptions: { sameSite: "lax", httpOnly: true },
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (list, headers) => {
            for (const { name, value } of list) req.cookies.set(name, value);
            res = NextResponse.next({ request: req });
            for (const { name, value, options } of list) res.cookies.set(name, value, options);
            for (const [k, v] of Object.entries(headers ?? {})) res.headers.set(k, v);
          },
        },
      });
      await supabase.auth.getClaims();
      return res;
    } catch (e) {
      console.error("[proxy] session refresh failed:", e);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Everything except static assets.
  matcher: ["/((?!_next/static|_next/image|icon.svg|models/|products/|photos/|.*\\.(?:png|jpg|jpeg|webp|svg|glb|ico|css|js|map)$).*)"],
};
