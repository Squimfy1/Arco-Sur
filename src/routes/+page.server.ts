/** Home: the ecosystem news, from the backend. */

import { news } from "#lib/server/news.ts";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => ({ news: news() });
