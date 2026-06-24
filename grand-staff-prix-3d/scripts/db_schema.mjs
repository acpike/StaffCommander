import pg from 'pg'
const client = new pg.Client({ connectionString: process.env.DB_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
await client.query(`
  create table if not exists players (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    class_code text not null,
    pin text,
    data jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
  );
  create index if not exists players_class_idx on players (class_code);
  alter table players enable row level security;
`)
for (const [n, sql] of [
  ['anon_read', `create policy anon_read on players for select using (true)`],
  ['anon_insert', `create policy anon_insert on players for insert with check (true)`],
  ['anon_update', `create policy anon_update on players for update using (true) with check (true)`],
]) {
  await client.query(`drop policy if exists ${n} on players`)
  await client.query(sql)
}
const r = await client.query(`select count(*) from players`)
console.log('players table ready. rows:', r.rows[0].count)
await client.end()
