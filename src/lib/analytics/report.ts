import { OTHER, RAW_RETENTION_DAYS, weekdayIndex } from './core';
import type {
  ClickKind,
  ClickRow,
  DayPoint,
  NameCount,
  PageRow,
  PageStat,
  Report,
  Rollup,
  VitalStat,
  VitalSummary,
} from './types';

// Browser-safe: the dashboard runs this on sample data, the stats function on
// real roll-ups.

const MERGE_CAP = 500;

function addMap(target: Record<string, number>, source: Record<string, number>): void {
  for (const [k, v] of Object.entries(source)) {
    const key = !Object.hasOwn(target, k) && Object.keys(target).length >= MERGE_CAP ? OTHER : k;
    target[key] = (target[key] ?? 0) + v;
  }
}

function top(map: Record<string, number>, limit: number): NameCount[] {
  return Object.entries(map)
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, limit);
}

const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

function summariseVital(s: VitalStat): VitalSummary {
  return { good: s.good, ni: s.ni, poor: s.poor, n: s.n, avg: s.n ? s.sum / s.n : null };
}

function pageRows(pages: Record<string, PageStat>, by: 'views' | 'entries', limit: number): PageRow[] {
  return Object.entries(pages)
    .filter(([, p]) => p[by] > 0)
    .map(([path, p]) => ({
      path,
      views: p.views,
      entries: p.entries,
      avgSec: p.views ? p.engagedMs / p.views / 1000 : 0,
      avgScroll: p.scrollN ? p.scrollSum / p.scrollN : null,
    }))
    .sort((a, b) => b[by] - a[by] || a.path.localeCompare(b.path))
    .slice(0, limit);
}

/**
 * Fold the daily roll-ups for `dates` (oldest first, one per calendar day,
 * whether or not a roll-up exists for it) into the Report the dashboard draws.
 * Visitors are summed per day, so someone who comes back on another day counts
 * again - the dashboard labels it that way.
 */
