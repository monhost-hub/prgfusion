import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - API routes
  // - Next.js internals (_next, _vercel)
  // - Static files (with a file extension)
  // - OpenRouter admin preview image paths
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
