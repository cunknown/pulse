import { pool } from './db.js';
import { encrypt, decrypt } from './crypto.js';
import * as ig from './instagram.js';

const BATCH = Number(process.env.PUBLISH_BATCH || 25);
let busy = false;

// Runs every ~20s. Safe to run on several servers: rows are claimed with SKIP LOCKED.
export async function tick() {
  if (busy) return;
  busy = true;
  try {
    await pool.query(
      `update posts set status='failed',
         last_error='Interrupted while publishing. Check Instagram before retrying.'
       where status='publishing' and locked_at < now() - interval '15 minutes'`
    );
    const { rows } = await pool.query(
      `update posts set status='publishing', locked_at=now(), attempts=attempts+1
       where id in (
         select id from posts where status='scheduled' and scheduled_at <= now()
         order by scheduled_at limit $1 for update skip locked)
       returning *`,
      [BATCH]
    );
    await Promise.all(rows.map(run));
  } catch (e) {
    console.error('tick failed:', e.message);
  } finally {
    busy = false;
  }
}

async function run(p) {
  try {
    const { rows: [a] } = await pool.query('select * from accounts where id=$1', [p.account_id]);
    if (!a || a.status !== 'active') {
      throw Object.assign(new Error('Account needs to be reconnected'), { fatal: true });
    }
    const res = await ig.publish({
      igUserId: a.ig_user_id,
      token: decrypt(a.token_enc),
      post: p,
      onContainer: (id) => pool.query('update posts set container_id=$2 where id=$1', [p.id, id]),
    });
    await pool.query(
      `update posts set status='published', ig_media_id=$2, permalink=$3, published_at=now(), last_error=null where id=$1`,
      [p.id, res.id, res.permalink]
    );
    console.log(`published ${p.id} to account ${a.username}`);
  } catch (e) {
    if (e.auth) await pool.query(`update accounts set status='needs_reconnect' where id=$1`, [p.account_id]);
    const retry = !e.fatal && !e.auth && p.attempts < 3;
    await pool.query(
      `update posts set status=$2,
         scheduled_at = case when $2='scheduled' then now() + interval '2 minutes' else scheduled_at end,
         last_error=$3 where id=$1`,
      [p.id, retry ? 'scheduled' : 'failed', e.message]
    );
    console.error(`post ${p.id} ${retry ? 'will retry' : 'failed'}: ${e.message}`);
  }
}

// Runs at startup and every 6h: renews tokens that expire within 20 days, snapshots follower counts.
export async function maintain() {
  const { rows } = await pool.query(`select * from accounts where status='active'`);
  for (const a of rows) {
    try {
      let token = decrypt(a.token_enc);
      if (new Date(a.token_expires_at) - Date.now() < 20 * 864e5) {
        const r = await ig.refresh(token);
        token = r.access_token;
        await pool.query(
          `update accounts set token_enc=$2, token_expires_at = now() + make_interval(secs => $3::int) where id=$1`,
          [a.id, encrypt(token), r.expires_in]
        );
      }
      const p = await ig.profile(token);
      await pool.query(
        `insert into follower_snapshots (account_id, day, followers, media_count) values ($1, current_date, $2, $3)
         on conflict (account_id, day) do update set followers=$2, media_count=$3`,
        [a.id, p.followers_count, p.media_count]
      );
    } catch (e) {
      if (e.auth) await pool.query(`update accounts set status='needs_reconnect' where id=$1`, [a.id]);
      console.error(`maintain ${a.username}: ${e.message}`);
    }
  }
}
