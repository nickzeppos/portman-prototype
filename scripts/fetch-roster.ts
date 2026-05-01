import { writeFile, mkdir } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CongressListSchema,
  VisTableResponseSchema,
  type VisTableResponse,
} from '../lib/schemas/vis-table.js';

const API_BASE = 'https://dev.thelawmakers.org:3000';
const CONGRESSES_TO_FETCH = [113, 114, 115, 116, 117, 118] as const;
const USER_AGENT = 'portman-fetch-roster/0.1 (+local dev seed pull)';
const REQUEST_DELAY_MS = 750;
const REQUEST_TIMEOUT_MS = 30_000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCongressList(): Promise<number[]> {
  console.log(`Fetching ${API_BASE}/vis/congress`);
  const data = await fetchJson(`${API_BASE}/vis/congress`);
  return CongressListSchema.parse(data);
}

async function fetchVisTable(congress: number): Promise<VisTableResponse> {
  const url = `${API_BASE}/vis/table?congress=${congress}`;
  console.log(`Fetching ${url}`);
  const data = await fetchJson(url);
  return VisTableResponseSchema.parse(data);
}

async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  const available = await fetchCongressList();
  for (const c of CONGRESSES_TO_FETCH) {
    if (!available.includes(c)) {
      throw new Error(
        `Congress ${c} not in /vis/congress (got ${available.join(', ')})`,
      );
    }
  }

  for (let i = 0; i < CONGRESSES_TO_FETCH.length; i++) {
    const c = CONGRESSES_TO_FETCH[i];
    const response = await fetchVisTable(c);
    const file = resolve(DATA_DIR, `roster-${c}.raw.json`);
    await writeFile(file, JSON.stringify(response, null, 2) + '\n', 'utf8');
    console.log(`  → wrote ${file} (${response.data.length} rows)`);
    if (i < CONGRESSES_TO_FETCH.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
