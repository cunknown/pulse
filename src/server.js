import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { pool } from './db.js';
import { assertKey, encrypt, decrypt } from './crypto.js';
import * as ig from './instagram.js';
import { tick, maintain } from './scheduler.js';

for (const k of ['PUBLIC_URL', 'APP_PASSWORD', 'INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!process.env[k]) throw new Error(`Missing environment variable ${k}`);
}
assertKey();
await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BUCKET = process.env.SUPABASE_BUCKET || 'media';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// Callbacks Meta requires in app settings. Public on purpose.
app.post('/auth/deauthorize', (req, res) => res.sendStatus(200));
app.post('/auth/delete-data', (req, res) => res.json({ url: process.env.PUBLIC_URL, confirmation_code: 'ok' }));
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Simple password gate (any username). Replace with real user accounts before opening to clients.
app.use((req, res, next) => {
  const given = Buffer.from((req.headers.authorization || '').replace(/^Basic /, ''), 'base64').toString().split(':').slice(1).join(':');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(process.env.APP_PASSWORD).digest();
  if (crypto.timingSafeEqual(a, b)) return next();
  res.set('WWW-Authenticate', 'Basic realm="Pulse"').status(401).send('Password required');
});

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(req.method, req.path, e.message);
  res.status(e.status || 500).json({ error: e.message });
});
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

// ---------- Connect an Instagram account ----------
const states = new Map();
app.get('/auth/instagram', (req, res) => {
  const s = crypto.randomBytes(16).toString('hex');
  states.set(s, Date.now());
  for (const [k, t] of states) if (Date.now() - t > 10 * 60e3) states.delete(k);
  res.redirect(ig.authUrl(s));
});

app.get('/auth/instagram/callback', async (req, res) => {
  try {
    if (req.query.error) throw new Error(req.query.error_description || req.query.error);
    if (!states.delete(req.query.state)) throw new Error('Login expired. Try connecting again.');
    const { token, expiresIn } = await ig.exchangeCode(String(req.query.code));
    const p = await ig.profile(token);
    const igId = String(p.user_id || p.id);
    const { rows: [a] } = await pool.query(
      `insert into accounts (ig_user_id, username, profile_picture_url, account_type, token_enc, token_expires_at, status)
       values ($1,$2,$3,$4,$5, now() + make_interval(secs => $6::int), 'active')
       on conflict (ig_user_id) do update set username=excluded.username, profile_picture_url=excluded.profile_picture_url,
         account_type=excluded.account_type, token_enc=excluded.token_enc, token_expires_at=excluded.token_expires_at, status='active'
       returning id`,
      [igId, p.username, p.profile_picture_url || null, p.account_type || null, encrypt(token), expiresIn]
    );
    await pool.query(
      `insert into follower_snapshots (account_id, day, followers, media_count) values ($1, current_date, $2, $3)
       on conflict (account_id, day) do update set followers=$2, media_count=$3`,
      [a.id, p.followers_count, p.media_count]
    );
    res.redirect(`/?connected=${encodeURIComponent(p.username)}`);
  } catch (e) {
    console.error('oauth callback:', e.message);
    res.redirect(`/?error=${encodeURIComponent(e.message)}`);
  }
});

// ---------- Accounts ----------
app.get('/api/accounts', wrap(async (req, res) => {
  const { rows } = await pool.query(
    `select a.id, a.username, a.profile_picture_url, a.account_type, a.status, a.token_expires_at,
       (select count(*) from posts p where p.account_id=a.id and p.status='scheduled')::int as scheduled,
       (select followers from follower_snapshots f where f.account_id=a.id order by day desc limit 1) as followers
     from accounts a order by a.username`
  );
  res.json(rows);
}));

