/**
 * The statement page: Operations as a dated record, narrowed by the same
 * filters (?day=&kind=&status=). The wallet is read once by the layout;
 * statement.ts words it and works out the totals.
 */

import { readFilter, statement } from "#lib/server/statement.ts";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, url }) => ({
  statement: statement(await parent(), readFilter(url.searchParams), new Date()),
});
