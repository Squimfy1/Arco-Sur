/** Vaults: the largest vaults on Arc mainnet, from the backend. */

import { vaults } from "#lib/server/vaults.ts";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => ({ vaults: vaults() });
