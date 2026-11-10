import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { prisma } from "@/lib/db";

// Provider-managed MFA is required by tenant policy.
// Credential/password login is intentionally NOT enabled until recovery/MFA flows are hardened.
// Auth.js persists users, accounts and sessions to Prisma "itsm" schema.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [MicrosoftEntraID, Google],
  session: { strategy: "database", maxAge: 60 * 60 * 8, updateAge: 60 * 30 },
  pages: { signIn: "/sign-in" },
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    }
  }
});
