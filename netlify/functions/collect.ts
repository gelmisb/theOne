import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { handleCollect } from '../../src/lib/analytics/server';

// Receives the batches src/scripts/analytics.ts sends - and only ever after the
// visitor accepted analytics in the cookie banner. All the logic (validation,
// bot filtering, what gets stored) is in src/lib/analytics/server.ts; this just
// supplies the real blob store and the host's country lookup. No IP address is
// read here or stored anywhere.
export default async (req: Request, context: Context) =>
  handleCollect(req, context.geo?.country?.code, { store: getStore('analytics') });

export const config: Config = { path: '/api/collect' };
