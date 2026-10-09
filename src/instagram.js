// Instagram API with Instagram Login (graph.instagram.com). No Facebook Page needed.
const V = process.env.GRAPH_VERSION || 'v26.0';
const G = `https://graph.instagram.com/${V}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const form = (o) => new URLSearchParams(o);

async function call(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error || j.error_message) {
    const e = j.error || {};
    const err = new Error(e.message || j.error_message || `Instagram returned HTTP ${r.status}`);
    err.code = e.code;
    err.auth = e.code === 190 || r.status === 401;
    throw err;
  }
  return j;
}

export const redirectUri = () => `${process.env.PUBLIC_URL}/auth/instagram/callback`;

export function authUrl(state) {
  const q = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'instagram_business_basic,instagram_business_content_publish',
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

export async function exchangeCode(code) {
  let short = await call('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: form({
      client_id: process.env.INSTAGRAM_APP_ID,
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(),
      code,
    }),
  });
  if (short.data?.[0]) short = short.data[0];
  const long = await call(
    'https://graph.instagram.com/access_token?' +
      new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        access_token: short.access_token,
      })
  );
  return { token: long.access_token, expiresIn: long.expires_in };
}

export const refresh = (token) =>
  call(
    'https://graph.instagram.com/refresh_access_token?' +
      new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token })
  );

export const profile = (token) =>
  call(
    `${G}/me?` +
      new URLSearchParams({
        fields: 'user_id,username,account_type,profile_picture_url,followers_count,media_count',
        access_token: token,
      })
  );

export const recentMedia = (token) =>
  call(
    `${G}/me/media?` +
      new URLSearchParams({
        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
        limit: '12',
        access_token: token,
      })
  );

// Two-step publish: create container, wait until ready, publish it.
export async function publish({ igUserId, token, post, onContainer }) {
  let cid = post.container_id;
  if (!cid) {
    const body = { access_token: token, caption: post.caption || '' };
    if (post.media_type === 'REELS') {
      body.media_type = 'REELS';
      body.video_url = post.media_url;
    } else {
      body.image_url = post.media_url;
    }
    const c = await call(`${G}/${igUserId}/media`, { method: 'POST', body: form(body) });
    cid = c.id;
    await onContainer(cid);
  }

  const tries = post.media_type === 'REELS' ? 60 : 12;
  for (let i = 0; i < tries; i++) {
    const s = await call(`${G}/${cid}?` + new URLSearchParams({ fields: 'status_code,status', access_token: token }));
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') {
      throw Object.assign(new Error(`Instagram could not process the media: ${s.status || s.status_code}`), { fatal: true });
    }
    await sleep(post.media_type === 'REELS' ? 5000 : 2500);
  }

  const pub = await call(`${G}/${igUserId}/media_publish`, {
    method: 'POST',
    body: form({ creation_id: cid, access_token: token }),
  });
  const info = await call(`${G}/${pub.id}?` + new URLSearchParams({ fields: 'permalink', access_token: token })).catch(() => ({}));
  return { id: pub.id, permalink: info.permalink || null };
}
