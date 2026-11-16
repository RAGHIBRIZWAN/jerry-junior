# Jerrys Junior: Kids Clothing Shop & WhatsApp Ordering

Customers browse your clothes (no login), see every photo and video, pick a size and add items to their bag. At checkout they enter their name, phone and address. The order is saved in MongoDB, and WhatsApp opens with the whole order already typed out to your number. You confirm with the buyer on WhatsApp and mark the order **Confirmed** in the admin panel.

## How it works

```
                 ┌──────────────── Vercel (always on) ────────────────┐
Buyer's phone ─► │  Website (React)  +  /api and /media functions     │ ─►  MongoDB Atlas
                 └────────────────────────────────────────────────────┘     (products, orders,
                                                                              banners, photos, videos)
                                                                                    ▲
Your laptop, only when you want to add/edit products:  Admin panel ────────────────┘
```

- The **website runs on Vercel** and reads everything straight from **MongoDB Atlas** (through small serverless functions). **Your laptop can be off.**
- **Photos and videos are stored inside the database**, so they don't depend on your laptop either.
- You turn on the **backend (admin panel) only when you want to add or change products**, or check orders. No tunnel, no pm2, nothing to keep running.

---

## Contents

1. [Folder structure](#1-folder-structure)
2. [Run it on your laptop](#2-run-it-on-your-laptop)
3. [Settings (.env)](#3-settings-env)
4. [Import products from Facebook](#4-import-products-from-facebook)
5. [Put it online with Vercel](#5-put-it-online-with-vercel)
6. [Daily workflow](#6-daily-workflow)
7. [Test checklist](#7-test-checklist)
8. [Backups](#8-backups)
9. [Security notes](#9-security-notes)
10. [Common errors and fixes](#10-common-errors-and-fixes)
11. [Customising colours, logo and text](#11-customising-colours-logo-and-text)

---

## 1. Folder structure

```
jerry-junior/
├── vercel.json                     Vercel settings (build, /api + /media functions)
├── api/index.mjs                   Vercel serverless function = the public API
├── backend/                        Admin panel + shared server code (runs on your laptop)
│   ├── .env.example                copy to .env
│   ├── scripts/backup.ps1          database backup
│   └── src/
│       ├── index.js                npm start: admin panel (:5001) + local preview API (:5000)
│       ├── public/server.js        the public API (used by Vercel AND by local preview)
│       ├── admin/                  admin panel (login, products, banners, orders)
│       ├── models/                 Product, Order, Banner, Counter
│       ├── importFacebook.js       imports products from a Facebook export
│       └── utils/                  media (photos/videos in MongoDB), captions, WhatsApp message...
├── frontend/                       React + Vite + Tailwind (the website)
│   ├── public/                     logo.png, banner-default.jpg, og-image.jpg
│   └── src/                        pages, components, index.css (colours)
└── images/                         your original logo and banner files
```

## 2. Run it on your laptop

You need **Node.js 20+** and your **MongoDB Atlas** connection string.

```powershell
# Terminal 1: backend (admin panel)
cd backend
npm install
copy .env.example .env        # then fill in .env (section 3)
npm start

# Terminal 2: website preview
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

- **Shop (preview):** http://localhost:5173
- **Admin panel:** http://localhost:5001 (log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`)

The preview website talks to the local backend (`npm start`). The **live** website on Vercel doesn't need it.

**First start after updating from an older version:** photos that were saved on your laptop (`backend/uploads`) are moved into the database automatically, and the old folder is renamed `uploads_migrated_backup` (you can delete it once the shop looks right).

### Atlas setup
1. Atlas → **Database → Connect → Drivers** → copy the connection string.
2. Put the database name in it: `...mongodb.net/jerry?retryWrites=true&w=majority`.
3. Atlas → **Network Access**: add your laptop's IP for local use, and see section 5 for Vercel.
4. The free Atlas plan has **512MB**. Photos are small (about 100KB each), but videos use space quickly, so keep videos short.

## 3. Settings (.env)

### backend/.env (on your laptop)

| Variable | Example | What it is |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/jerry?...` | Atlas connection (note `/jerry`) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / long password | Admin login |
| `JWT_SECRET` | 64+ random characters | Signs the admin login cookie |
| `VENDOR_WHATSAPP` | `923340030844` | Your WhatsApp number (orders go here) |
| `SHOP_NAME`, `SHOP_CITY`, `CURRENCY` | `Jerrys Junior`, `Karachi`, `PKR` | Shop details |
| `PUBLIC_PORT`, `ADMIN_PORT` | `5000`, `5001` | Local ports |

### Vercel environment variables (section 5)

| Variable | Needed for |
|---|---|
| `MONGODB_URI`, `VENDOR_WHATSAPP` | **Required.** The API function |
| `SHOP_NAME`, `SHOP_CITY`, `CURRENCY` | Shop details |
| `VITE_BRAND_NAME`, `VITE_TAGLINE`, `VITE_FACEBOOK_URL`, `VITE_INSTAGRAM_URL`, `VITE_ANNOUNCEMENTS`, `VITE_SITE_URL` | Website text and links (optional) |

Do **not** put `ADMIN_PASSWORD` or `JWT_SECRET` on Vercel. The live site has no admin.
`VITE_*` values are baked in when Vercel builds, so redeploy after changing them.

## 4. Import products from Facebook

Facebook doesn't let websites read a page's posts, so the importer works from Facebook's **"Download your information"** export. It turns **each post into a product** (all its photos and videos), reads **name, price and sizes from the caption**, and can use the page's profile picture as the logo.

1. On Facebook, switch to the **Jerrys Junior** page, then **Settings → Accounts Center → Your information and permissions → Download your information**. Choose the page, **Specific types of information → Posts**, **Format: JSON**, **Media quality: High**, **All time**. Download the zip(s) when Facebook emails you and extract them all into one folder.
2. Preview: `cd backend` then
   ```powershell
   npm run import-facebook -- "C:\path\to\folder" --dry-run
   ```
   This prints a table and saves `import-report.csv` (open in Excel). Nothing is saved yet.
3. Import: run the same command without `--dry-run`.

Posts without a price in the caption become **hidden drafts**: in the admin panel, **Products → Drafts → Edit**, add the price, save. Running the import again only adds new posts. Options: `--include-uncaptioned`, `--all-drafts`, `--logo "C:\path\logo.jpg"`.

It understands captions like `Sizes: 2-3, 4-5 years`, `Price: 1,450/-`, `Rs. 2200`, `0-3 months`, `S M L XL`, `Free size`, `sale now 2500`. **Always skim the imported products afterwards**, since captions are free text.

## 5. Put it online with Vercel

The website and its API deploy together from this repository. **Your laptop is not involved.**

### Step 1: let Vercel reach the database
Atlas → **Network Access → Add IP Address → "Allow access from anywhere" (`0.0.0.0/0`)**.
Vercel's servers have changing addresses, so a fixed IP list isn't possible. The database is still protected by its username and password (see section 9).

### Step 2: push to GitHub
```powershell
cd D:\PROJECTS\mamu\jerry-junior
git add .
git commit -m "Jerrys Junior shop"
git branch -M main
git remote add origin https://github.com/<you>/jerry-junior.git
git push -u origin main
```
`.env` files are git-ignored, so your passwords are not uploaded.

### Step 3: import into Vercel
1. <https://vercel.com> → **Add New → Project → Import** the repository.
2. **Root Directory:** leave it as the repository root (`./`). **Framework Preset:** *Other*. Everything else is read from `vercel.json`.
3. **Environment Variables:** add `MONGODB_URI` and `VENDOR_WHATSAPP` (and the optional ones from section 3).
4. **Deploy.**

Then open your Vercel address. Check `https://<your-site>/api/settings` shows your WhatsApp number and `https://<your-site>/health` says `"db":"up"`.

Every `git push` redeploys the website. **Adding products does not need a deploy.** Products, photos and banners come from the database.

## 6. Daily workflow

1. **Add or edit products:** on your laptop run `npm start` in `backend`, open http://localhost:5001, then **Products** (photos, videos, sizes, price; click a photo for the cover; tick **New arrival** to feature it) and **Banners** (home page slider).
2. New or changed items appear on the live website within about a minute (the site caches for a few seconds).
3. Press **Ctrl + C** to stop the backend. The shop keeps working.
4. **When a WhatsApp order arrives:** reply to the buyer, then in the admin panel (**Orders**) press **Confirm order** (or **Cancel**). Orders placed while your backend was off are waiting for you in the Orders tab. Pending ones are highlighted.

## 7. Test checklist

- [ ] Backend **off**: the live site still shows the banner, products and photos.
- [ ] Add a product with 3 photos and a video in the admin panel; it appears on the live site within a minute.
- [ ] Product page: photos, video, sizes, zoom, swipe on a phone.
- [ ] Mark it **New arrival**: it shows in New Arrivals with a **NEW** tag.
- [ ] Add to bag, check out, place an order (backend still off).
- [ ] WhatsApp opens to your number with every item, size, quantity and the total.
- [ ] Start the backend: the order is in **Orders** as pending. Press **Confirm order**.

## 8. Backups

Everything (products, orders, banners, photos, videos) lives in Atlas.

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
```

This needs **MongoDB Database Tools** and creates `backend/backups/<date>/db.archive.gz`. Copy it to Google Drive or a USB drive. Restore with `mongorestore --uri="<your uri>" --archive=db.archive.gz --gzip --drop`.

## 9. Security notes

- Create a **dedicated database user** for the shop in Atlas (**Database Access**) with only **Read and write to `jerry`** and a long password, and use it in `MONGODB_URI` (not your Atlas admin user).
- Because of `0.0.0.0/0`, the strength of that password is what protects your database. Keep it long and never share it.
- The live site is **public read + order creation only**. There are no admin routes on Vercel. The admin panel only runs on your laptop at `localhost`.
- Prices always come from the database, never from the browser.
- The order-rate limit (10 per 15 minutes per visitor) is kept in memory on each Vercel instance, so it's a basic protection against spam, not a strict limit.
- Uploads: photos JPG/PNG/WEBP up to 5MB, videos MP4/WEBM/MOV up to 50MB.

## 10. Common errors and fixes

**Live site says "Shop is temporarily offline"**: this now means the database can't be reached. Check `https://<your-site>/health`. Usual causes: Atlas **Network Access** doesn't allow `0.0.0.0/0`; wrong `MONGODB_URI` or password on Vercel; the Atlas cluster is paused (free clusters pause after inactivity; resume it in Atlas).

**No products on the live site**: the website reads the database named in `MONGODB_URI`. Make sure Vercel's value ends with `/jerry` like the one in `backend/.env`.

**Photos or videos don't show**: they load from `/media/...`. Open one in a new tab to see the error. Videos near the 50MB limit can be slow; compress them first.

**Backend says "Cannot reach the database"**: check `MONGODB_URI` and add your current IP in Atlas → Network Access.

**New product not on the live site yet**: wait up to a minute and refresh (results are cached briefly).

**WhatsApp doesn't open after ordering**: the Order Placed page has an **Open WhatsApp** button. In Facebook/Instagram's in-app browser, tap it or choose "Open in browser". Check `VENDOR_WHATSAPP` has digits only with the country code.

**Import: "This export is in HTML format"**: download again with **Format: JSON**. **"media files not found"**: extract all zip parts into one folder, Media quality High.

**Admin says "Forbidden"**: open it as `http://localhost:5001`, not via an IP address.

**Running low on Atlas space (512MB)**: delete old videos, or upgrade the Atlas plan.

## 11. Customising colours, logo and text

- **Logo:** `frontend/public/logo.png`. **Default banner:** `frontend/public/banner-default.jpg` (used until you add banners in admin). **Share image:** `frontend/public/og-image.jpg` (1200×630).
- **Colours:** the `@theme` block at the top of `frontend/src/index.css` (taken from the logo: navy, red, yellow).
- **Top-bar messages, tagline, social links:** the `VITE_*` variables or `frontend/src/config.js`. Only list things that are true for your shop.
- WhatsApp and Facebook link previews can't read your JavaScript, so product links share the general shop image.
