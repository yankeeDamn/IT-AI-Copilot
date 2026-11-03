import { getToken } from "next-auth/jwt";
import { forwardRequest } from "@/lib/api-bridge";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: NextRequest, context: { params: Promise<{ segments: string[] }> }) {
  // Do not use the public Auth.js session endpoint for provider access tokens.
  const session = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  const { segments } = await context.params;
  return forwardRequest({
    request,
    segments,
    accessToken: typeof session?.apiAccessToken === "string" ? session.apiAccessToken : null,
    expiresAt: typeof session?.apiAccessTokenExpiresAt === "number" ? session.apiAccessTokenExpiresAt : null,
    baseUrl: process.env.COPILOT_API_BASE_URL,
  });
}

export { handler as GET, handler as POST, handler as PATCH };
