import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (password && password === process.env.DASH_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("compa_auth", password, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
