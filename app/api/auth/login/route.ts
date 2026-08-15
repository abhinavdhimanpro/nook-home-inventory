import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "../../../../lib/auth";

export const runtime = "nodejs";

function secureEqual(value: string, expected: string) {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const username = process.env.NOOK_USERNAME;
  const password = process.env.NOOK_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  const form = await request.formData();
  const submittedUsername = String(form.get("username") ?? "");
  const submittedPassword = String(form.get("password") ?? "");
  const requestedReturnTo = String(form.get("returnTo") ?? "/");
  const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "/";

  if (!username || !password || !secret) {
    return NextResponse.redirect(new URL("/login?error=config", request.url), 303);
  }
  if (!secureEqual(submittedUsername, username) || !secureEqual(submittedPassword, password)) {
    return NextResponse.redirect(new URL(`/login?error=credentials&returnTo=${encodeURIComponent(returnTo)}`, request.url), 303);
  }

  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.cookies.set(SESSION_COOKIE, await createSessionToken(username, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
