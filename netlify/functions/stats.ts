import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { handleStats } from '../../src/lib/analytics/server';

// Feeds the /analytics/ dashboard. Locked behind a secret: set ANALYTICS_TOKEN
// in the Netlify dashboard (Site configuration > Environment variables) to a
// long random string, e.g.
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// With no token set it answers 503 and serves nothing.
export default async (req: Request) =>
  handleStats(req, { store: getStore('analytics'), token: process.env.ANALYTICS_TOKEN });

export const config: Config = { path: '/api/stats' };
