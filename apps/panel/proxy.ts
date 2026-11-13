import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 "proxy" (eski adıyla middleware): Supabase oturumunu yeniler,
 * oturumu olmayanı giriş sayfasına yönlendirir. Yetki kontrolü her panel
 * sayfasında ayrıca (veritabanındaki RBAC matrisiyle) yapılır.
 */
export async function proxy(istek: NextRequest): Promise<NextResponse> {
  let yanit = NextResponse.next({ request: istek });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => istek.cookies.getAll(),
        setAll: (liste) => {
          for (const { name, value } of liste) istek.cookies.set(name, value);
          yanit = NextResponse.next({ request: istek });
          for (const { name, value, options } of liste) yanit.cookies.set(name, value, options);
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const acik = istek.nextUrl.pathname.startsWith("/giris");
  if (!user && !acik) {
    const url = istek.nextUrl.clone();
    url.pathname = "/giris";
    return NextResponse.redirect(url);
  }
  return yanit;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
