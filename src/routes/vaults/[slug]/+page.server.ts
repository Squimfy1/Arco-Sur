/** One vault's page: read live from Morpho or Aave (src/lib/server/vault-detail.ts). */

import { error } from "@sveltejs/kit";

import { vaultDetail } from "#lib/server/vault-detail.ts";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const detail = vaultDetail(params.slug);
  if (detail === null) error(404, "No such vault");
  return { detail: await detail };
};
