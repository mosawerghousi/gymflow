import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";

/**
 * Resolves the locale from the URL, then the cookie, then `Accept-Language`.
 *
 * API routes, static assets and the Next internals are excluded — only page
 * routes carry a locale segment.
 */
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|brand|.*\\..*).*)"],
};
