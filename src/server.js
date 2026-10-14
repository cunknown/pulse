import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
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
app.post('/auth/delete-data', (req, res) => res.json({ url: `${process.env.PUBLIC_URL}/data-deletion`, confirmation_code: 'ok' }));
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Public legal pages (Meta requires these to be reachable without the password).
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const legal = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Pulse</title>
<style>body{margin:0;background:#06080a;color:#ece9e4;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}main{max-width:720px;margin:0 auto;padding:48px 20px 80px}h1{font-size:28px;letter-spacing:.08em;text-transform:uppercase;font-weight:500;margin:0 0 6px}h2{font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#8e979a;font-weight:600;margin:34px 0 8px}p,li{color:#cfd3d1}a{color:#bff4f0}.d{color:#8e979a;font-size:14px}</style></head><body><main><h1>${title}</h1><p class="d">Last updated: 14 October 2026</p>${body}</main></body></html>`;
const contact = () => process.env.CONTACT_EMAIL
  ? `<p>Email: <a href="mailto:${esc(process.env.CONTACT_EMAIL)}">${esc(process.env.CONTACT_EMAIL)}</a></p>`
  : '<p>Contact details are available from the operator of this service.</p>';

app.get('/privacy', (req, res) => res.type('html').send(legal('Privacy Policy', `
<p>Pulse is a tool for scheduling Instagram posts and viewing account analytics. This page explains what data Pulse handles when you connect an Instagram account.</p>
<h2>What we collect</h2>
<ul><li>Instagram account details you authorise: account ID, username, profile picture, account type, follower and media counts.</li>
<li>Information about your posts: captions, media links, timestamps, and like and comment counts.</li>
<li>An access token that lets Pulse publish and read data for the account you connected. It is stored encrypted.</li>
<li>Photos, videos and captions you upload to schedule posts.</li></ul>
<h2>How we use it</h2>
<p>Only to provide the service: publishing the posts you schedule, showing analytics, and keeping your connection active. We do not sell your data, share it with advertisers, or use it for profiling.</p>
<h2>Who can see it</h2>
<p>Only the people the operator has given access to Pulse. Data is stored with our hosting and database providers (Render and Supabase) and is shared with Meta only as needed to publish and read your Instagram data.</p>
<h2>Retention and deletion</h2>
<p>We keep your data while your account is connected. You can remove your account at any time, which deletes its stored token and its scheduled posts. See <a href="/data-deletion">how to delete your data</a>.</p>
<h2>Contact</h2>${contact()}`)));

app.get('/terms', (req, res) => res.type('html').send(legal('Terms of Service', `
<p>By connecting an Instagram account to Pulse you agree to these terms.</p>
<h2>The service</h2><p>Pulse lets you schedule and publish Instagram posts and view basic analytics for accounts you own or are authorised to manage.</p>
<h2>Your responsibilities</h2><ul><li>Only connect accounts you own or have permission to manage.</li><li>Only publish content you have the right to post, and follow Instagram's terms and community guidelines.</li></ul>
<h2>Availability</h2><p>The service is provided as is, without warranty. Scheduled posts depend on Instagram's systems and may fail or be delayed.</p>
<h2>Ending use</h2><p>You can disconnect your account at any time. We may suspend access if the service is misused.</p>
<h2>Contact</h2>${contact()}`)));

app.get('/data-deletion', (req, res) => res.type('html').send(legal('Data Deletion', `
<p>You can delete your data from Pulse at any time.</p>
<h2>Option 1: remove the account</h2><p>In Pulse, open <b>Accounts</b> and choose <b>Remove</b> next to the account. This deletes its stored access token and all of its scheduled posts.</p>
<h2>Option 2: revoke access on Instagram</h2><p>In Instagram, go to <b>Settings → Apps and websites</b> and remove Pulse. Pulse will no longer be able to access the account.</p>
<h2>Option 3: ask us</h2><p>Contact us and we will delete everything we hold about your account, including uploaded media.</p>${contact()}`)));

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

// ---------- Editor templates (stored here so every browser and teammate sees the same set) ----------
const idOk = (id) => /^[A-Za-z0-9_-]{6,64}$/.test(id);
const VIDEO_EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v' };
const notFound = (msg) => Object.assign(new Error(msg), { status: 404 });

async function proxy(url, type, res) {
  const r = await fetch(url);
  if (!r.ok || !r.body) throw Object.assign(new Error('File unavailable'), { status: 502 });
  res.set({ 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' });
  Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
}

app.get('/api/templates', wrap(async (req, res) => {
  const { rows } = await pool.query(
    'select id, data, (video_url is not null) as has_video, added from templates order by added nulls last, id'
  );
  const { rows: [c] } = await pool.query('select data, (font_url is not null) as has_font from editor_config where id=1');
  res.json({ templates: rows, config: c ? { ...c.data, has_font: c.has_font } : {} });
}));

app.put('/api/templates/:id', wrap(async (req, res) => {
  if (!idOk(req.params.id)) throw bad('Bad template id');
  const { data, added } = req.body || {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw bad('Missing template data');
  await pool.query(
    `insert into templates (id, data, added) values ($1,$2,$3)
     on conflict (id) do update set data=excluded.data, updated_at=now()`,
    [req.params.id, data, Number(added) || Date.now()]
  );
  res.json({ ok: true });
}));

app.post('/api/templates/:id/video', upload.single('file'), wrap(async (req, res) => {
  if (!idOk(req.params.id)) throw bad('Bad template id');
  const f = req.file;
  if (!f) throw bad('No file received');
  const ext = VIDEO_EXT[f.mimetype];
  if (!ext) throw bad('Templates must be MP4, MOV or WebM videos');
  const path = `templates/${req.params.id}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, f.buffer, { contentType: f.mimetype, upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  await pool.query(
    `insert into templates (id, video_url, video_path, video_type, added) values ($1,$2,$3,$4,$5)
     on conflict (id) do update set video_url=$2, video_path=$3, video_type=$4`,
    [req.params.id, data.publicUrl, path, f.mimetype, Date.now()]
  );
  res.json({ ok: true });
}));

app.get('/api/templates/:id/video', wrap(async (req, res) => {
  const { rows: [t] } = await pool.query('select video_url, video_type from templates where id=$1', [req.params.id]);
  if (!t || !t.video_url) throw notFound('No video for this template');
  await proxy(t.video_url, t.video_type || 'video/mp4', res);
}));

app.delete('/api/templates/:id', wrap(async (req, res) => {
  const { rows: [t] } = await pool.query('delete from templates where id=$1 returning video_path', [req.params.id]);
  if (t && t.video_path) await supabase.storage.from(BUCKET).remove([t.video_path]).catch(() => {});
  res.json({ ok: true });
}));

app.put('/api/templates-config', wrap(async (req, res) => {
  const { cal2, fontName } = req.body || {};
  const data = { cal2: Number(cal2) || 1, fontName: fontName || null };
  await pool.query(
    `insert into editor_config (id, data) values (1,$1)
     on conflict (id) do update set data = editor_config.data || $1::jsonb`,
    [data]
  );
  res.json({ ok: true });
}));

app.post('/api/templates-config/font', upload.single('file'), wrap(async (req, res) => {
  const f = req.file;
  if (!f) throw bad('No font received');
  const ext = (f.originalname.split('.').pop() || 'ttf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'ttf';
  const type = f.mimetype || 'application/octet-stream';
  const path = `templates/font.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, f.buffer, { contentType: type, upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  await pool.query(
    `insert into editor_config (id, font_url, font_path, font_type) values (1,$1,$2,$3)
     on conflict (id) do update set font_url=$1, font_path=$2, font_type=$3`,
    [data.publicUrl, path, type]
  );
  res.json({ ok: true });
}));

app.get('/api/templates-config/font', wrap(async (req, res) => {
  const { rows: [c] } = await pool.query('select font_url, font_type from editor_config where id=1');
  if (!c || !c.font_url) throw notFound('No custom font saved');
  await proxy(c.font_url, c.font_type || 'application/octet-stream', res);
}));

app.use(express.static(new URL('../public', import.meta.url).pathname));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Pulse running on port ${port}`));
setInterval(tick, 20_000);
setInterval(() => maintain().catch((e) => console.error('maintain failed:', e.message)), 6 * 3600_000);
setTimeout(() => maintain().catch(() => {}), 5000);
tick();
