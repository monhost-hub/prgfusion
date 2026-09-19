"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Client wrapper around next-auth's SessionProvider.
 *
 * next-auth v4's SessionProvider uses React Context in a way that doesn't
 * play well with React 19 Server Components when imported directly from a
 * server layout. Wrapping it in a "use client" file isolates the context
 * boundary and avoids the "React Context is unavailable in Server
 * Components" error.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
