import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";

const issuer = process.env.OIDC_ISSUER;
const clientId = process.env.OIDC_CLIENT_ID;
const clientSecret = process.env.OIDC_CLIENT_SECRET;

const config: NextAuthConfig = {
  providers: issuer && clientId && clientSecret ? [{
    id: "corporate-oidc",
    name: "Organization SSO",
    type: "oidc",
    issuer,
    clientId,
    clientSecret,
    authorization: {
      params: { scope: process.env.OIDC_SCOPES || "openid profile email" },
    },
    checks: ["pkce", "state"],
  }] : [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        // Only keep the API token in the encrypted server-managed session cookie.
        token.apiAccessToken = account.access_token;
        token.apiAccessTokenExpiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 5 * 60 * 1000;
      }
      return token;
    },
    async session({ session }) {
      // NEVER expose access tokens through /api/auth/session or client components.
      return { ...session, user: session.user };
    },
  },
  pages: { signIn: "/login" },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
