import { NextRequest, NextResponse } from "next/server";

// Cookie-based gate. Active only when DASH_PASSWORD is set (Vercel env).
export function middleware(req: NextRequest) {
  const pass = process.env.DASH_PASSWORD;
  if (!pass) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  if (req.cookies.get("compa_auth")?.value === pass) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
