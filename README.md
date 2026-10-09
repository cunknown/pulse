# Pulse backend

Connect Instagram accounts, schedule posts, and watch them publish. Built for one account today and designed to grow to hundreds.

**Stack:** Node 20+, Express, Postgres (Supabase), Supabase Storage for media. One service does everything: the web app, the API and the publishing scheduler.

**How publishing works:** every 20 seconds the scheduler claims posts that are due (safe across multiple servers), creates the Instagram media container, waits until it is ready, publishes it, and saves the permalink. Failures retry up to 3 times, two minutes apart. Tokens are encrypted at rest and renewed automatically before the 60-day expiry.

## Setup (about 30 minutes)

### 1. Instagram account
It must be a **Business or Creator** account (Instagram app > Settings > Account type). No Facebook Page is needed.

### 2. Supabase (database and media)
1. Create a project at supabase.com.
2. **Project Settings > Database**: copy the connection string (pooler URI) into `DATABASE_URL`.
3. **Project Settings > API**: copy the project URL into `SUPABASE_URL` and the `service_role` key into `SUPABASE_SERVICE_KEY`.
4. **Storage**: create a bucket named `media` and make it **Public**. Instagram has to download your photos and videos from a public link.

The tables are created automatically on first start.

### 3. Deploy first (you need an https URL for Meta)
Render, Railway or Fly all work. On Render: New Web Service from your GitHub repo, build command `npm install`, start command `npm start`. Add every variable from `.env.example`. Set `PUBLIC_URL` to the URL Render gives you.

Generate the other two secrets:
- `TOKEN_ENC_KEY`: run `openssl rand -hex 32`
- `APP_PASSWORD`: any long password. This is what you type when the browser asks for a login (the username can be anything).

Use a paid always-on instance. Free instances sleep, and a sleeping server cannot publish on time.

### 4. Meta app
1. developers.facebook.com > **Create app**, use case **Other**, type **Business**.
2. Add the **Instagram** product, then open **API setup with Instagram login**.
3. Copy the **Instagram app ID** and **Instagram app secret** into `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`.
4. Step 3, **Set up Instagram business login**, add these URLs (replace the domain):
   - Redirect URL: `https://YOUR-APP/auth/instagram/callback`
   - Deauthorize callback: `https://YOUR-APP/auth/deauthorize`
   - Data deletion request: `https://YOUR-APP/auth/delete-data`
5. Check that the permissions `instagram_business_basic` and `instagram_business_content_publish` are listed.
6. Add yourself as tester: **App roles > Roles > Add people > Instagram Testers**, enter the Instagram username, then accept the invite in the Instagram app (**Settings > Apps and websites > Tester invites**).

While the app is in Development mode it works for accounts you add as testers. No App Review is needed for your A/B testing.

### 5. First test
1. Open your Pulse URL and log in.
2. **Accounts > Connect account**, approve on Instagram.
3. **Schedule > New post**, pick a JPEG, write a caption, choose **Publish now**.
4. Within about 30 seconds the row changes from Publishing to Published, and **View** opens the live post.
5. Then test a real schedule: set a time 5 minutes out and watch it fire.

## Local development
```
cp .env.example .env     # fill it in
npm install
npm run dev
```
Meta needs an https redirect URL, so for connecting accounts locally use a tunnel (for example `ngrok http 3000`) and set `PUBLIC_URL` to the tunnel address.

## Going to hundreds of accounts
- **Advanced Access:** to connect accounts you do not own (clients), the app needs App Review for the two permissions plus Business Verification. Start this early, it takes time.
- **Throughput:** raise `PUBLISH_BATCH` and use the Stagger option when posting to many accounts at once. Instagram also limits API publishing per account per day (check Meta's current limit).
- **Real logins:** the single password is fine for you. Before other people use it, add proper user accounts (Supabase Auth is the easy route).
- **Analytics history:** follower counts are saved daily from today. Per-post insights and reports are the next feature to build on top.

## Files
- `src/server.js`: web server, login with Instagram, API
- `src/instagram.js`: all Instagram API calls
- `src/scheduler.js`: publishing loop and daily token renewal
- `schema.sql`: database tables
- `public/index.html`: the Pulse interface
