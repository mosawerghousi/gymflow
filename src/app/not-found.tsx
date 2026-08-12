import { redirect } from "next/navigation";

import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * A path that matched no locale segment at all. Send it to the default locale,
 * where the localized not-found page can explain itself.
 */
export default function RootNotFound() {
  redirect(`/${DEFAULT_LOCALE}/not-found`);
}
