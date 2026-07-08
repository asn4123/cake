# Sienna's Cake Kitchen — homemade cake booking site

A single-page site for a home bakery: customers browse cakes (with live pricing
pulled straight from a Google Sheet), submit a booking request, and staff get
an email immediately. The customer also gets a confirmation email. **No online
payment** — staff calls the customer to confirm details and take payment.

## How it fits together

```
Browser (index.html)
   │
   ├── GET  /api/products  → functions/api/products.js → calls the Apps
   │                          Script Web App, which reads the "Cakes" tab
   │                          of your Google Sheet directly
   │
   └── POST /api/book      → functions/api/book.js → calls the same Apps
                              Script Web App, which sends 2 emails via
                              MailApp (staff + customer) and logs the
                              booking to a "Bookings" tab
```

Images live in **Cloudflare R2**. Upload photos to a public R2 bucket and
paste the resulting URLs into the Google Sheet, same place as the price.

There's no separate database — the Sheet is the product catalog, and the
"Bookings" tab (created automatically) is your order log. The Cloudflare
Pages Functions are a thin, cached proxy in front of one Apps Script URL —
no Google Cloud project, no OAuth tokens to manage.

---

## 1. Set up the Google Sheet

1. Create a new Google Sheet. Rename the first tab to **Cakes** with this
   header row:

   | Name | Description | Price | Image URL | Available |
   |------|-------------|-------|-----------|-----------|

2. Add one row per cake. Make `Available` a checkbox column — unchecked
   cakes won't show on the site.
3. That's it for the sheet itself — no "publish to web" step needed, since
   Apps Script reads it directly. A **Bookings** tab will appear
   automatically the first time someone books.

## 2. Set up Cloudflare R2 (images)

1. Cloudflare dashboard → **R2 → Create bucket**, e.g. `cake-photos`.
2. Open the bucket → **Settings → Public access** → enable it (you'll get an
   `r2.dev` URL, or attach a custom domain).
3. Upload your cake photos.
4. For each photo, copy its public URL into the **Image URL** column in the
   Sheet, next to the matching cake.

## 3. Deploy the Apps Script

1. In the Sheet: **Extensions → Apps Script**.
2. Delete the placeholder code and paste in the contents of
   `apps-script/Code.gs` from this project.
3. **Project Settings** (gear icon) → **Script Properties** → add:
   - `STAFF_EMAIL` — the inbox that should receive booking alerts
   - `SHARED_SECRET` — any random string, e.g. generate one at
     `https://www.uuidgenerator.net/` (recommended — stops strangers from
     POSTing fake bookings directly to the script URL)
4. **Deploy → New deployment** → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, authorize the permissions it asks for (it needs to send
   email and read the sheet — that's expected), and copy the **Web app URL**
   (ends in `/exec`). That's your `APPS_SCRIPT_URL`.
6. The first time it runs, Google may show an "unverified app" warning since
   it's your own personal script — click **Advanced → Go to (project
   name)** to proceed. This is normal for personal Apps Script projects.

If you edit the script later, use **Deploy → Manage deployments → Edit →
New version** so the live `/exec` URL picks up the changes.

## 4. Deploy to Cloudflare Pages

Using Wrangler (CLI):

```bash
npm install -g wrangler
cd cake-site
wrangler login
wrangler pages project create siennas-cake-kitchen
wrangler pages deploy .
```

Or connect a GitHub repo in the dashboard: **Workers & Pages → Create →
Pages → Connect to Git** (build command: none, output directory: `/`).

### Set environment variables (Pages dashboard → your project → Settings → Environment variables)

| Name | Value |
|---|---|
| `APPS_SCRIPT_URL` | the `/exec` URL from step 3 |
| `APPS_SCRIPT_SHARED_SECRET` | the same `SHARED_SECRET` value from step 3 *(mark as Secret)* |

Set these for both **Production** and **Preview**, then redeploy so the
functions pick them up.

## 5. Local development

```bash
wrangler pages dev .
```

For local secrets, create a `.dev.vars` file (already gitignored):

```
APPS_SCRIPT_URL=...
APPS_SCRIPT_SHARED_SECRET=...
```

## Customizing

- **Branding/copy**: edit text directly in `index.html`.
- **Colors/fonts**: design tokens are at the top of `style.css` under `:root`.
- **Form fields**: add/remove fields in `<form id="booking-form">` in
  `index.html`, then read them in `functions/api/book.js` **and**
  `apps-script/Code.gs` (both validate the payload).
- **Spam protection**: a hidden honeypot field is already wired up, plus the
  shared-secret check on the Apps Script side. For heavier traffic, consider
  adding Cloudflare Turnstile to the form too.

## Notes on the booking flow

Submitting the form only sends the two notification emails and logs the
booking — no payment happens online. Your team calls the customer to confirm
flavor/size/date and collect payment by whatever method you use. If you
later want online payment, that's a separate addition (e.g. a Stripe Payment
Link sent during the confirmation call).
