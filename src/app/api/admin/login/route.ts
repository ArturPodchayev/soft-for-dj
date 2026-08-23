import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS, createSessionToken } from "@/lib/adminSession";

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("ADMIN_PASSWORD is not configured");
    return NextResponse.json({ message: "Доступ администратора не настроен" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Некорректный запрос" }, { status: 400 });
  }

  const { password } = (body ?? {}) as { password?: string };

  if (password !== adminPassword) {
    return NextResponse.json({ message: "Неверный пароль" }, { status: 401 });
  }

  const token = await createSessionToken();

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