export function mergeRollups(rollups: Rollup[], dates: string[], opts: { demo?: boolean; now?: number } = {}): Report {
  const byDate = new Map(rollups.map((r) => [r.date, r]));

  const t = {
    visitors: 0, sessions: 0, pageviews: 0, newVisitors: 0, returningVisitors: 0,
    bounced: 0, engagedMs: 0, clicks: 0, formStarts: 0, formOk: 0, formErr: 0,
  };
  const pages: Record<string, PageStat> = {};
  const referrers: Record<string, number> = {};
  const channels: Record<string, number> = {};
  const campaigns: Record<string, number> = {};
  const clickMap: Record<string, number> = {};
  const sections: Record<string, Record<string, number>> = {};
  const forms: Record<string, { start: number; ok: number; err: number }> = {};
  const custom: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const devices: Record<string, number> = {};
  const browsers: Record<string, number> = {};
  const oses: Record<string, number> = {};
  const languages: Record<string, number> = {};
  const viewports: Record<string, number> = {};
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const vitals = {
    lcp: { good: 0, ni: 0, poor: 0, sum: 0, n: 0 },
    cls: { good: 0, ni: 0, poor: 0, sum: 0, n: 0 },
    inp: { good: 0, ni: 0, poor: 0, sum: 0, n: 0 },
  };

  const daily: DayPoint[] = dates.map((date) => {
    const r = byDate.get(date);
    if (!r) return { date, visitors: 0, sessions: 0, pageviews: 0, clicks: 0, enquiries: 0 };

    t.visitors += r.visitors;
    t.sessions += r.sessions;
    t.pageviews += r.pageviews;
    t.newVisitors += r.newVisitors;
    t.returningVisitors += r.returningVisitors;
    t.bounced += r.bouncedSessions;
    t.engagedMs += r.engagedMs;
    t.clicks += r.clicks;
    t.formStarts += r.formStarts;
    t.formOk += r.formOk;
    t.formErr += r.formErr;

    for (const [path, p] of Object.entries(r.pages)) {
      const key = !Object.hasOwn(pages, path) && Object.keys(pages).length >= MERGE_CAP ? OTHER : path;
      const agg = (pages[key] ??= { views: 0, entries: 0, engagedMs: 0, scrollSum: 0, scrollN: 0 });
      agg.views += p.views;
      agg.entries += p.entries;
      agg.engagedMs += p.engagedMs;
      agg.scrollSum += p.scrollSum;
      agg.scrollN += p.scrollN;
    }
    addMap(referrers, r.referrers);
    addMap(channels, r.channels);
    addMap(campaigns, r.campaigns);
    addMap(clickMap, r.clickMap);
    addMap(custom, r.custom);
    addMap(countries, r.countries);
    addMap(devices, r.devices);
    addMap(browsers, r.browsers);
    addMap(oses, r.oses);
    addMap(languages, r.languages);
    addMap(viewports, r.viewports);
    for (const [path, map] of Object.entries(r.sections)) addMap((sections[path] ??= {}), map);
    for (const [name, f] of Object.entries(r.forms)) {
      const agg = (forms[name] ??= { start: 0, ok: 0, err: 0 });
      agg.start += f.start;
      agg.ok += f.ok;
      agg.err += f.err;
    }
    const wd = weekdayIndex(date);
    r.hours.forEach((n, h) => (heatmap[wd][h] += n));
    for (const k of ['lcp', 'cls', 'inp'] as const) {
      for (const f of ['good', 'ni', 'poor', 'sum', 'n'] as const) vitals[k][f] += r.vitals[k][f];
    }

    const enq = r.forms['enquiry-form']?.ok ?? 0;
    return { date, visitors: r.visitors, sessions: r.sessions, pageviews: r.pageviews, clicks: r.clicks, enquiries: enq };
  });

  const clicks: ClickRow[] = Object.entries(clickMap)
    .map(([key, n]) => {
      const [kind, label, dest, section] = key.split('\t');
      return { kind: kind as ClickKind, label: label ?? key, dest: dest ?? '', section: section ?? '', n };
    })
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
    .slice(0, 40);

  const kindTotals: Record<string, number> = {};
  for (const [key, n] of Object.entries(clickMap)) kindTotals[key.split('\t')[0]] = (kindTotals[key.split('\t')[0]] ?? 0) + n;

  const sectionReport: Report['sections'] = {};
  for (const [path] of Object.entries(sections)
    .map(([p]) => [p, pages[p]?.views ?? 0] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)) {
    sectionReport[path] = {
      views: pages[path]?.views ?? 0,
      rows: Object.entries(sections[path]).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n),
    };
  }

  const enquiries = forms['enquiry-form']?.ok ?? 0;
  return {
    meta: {
      generatedAt: opts.now ?? Date.now(),
      from: dates[0] ?? '',
      to: dates[dates.length - 1] ?? '',
      days: dates.length,
      retentionDays: RAW_RETENTION_DAYS,
      demo: opts.demo ?? false,
    },
    daily,
    totals: {
      visitors: t.visitors,
      sessions: t.sessions,
      pageviews: t.pageviews,
      newVisitors: t.newVisitors,
      returningVisitors: t.returningVisitors,
      bounceRate: ratio(t.bounced, t.sessions),
      avgEngagedSec: t.pageviews ? t.engagedMs / t.pageviews / 1000 : null,
      pagesPerSession: ratio(t.pageviews, t.sessions),
      clicks: t.clicks,
      formStarts: t.formStarts,
      enquiries,
      enquiryErrors: forms['enquiry-form']?.err ?? 0,
      enquiriesPer100Visitors: t.visitors ? (enquiries / t.visitors) * 100 : null,
    },
    pages: pageRows(pages, 'views', 15),
    entries: pageRows(pages, 'entries', 10),
    referrers: top(referrers, 12),
    channels: top(channels, 8),
    campaigns: top(campaigns, 10),
    clicks,
    clickKinds: top(kindTotals, 8),
    sections: sectionReport,
    forms: Object.entries(forms).map(([form, f]) => ({ form, ...f })),
    custom: Object.entries(custom)
      .map(([key, n]) => {
        const [name, label] = key.split('\t');
        return { name, label: label ?? '', n };
      })
      .sort((a, b) => b.n - a.n)
      .slice(0, 20),
    countries: top(countries, 12),
    devices: top(devices, 5),
    browsers: top(browsers, 8),
    oses: top(oses, 8),
    languages: top(languages, 8),
    viewports: top(viewports, 6),
    heatmap,
    vitals: { lcp: summariseVital(vitals.lcp), cls: summariseVital(vitals.cls), inp: summariseVital(vitals.inp) },
  };
}
