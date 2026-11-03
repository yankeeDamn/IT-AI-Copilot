import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((request) => {
  if (!request.auth) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = { matcher: ["/dashboard/:path*"] };
