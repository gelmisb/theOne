import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { handleHit } from '../../src/lib/analytics/server';

// The always-on visit counter (src/scripts/hitCounter.ts): counts a page view for
// every visitor, whatever their cookie choice, with no cookie, no stored ID and
// nothing kept on the visitor's device. The connection address is read here only
// to make a one-way daily hash and is never stored - see lib/analytics/hits.ts
// for exactly what is kept. ANALYTICS_TOKEN doubles as the hash key (it is
// already a long random secret); the counter still works without it.
export default async (req: Request, context: Context) =>
  handleHit(
    req,
    { country: context.geo?.country?.code, ip: context.ip },
    { store: getStore('analytics'), salt: process.env.ANALYTICS_TOKEN },
  );

export const config: Config = { path: '/api/hit' };
