# Jerrys Junior: Kids Clothing Shop & WhatsApp Ordering

Customers browse your clothes (no login), see every photo, pick a size and add items to their bag. At checkout they enter their name, phone and address. The order is saved in MongoDB, and WhatsApp opens with the whole order already typed out to your number. You confirm with the buyer on WhatsApp and mark the order **Confirmed** in the admin panel.

## How it works

```
                 ┌──────── Vercel (always on) ────────┐        ┌──────────────┐
Buyer's phone ─► │ Website (React) + /api function    │ ─────► │ MongoDB Atlas│  products, orders, banners
                 └────────────────────────────────────┘        └──────────────┘
        │  photos load straight from                                  ▲
        └──────────────────────────────► Cloudinary (photos)          │
                                                ▲                     │
Your laptop, only when you add/edit products:   └──── Admin panel ────┘
```

- The **website runs on Vercel** and reads products from **MongoDB Atlas**. **Your laptop can be off.**
- **Photos are stored on Cloudinary** (free plan). MongoDB only keeps each photo's web address. Orders, products and banners are in MongoDB.
- You start the **admin panel on your laptop only when you want to add or change products**, or check orders.
- **Videos are not supported**, only photos.

---

## Contents

1. [Folder structure](#1-folder-structure)
2. [Accounts you need (free)](#2-accounts-you-need-free)
3. [Run it on your laptop](#3-run-it-on-your-laptop)
4. [Settings (.env)](#4-settings-env)
5. [Import products from Facebook](#5-import-products-from-facebook)
6. [Put it online with Vercel](#6-put-it-online-with-vercel)
7. [Daily workflow](#7-daily-workflow)
8. [Test checklist](#8-test-checklist)
9. [Backups and free-plan limits](#9-backups-and-free-plan-limits)
10. [Security notes](#10-security-notes)
11. [Common errors and fixes](#11-common-errors-and-fixes)
12. [Customising colours, logo and text](#12-customising-colours-logo-and-text)

---

## 1. Folder structure

```
jerry-junior/
├── vercel.json                     Vercel settings (build + the /api function)
├── api/index.mjs                   Vercel serverless function = the public API
├── backend/                        Admin panel + shared server code (runs on your laptop)
│   ├── .env.example                copy to .env
│   ├── scripts/backup.ps1          database backup
│   └── src/
│       ├── index.js                npm start: admin panel (:5001) + local preview API (:5000)
│       ├── public/server.js        the public API (used by Vercel AND by the local preview)
│       ├── admin/                  admin panel (login, products, banners, orders)
│       ├── models/                 Product, Order, Banner, Counter
│       ├── importFacebook.js       imports products from a Facebook export
│       └── utils/                  Cloudinary upload, captions, WhatsApp message...
├── frontend/                       React + Vite + Tailwind (the website)
│   ├── public/                     logo.png, banner-default.jpg, og-image.jpg
│   └── src/                        pages, components, index.css (colours)
└── images/                         your original logo and banner files
```

## 2. Accounts you need (free)

| Service | What for | Where |
|---|---|---|
| **MongoDB Atlas** | products, orders, banners | <https://cloud.mongodb.com> |
| **Cloudinary** | photos | <https://cloudinary.com> (sign up free) |
| **Vercel** | the live website | <https://vercel.com> |
| **GitHub** | holds the code for Vercel | <https://github.com> |

### Cloudinary setup (2 minutes)
1. Sign up at <https://cloudinary.com> (free plan, no card needed).
2. Open the **Dashboard**. Under **Product Environment Credentials** you'll see **Cloud name**, **API Key** and **API Secret** (click the eye icon to show it).
3. Put them in `backend/.env` (section 4).
4. That's all. Photos you upload in the admin panel appear in your Cloudinary **Media Library** inside a folder called `jerry-junior`.

### Atlas setup
1. Atlas → **Database → Connect → Drivers** → copy the connection string.
2. Add the database name `jerry` before the `?`: `...mongodb.net/jerry?retryWrites=true&w=majority`.
3. **Network Access**: add your laptop's IP for local use (and see section 6 for Vercel).

## 3. Run it on your laptop

You need **Node.js 20+**.

```powershell
# Terminal 1: backend (admin panel)
cd backend
npm install
copy .env.example .env        # then fill in .env (section 4)
npm start

# Terminal 2: website preview
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

- **Shop (preview):** http://localhost:5173
- **Admin panel:** http://localhost:5001 (log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`)

The preview website talks to the local backend (`npm start`). The **live** website on Vercel doesn't need it.

**Moving your existing photos to Cloudinary (one time):** if you already added products before Cloudinary, their photos are still stored in the database or on your laptop. The first time you run `npm start` with the Cloudinary keys in `backend/.env`, the backend uploads each of them to Cloudinary, updates the products, banners and old orders, and removes the old copies from MongoDB. You'll see messages like `[cloudinary] moved 7 photo(s)`. If the keys are missing it tells you and changes nothing. After you've checked the shop looks right you may delete the folder `backend/uploads_migrated_backup` if it exists.

## 4. Settings (.env)

### backend/.env (on your laptop)

| Variable | Example | What it is |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/jerry?...` | Atlas connection (note `/jerry`) |
| `CLOUDINARY_CLOUD_NAME` | `dxxxxxxx` | From your Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | `123456789012345` | From your Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | `abc...` | From your Cloudinary dashboard. **Keep private** |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / long password | Admin login |
| `JWT_SECRET` | 64+ random characters | Signs the admin login cookie |
| `VENDOR_WHATSAPP` | `923340030844` | Your WhatsApp number (orders go here) |
| `SHOP_NAME`, `SHOP_CITY`, `CURRENCY` | `Jerrys Junior`, `Karachi`, `PKR` | Shop details |

### Vercel environment variables (section 6)

| Variable | Needed for |
|---|---|
| `MONGODB_URI`, `VENDOR_WHATSAPP` | **Required.** The API function |
| `SHOP_NAME`, `SHOP_CITY`, `CURRENCY` | Shop details |
| `VITE_BRAND_NAME`, `VITE_TAGLINE`, `VITE_FACEBOOK_URL`, `VITE_INSTAGRAM_URL`, `VITE_ANNOUNCEMENTS`, `VITE_SITE_URL` | Website text and links (optional) |

Do **not** put `ADMIN_PASSWORD`, `JWT_SECRET` or any `CLOUDINARY_*` value on Vercel. The live site only reads products and creates orders; it never uploads photos.
`VITE_*` values are baked in when Vercel builds, so redeploy after changing them.

## 5. Import products from Facebook

Facebook doesn't let websites read a page's posts, so the importer works from Facebook's **"Download your information"** export. It turns **each post into a product**, uploads its **photos to Cloudinary**, reads **name, price and sizes from the caption**, and can use the page's profile picture as the logo. Videos are skipped.

1. On Facebook, switch to the **Jerrys Junior** page, then **Settings → Accounts Center → Your information and permissions → Download your information**. Choose the page, **Specific types of information → Posts**, **Format: JSON**, **Media quality: High**, **All time**. Download the zip(s) when Facebook emails you and extract them all into one folder.
2. Preview: `cd backend` then
   ```powershell
   npm run import-facebook -- "C:\path\to\folder" --dry-run
   ```
   This prints a table and saves `import-report.csv` (open in Excel). Nothing is uploaded yet.
3. Import: run the same command without `--dry-run` (the Cloudinary keys must be in `backend/.env`).

Posts without a price in the caption become **hidden drafts**: in the admin panel, **Products → Drafts → Edit**, add the price, save. Running the import again only adds new posts. Options: `--include-uncaptioned`, `--all-drafts`, `--logo "C:\path\logo.jpg"`.

It understands captions like `Sizes: 2-3, 4-5 years`, `Price: 1,450/-`, `Rs. 2200`, `0-3 months`, `S M L XL`, `Free size`, `sale now 2500`. **Always skim the imported products afterwards**, since captions are free text.

## 6. Put it online with Vercel

The website and its API deploy together from this repository. **Your laptop is not involved.**

### Step 1: let Vercel reach the database
Atlas → **Network Access → Add IP Address → "Allow access from anywhere" (`0.0.0.0/0`)**.
Vercel's servers have changing addresses, so a fixed IP list isn't possible. The database is still protected by its username and password (see section 10).

### Step 2: push to GitHub
```powershell
cd D:\PROJECTS\mamu\jerry-junior
git add .
git commit -m "Jerrys Junior shop"
git push
```
`.env` files are git-ignored, so your passwords are not uploaded.

### Step 3: import into Vercel
1. <https://vercel.com> → **Add New → Project → Import** the repository.
2. **Root Directory:** leave **empty** (the repository root). If you set it to `frontend` the build fails. **Framework Preset:** *Other*. Leave Install/Build/Output commands empty; `vercel.json` provides them.
3. **Environment Variables:** add `MONGODB_URI` and `VENDOR_WHATSAPP` (and optional ones from section 4).
4. **Deploy.**

Then open `https://<your-site>/health`. It should say `"db":"up"`. And `https://<your-site>/api/products` should list your products.
If a setting is missing, `/api/products` now says exactly which one (for example `"missing":["MONGODB_URI"]`).

Every `git push` redeploys the website. **Adding products does not need a deploy.** Products, photos and banners come from the database and Cloudinary.

## 7. Daily workflow

1. **Add or edit products:** on your laptop run `npm start` in `backend`, open http://localhost:5001, then **Products** (photos, sizes, price; click a photo for the cover; tick **New arrival** to feature it) and **Banners** (home page slider).
2. New or changed items appear on the live website within about a minute (the site caches for a few seconds).
3. Press **Ctrl + C** to stop the backend. The shop keeps working.
4. **When a WhatsApp order arrives:** reply to the buyer, then in the admin panel (**Orders**) press **Confirm order** (or **Cancel**). Orders placed while your backend was off are waiting in the Orders tab (pending ones are highlighted).

## 8. Test checklist

- [ ] Backend **off**: the live site still shows the banner, products and photos.
- [ ] Add a product with 3 photos in the admin panel; it appears on the live site within a minute. In your Cloudinary Media Library the photos are in `jerry-junior/products`.
- [ ] Product page: photos, sizes, zoom, swipe on a phone.
- [ ] Mark it **New arrival**: it shows in New Arrivals with a **NEW** tag.
- [ ] Add to bag, check out, place an order (backend still off).
- [ ] WhatsApp opens to your number with every item, size, quantity and the total.
- [ ] Start the backend: the order is in **Orders** as pending. Press **Confirm order**.
- [ ] Delete a test product in admin: its photos disappear from Cloudinary too.

## 9. Backups and free-plan limits

- **Products, orders, banners** are in Atlas:
  ```powershell
  cd backend
  powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
  ```
  (needs **MongoDB Database Tools**). It creates `backend/backups/<date>/db.archive.gz`. Copy it to Google Drive or a USB drive.
- **Photos** are kept by Cloudinary. To keep your own copy, download the `jerry-junior` folder from the Cloudinary Media Library now and then.
- **Cloudinary free plan:** about **25 credits per month** (1 credit = 1 GB of storage, or 1 GB of bandwidth, or 1,000 image transformations). Uploaded photos are shrunk to 1600px first, so a shop with hundreds of photos uses well under 1 GB. The website asks Cloudinary for small, optimised versions (thumbnails, WebP/AVIF), which keeps bandwidth low. Check **Dashboard → Usage** now and then. If you go over, Cloudinary pauses delivery until the next month or you upgrade.
- **Atlas free plan:** 512MB. Now that photos are on Cloudinary this is plenty for products and orders. The free cluster pauses after long inactivity, so resume it in Atlas if the site shows an error.

## 10. Security notes

- Create a **dedicated database user** in Atlas (**Database Access**) with only **Read and write to `jerry`** and a long password, and use it in `MONGODB_URI` (not your Atlas admin user).
- Because of `0.0.0.0/0`, the strength of that password is what protects your database. Keep it long and never share it.
- The Cloudinary **API secret** only lives in `backend/.env` on your laptop. Never put it on Vercel or in GitHub. If it ever leaks, reset it in Cloudinary (Settings → API Keys).
- The live site is **public read + order creation only**. There are no admin routes on Vercel. The admin panel only runs on your laptop at `localhost`.
- Prices always come from the database, never from the browser.
- The order-rate limit (10 per 15 minutes per visitor) is kept in memory on each Vercel instance, so it's basic protection against spam, not a strict limit.
- Uploads: photos JPG/PNG/WEBP up to 5MB.

## 11. Common errors and fixes

**Live site says "Could not load products" or "temporarily offline"**: open `https://<your-site>/api/products`.
- If it names missing settings, add them in Vercel → Settings → Environment Variables, then **Redeploy**.
- If it says `Database unavailable`: Atlas **Network Access** must allow `0.0.0.0/0`; check the password in `MONGODB_URI`; resume the Atlas cluster if it is paused. Vercel → your project → **Logs** shows the exact error.

**Vercel build fails with `frontend/backend/package.json` not found**: Vercel's **Root Directory** must be empty (repository root), not `frontend`.

**No products on the live site**: Vercel's `MONGODB_URI` must end with `/jerry` like the one in `backend/.env`.

**Photos don't show**: the product's photo addresses start with `https://res.cloudinary.com/...`. If a product still shows `/media/...` or `/uploads/...`, run `npm start` once with the Cloudinary keys set (section 3) to move them. Open a photo address in a new tab to see the error. Check your Cloudinary usage isn't over the free limit.

**Admin says "Cloudinary is not set up"**: add the three `CLOUDINARY_*` lines to `backend/.env` and restart `npm start`.

**Backend says "Cannot reach the database"**: check `MONGODB_URI` and add your current IP in Atlas → Network Access.

**New product not on the live site yet**: wait up to a minute and refresh (results are cached briefly).

**WhatsApp doesn't open after ordering**: the Order Placed page has an **Open WhatsApp** button. In Facebook/Instagram's in-app browser, tap it or choose "Open in browser". Check `VENDOR_WHATSAPP` has digits only with the country code.

**Import: "This export is in HTML format"**: download again with **Format: JSON**. **"media files not found"**: extract all zip parts into one folder, Media quality High.

**Admin says "Forbidden"**: open it as `http://localhost:5001`, not via an IP address.

## 12. Customising colours, logo and text

- **Logo:** `frontend/public/logo.png`. **Default banner:** `frontend/public/banner-default.jpg` (used until you add banners in admin). **Share image:** `frontend/public/og-image.jpg` (1200×630).
- **Colours:** the `@theme` block at the top of `frontend/src/index.css` (taken from the logo: navy, red, yellow).
- **Top-bar messages, tagline, social links:** the `VITE_*` variables or `frontend/src/config.js`. Only list things that are true for your shop.
- WhatsApp and Facebook link previews can't read your JavaScript, so product links share the general shop image.
