#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
const envText = await readFile(process.env.AI_COMPANY_ENV_FILE ?? '.env.local', 'utf8').catch(() => '');
const env = (key) => envText.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();
const url = process.env.SUPABASE_URL ?? env('SUPABASE_URL');
const key = process.env.SUPABASE_SECRET_KEY ?? env('SUPABASE_SECRET_KEY');
const db = process.env.SUPABASE_DB_CONNECTION_STRING ?? env('SUPABASE_DB_CONNECTION_STRING');
const psqlPath = process.env.AI_COMPANY_PSQL_PATH ?? env('AI_COMPANY_PSQL_PATH') ?? '/opt/homebrew/bin/psql';
const heartbeatKey = process.env.AI_COMPANY_HEARTBEAT_KEY ?? 'local-supervisor';
const namespace = 'ai-company-heartbeat';
const source = 'macrolens-local-supervisor';
if (!url || (!key && !db)) { console.error('SUPABASE_HEARTBEAT_BLOCKED: missing server-side configuration'); process.exit(2); }
const base = `${url.replace(/\/$/, '')}/rest/v1/ai_company_heartbeats`;
const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const request = async (input, init = {}) => { const response = await fetch(input, { ...init, headers: { ...headers, ...(init.headers ?? {}) } }); const text = await response.text(); if (!response.ok) throw new Error(`Supabase heartbeat HTTP ${response.status}: ${text.slice(0, 240)}`); return text; };
const directSql = async (sql) => { if (!db) throw new Error('SUPABASE_SECRET_KEY required for REST heartbeat'); await execFileAsync(psqlPath, [db, '-X', '-v', 'ON_ERROR_STOP=1', '-Atc', sql], { maxBuffer: 64 * 1024 }); };
const action = process.argv[2] ?? 'write';
try {
  const deleteExact = async () => { if (key) { const query = `?heartbeat_key=eq.${encodeURIComponent(heartbeatKey)}&namespace=eq.${encodeURIComponent(namespace)}&source=eq.${encodeURIComponent(source)}`; await request(`${base}${query}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); } else await directSql(`delete from public.ai_company_heartbeats where heartbeat_key=${sqlLiteral(heartbeatKey)} and namespace=${sqlLiteral(namespace)} and source=${sqlLiteral(source)};`); };
  const writeExact = async () => { if (key) await request(base, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ heartbeat_key: heartbeatKey, namespace, source, written_at: new Date().toISOString(), metadata: { purpose: 'liveness-only', production_autonomy: 'DISABLED' } }) }); else await directSql(`insert into public.ai_company_heartbeats (heartbeat_key, namespace, source, written_at, metadata) values (${sqlLiteral(heartbeatKey)},${sqlLiteral(namespace)},${sqlLiteral(source)},now(),'{"purpose":"liveness-only","production_autonomy":"DISABLED"}'::jsonb) on conflict (heartbeat_key) do update set written_at=excluded.written_at, metadata=excluded.metadata;`); };
  if (action === 'write') { await writeExact(); console.log(JSON.stringify({ status: 'HEARTBEAT_WRITTEN', table: 'ai_company_heartbeats', namespace, heartbeat_key: heartbeatKey, transport: key ? 'rest' : 'postgres' })); }
  else if (action === 'cleanup') { await deleteExact(); console.log(JSON.stringify({ status: 'HEARTBEAT_DELETED', table: 'ai_company_heartbeats', namespace, heartbeat_key: heartbeatKey, transport: key ? 'rest' : 'postgres' })); }
  else if (action === 'pulse') { await deleteExact(); await writeExact(); console.log(JSON.stringify({ status: 'HEARTBEAT_PULSED', table: 'ai_company_heartbeats', namespace, heartbeat_key: heartbeatKey, transport: key ? 'rest' : 'postgres' })); }
  else { console.error('usage: supabase-heartbeat.mjs [write|cleanup]'); process.exit(2); }
} catch (error) { console.error(`SUPABASE_HEARTBEAT_BLOCKED: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); }
