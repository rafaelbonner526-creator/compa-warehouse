import { NextRequest, NextResponse } from "next/server";

// Simple HTTP basic-auth gate. Active only when DASH_PASSWORD is set (Vercel env).
export function middleware(req: NextRequest) {
  const pass = process.env.DASH_PASSWORD;
  if (!pass) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.split(" ")[1] ?? "");
    const pwd = decoded.split(":")[1] ?? "";
    if (pwd === pass) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="compa-warehouse"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
