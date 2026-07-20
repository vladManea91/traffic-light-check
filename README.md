# High Freedom OS · Sunday Check-in

Standalone web app. No Claude account, no login screen beyond a name and a
4 digit code the member picks themselves. Works on any phone browser.

## Required step: set two environment variables

Your site hit `MissingBlobsEnvironmentError`, which means Netlify isn't
auto-injecting Blobs credentials into this function at runtime. The fix
is to give it the credentials directly. Takes about 2 minutes.

1. **Get your Site ID.** In the Netlify dashboard, open this site, go to
   **Site configuration → General → Site details**. Copy the **Site ID**
   (a long string like `a1b2c3d4-...`).
2. **Create a Personal Access Token.** Click your avatar top right →
   **User settings → Applications → Personal access tokens → New access
   token**. Name it something like `checkin-blobs`, generate it, and
   copy the token immediately, Netlify only shows it once.
3. **Add both as environment variables on this site.** Still in this
   site's dashboard: **Site configuration → Environment variables → Add
   a variable**. Add two:
   - `BLOBS_SITE_ID` = the Site ID from step 1
   - `BLOBS_TOKEN` = the token from step 2
4. **Redeploy.** Go to the **Deploys** tab → **Trigger deploy** →
   **Deploy site**. Environment variable changes only take effect on a
   fresh deploy, not on the running one.
5. Try "That's me" again. It should work now. If it still errors, check
   the **Functions → checkin → Function log** again, the message will
   now be different and will tell us the next thing to fix.

## What this section is about

- `public/index.html` — the entire front end, plain HTML/CSS/JS, no build step, no framework.
- `netlify/functions/board.js` — returns the full board (read only, public).
- `netlify/functions/checkin.js` — claims a name and saves a weekly check-in. Requires the matching 4 digit code to write to a given name, so one member can never edit another's status.
- Storage is Netlify Blobs, included free on every Netlify site, no database to set up.

## How it works for members

1. Open the link.
2. First time: type a name and pick a 4 digit code. That's their key from now on, on any device.
3. Every Sunday: tap Green, Yellow, or Red, add one line on what they're working on, tap save. Under a minute.
4. They see everyone's current color, weekly note, and an 8-week trend. They cannot edit anyone but themselves.

Data is kept for roughly 7 months (30 weeks) and prunes automatically after that.

## Deploy on Netlify

**Option A, drag and drop (fastest):**
1. Go to Netlify's app dashboard and choose "Deploy manually" / "Add new site."
2. Since this uses Netlify Functions, drag-and-drop of the folder alone won't install the `@netlify/blobs` dependency. Use Option B instead unless you're comfortable running `npm install` locally first and dragging the whole folder including `node_modules`.

**Option B, connect a repo (recommended):**
1. Push this folder to a new GitHub repo (or add it as a subfolder in your existing website repo, in which case set the Netlify "Base directory" to this folder's path).
2. In Netlify: "Add new site" → "Import an existing project" → pick the repo.
3. Build settings:
   - Build command: leave empty
   - Publish directory: `public`
   - Functions directory: `netlify/functions` (already set in `netlify.toml`, Netlify will pick it up automatically)
4. Deploy. Netlify will run `npm install` automatically because `package.json` is present, which pulls in `@netlify/blobs`.
5. Set the two environment variables described at the top of this README (`BLOBS_SITE_ID` and `BLOBS_TOKEN`), then trigger a fresh deploy. On some sites Netlify Blobs auto-configures without this, but if you hit `MissingBlobsEnvironmentError` this manual step is the fix.

**Custom domain / subdomain:** once deployed, you can point something like `checkin.vlad-manea.de` at this site from Netlify's domain settings, so the link looks clean in your Sunday post.

## Sending it to your members

Paste the link every Sunday, something like:

> Sunday check-in: [your link]
> Green, yellow, or red, one line on what you're working on. Takes a minute.

## If you ever want to reset someone

There's no admin panel yet. To manually remove or edit a member's record you'd go into the Netlify dashboard under Blobs, find the `checkins` store, and edit or delete the `member:<slug>` key directly. If you want a lightweight admin view later (search by name, force-reset a code, remove someone), that's a quick add whenever you want it.
