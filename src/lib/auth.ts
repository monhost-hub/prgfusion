import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

/**
 * NextAuth configuration for AllCombiner.
 *
 * - Uses the credentials provider (email + password).
 * - Passwords are stored hashed with bcrypt in the User table.
 * - JWT-based sessions (no server session storage required).
 * - The `role` ("USER" | "ADMIN") is attached to the token and surfaced on
 *   the session object so server code can call `requireAdmin()` to protect
 *   admin routes and APIs.
 *
 * SESSION INVALIDATION (Commit 4):
 *   - `sessionVersion` is stored in the JWT at login time.
 *   - On every session() callback, the DB user's `sessionVersion` is compared
 *     against the JWT's `sessionVersion`.
 *   - If they differ (e.g. after a password reset), the session is invalidated
 *     by clearing the user data from the session object.
 *   - This means `requireAuth()` will see no user → throw 401, forcing re-login.
 */
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();
        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          sessionVersion: user.sessionVersion,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial login — store sessionVersion from DB
        token.id = (user as any).id;
        token.role = (user as any).role ?? "USER";
        token.sessionVersion = (user as any).sessionVersion ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        // On every session access, verify that sessionVersion still matches DB.
        // If the user reset their password, sessionVersion was incremented in DB
        // → mismatch → we strip the user from the session → requireAuth() will
        // throw 401, forcing a re-login with the new password.
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token.id as string },
            select: { sessionVersion: true, role: true },
          });

          if (!dbUser) {
            // User deleted — invalidate session
            session.user = undefined as any;
            return session;
          }

          const tokenVersion = token.sessionVersion ?? 0;
          if (dbUser.sessionVersion !== tokenVersion) {
            // sessionVersion mismatch — password was reset, old JWT is stale
            session.user = undefined as any;
            return session;
          }

          // Session is valid — populate user data
          (session.user as any).id = token.id;
          (session.user as any).role = dbUser.role ?? token.role ?? "USER";
        } catch {
          // DB error — fail safe by not populating user data
          session.user = undefined as any;
        }
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
};

// Re-export the type for `role` and `sessionVersion`
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: "USER" | "ADMIN";
    };
  }
  interface User {
    role?: "USER" | "ADMIN";
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "USER" | "ADMIN";
    sessionVersion?: number;
  }
}
