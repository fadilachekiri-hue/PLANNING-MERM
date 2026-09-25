import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PUBLIC_PREFIXES = [
  "/connexion",
  "/activer",
  "/mot-de-passe-oublie",
  "/reinitialiser",
  "/premiere-configuration",
  "/creer-admin",
  "/supprimer-doublon",
  "/importer-planning",
  "/mot-de-passe-oublie-secours",
  "/resynchroniser-identifiants",
  "/parametrer-equipe",
  "/assigner-postes",
  "/retirer-admins-planning",
  "/preparer-semaines-2027",
  "/corriger-semaines-decalees",
  "/ajouter-poste-gq",
  "/api/auth",
  "/api/setup",
  "/manifest.json",
  "/sw.js",
  "/icons",
  "/_next",
  "/favicon.ico",
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.searchParams.set("suite", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/connexion") {
    const url = request.nextUrl.clone();
    url.pathname = "/tableau-de-bord";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