app.delete('/api/accounts/:id', wrap(async (req, res) => {
  await pool.query('delete from accounts where id=$1', [req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/accounts/:id/overview', wrap(async (req, res) => {
  const { rows: [a] } = await pool.query('select * from accounts where id=$1', [req.params.id]);
  if (!a) throw Object.assign(new Error('Account not found'), { status: 404 });
  const token = decrypt(a.token_enc);
  try {
    const [profile, media] = await Promise.all([ig.profile(token), ig.recentMedia(token)]);
    const { rows: snapshots } = await pool.query(
      `select day, followers from follower_snapshots where account_id=$1 order by day desc limit 90`, [a.id]
    );
    res.json({ profile, media: media.data || [], snapshots: snapshots.reverse() });
  } catch (e) {
    if (e.auth) await pool.query(`update accounts set status='needs_reconnect' where id=$1`, [a.id]);
    throw Object.assign(e, { status: 502 });
  }
}));

// ---------- Media upload (Instagram needs a public URL) ----------
app.post('/api/upload', upload.single('file'), wrap(async (req, res) => {
  const f = req.file;
  if (!f) throw bad('No file received');
  const kinds = { 'image/jpeg': ['IMAGE', 'jpg'], 'video/mp4': ['REELS', 'mp4'], 'video/quicktime': ['REELS', 'mov'] };
  const k = kinds[f.mimetype];
  if (!k) throw bad('Instagram accepts JPEG photos and MP4 or MOV videos only');
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomBytes(8).toString('hex')}.${k[1]}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, f.buffer, { contentType: f.mimetype });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  res.json({ url: data.publicUrl, media_type: k[0] });
}));

// ---------- Posts ----------
app.get('/api/posts', wrap(async (req, res) => {
  const { rows } = await pool.query(
    `select p.id, p.account_id, a.username, p.caption, p.media_type, p.media_url, p.scheduled_at, p.status,
       p.permalink, p.last_error, p.published_at
     from posts p join accounts a on a.id=p.account_id
     order by p.scheduled_at desc limit 300`
  );
  res.json(rows);
}));

app.post('/api/posts', wrap(async (req, res) => {
  const { account_ids, caption = '', media_url, media_type, scheduled_at, stagger_minutes = 0 } = req.body || {};
  if (!Array.isArray(account_ids) || !account_ids.length) throw bad('Select at least one account');
  if (!/^https:\/\//.test(media_url || '')) throw bad('Media must be a public https URL');
  if (!['IMAGE', 'REELS'].includes(media_type)) throw bad('Media type must be IMAGE or REELS');
  if (caption.length > 2200) throw bad('Caption is over 2,200 characters');
  let base = scheduled_at ? new Date(scheduled_at) : new Date();
  if (isNaN(base)) throw bad('Invalid date');
  if (base < new Date()) base = new Date();
  const step = Math.max(0, Math.min(Number(stagger_minutes) || 0, 240));
  const { rows: accts } = await pool.query('select id from accounts where id = any($1::uuid[]) and status=\'active\'', [account_ids]);
  if (accts.length !== account_ids.length) throw bad('One of the selected accounts is disconnected. Reconnect it first.');
  const created = [];
  for (const [i, id] of account_ids.entries()) {
    const when = new Date(base.getTime() + i * step * 60000);
    const { rows: [p] } = await pool.query(
      `insert into posts (account_id, caption, media_type, media_url, scheduled_at) values ($1,$2,$3,$4,$5) returning id`,
      [id, caption, media_type, media_url, when]
    );
    created.push(p.id);
  }
  setImmediate(tick);
  res.json({ created });
}));

app.delete('/api/posts/:id', wrap(async (req, res) => {
  const r = await pool.query(`delete from posts where id=$1 and status in ('scheduled','failed')`, [req.params.id]);
  if (!r.rowCount) throw bad('Only scheduled or failed posts can be removed');
  res.json({ ok: true });
}));

app.post('/api/posts/:id/retry', wrap(async (req, res) => {
  const r = await pool.query(
    `update posts set status='scheduled', scheduled_at=now(), attempts=0, last_error=null where id=$1 and status='failed'`,
    [req.params.id]
  );
  if (!r.rowCount) throw bad('Only failed posts can be retried');
  setImmediate(tick);
  res.json({ ok: true });
}));

app.use(express.static(new URL('../public', import.meta.url).pathname));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Pulse running on port ${port}`));
setInterval(tick, 20_000);
setInterval(() => maintain().catch((e) => console.error('maintain failed:', e.message)), 6 * 3600_000);
setTimeout(() => maintain().catch(() => {}), 5000);
tick();
