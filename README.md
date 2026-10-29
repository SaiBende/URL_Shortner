# SGGS URL Shortener

A full-stack URL shortener and link studio for **SGGS — Shorten, Generate, Group & Share**. Users create, manage and share short links with analytics, branded QR codes and public link-in-bio profiles, backed by Clerk-powered authentication and Clerk Billing subscriptions. Built with Node.js, Express and MongoDB, with Cloudinary for profile photo uploads. The public frontend runs at **https://sggs.saibende.in**.

## Features

- **User Authentication:** Clerk-powered sign-up/sign-in with prebuilt frontend components, email verification, MFA, and password reset. Application data stays in MongoDB.
- **Shorten URLs:** Generate unique or custom short URLs.
- **Modern workspace UI:** Responsive dashboard with search, sorting, copy, rename and delete actions, QR and analytics modals, plus a live link-in-bio editor.
- **QR studio:** Fully client-side QR designer with colours, patterns, error correction, optional logo and PNG download.
- **User Dashboard:** View and manage your created URLs, see visit statistics.
- **URL Analytics:** Track visit history and status for each short URL.
- **Edit Short URLs:** Change the short ID of your URLs.
- **Public Profiles:** Share your profile with social media links and a custom description.
- **Profile Photo Upload:** Upload and update your profile photo (stored on Cloudinary).
- **Social Media Links:** Add or remove social media links to your public profile.
- **Subscription Plans:** Monthly and yearly Basic, Standard and Premium plans through Clerk Billing, with a Clerk-powered subscription manager.
- **Role-based URL Limits:** Different plans have different limits on the number of URLs you can create.
- **REST API:** Well-documented API endpoints for all features.

## Tech Stack

- **Backend:** Node.js, Express.js, MongoDB (Mongoose)
- **Authentication:** Clerk (`@clerk/express`), with local Mongo users linked by `clerkId` (email fallback)
- **File Uploads:** Multer, Cloudinary
- **Payments:** Clerk Billing (Stripe-backed, managed inside Clerk)
- **Frontend:** [SGGS Link Studio](https://github.com/SaiBende/SGGS) — React 18, Vite, Tailwind CSS, Clerk
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js & npm
- MongoDB instance (local or Atlas)
- Clerk application (authentication + Billing enabled)
- Cloudinary account (for profile photos)

### Installation

1. **Clone the repository:**
    ```sh
    git clone https://github.com/SaiBende/SGGS-url-shortener-backend.git
    cd SGGS-url-shortener-backend
    ```

2. **Install dependencies:**
    ```sh
    npm install
    ```

3. **Set up environment variables:**

    Create a `.env` file in the root directory with the following:
    ```
    PORT=8000
    MONGODB_URL=your_mongodb_connection_string
    CLERK_PUBLISHABLE_KEY=pk_test_...
    CLERK_SECRET_KEY=sk_test_...
    CLOUDINARY_CLOUD_NAME=your_cloudinary_name
    CLOUDINARY_API_KEY=your_cloudinary_api_key
    CLOUDINARY_API_SECRET=your_cloudinary_api_secret
    FRONTEND_URL=http://localhost:5173
    # Optional: how long a Clerk subscription snapshot is trusted (ms).
    # BILLING_SYNC_TTL_MS=300000
    ```

    `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` must come from the **same**
    Clerk application as the frontend's `VITE_CLERK_PUBLISHABLE_KEY`. Until both
    backend keys are set, protected API routes return `503`, while public routes
    (redirects, public profiles) continue to work.

    The legacy Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) are
    only needed if you deliberately re-enable `src/legacy/stripe/`.

4. **Configure Clerk:**
    - Enable **Email address** and **Password**; optionally enable **Email code**
      as a passwordless sign-in strategy.
    - Enable **Email verification code** (Clerk’s prebuilt frontend verifies
      codes, not links).
    - Enable **Password reset** with an email code. The frontend links to its
      `/forgot-password` page, which uses Clerk’s reset API.
    - Keep the **Username** attribute **disabled**. The frontend’s prebuilt
      SignUp does not collect one; the backend generates a unique Mongo username
      from the verified email local part. Existing usernames are preserved.
    - Add `http://localhost:5173` and your production frontend origin under
      **Authorized origins**.
    - MFA is optional; Clerk's prebuilt login UI supports email code,
      authenticator (TOTP), backup code, and phone code second factors.
    - **Billing:** claim the application first (`npx clerk auth login`) if it
      was created as an accountless development instance. Billing settings are
      not available through the Backend API, so an unclaimed app cannot enable
      Billing. Then enable it for users in the Clerk Dashboard (or run
      `npx clerk@latest enable billing --for users`). Enabling creates the
      default Free plan automatically with the slug `free_user`; keep it as the
      default. Create the paid plans with these slugs:
      - `basic` — 10 active links, $2/month or $20.04/year
      - `standard` — 30 active links, $5/month or $50.04/year
      - `premium` — unlimited active links, $15/month or $150/year

      Give each paid plan **both a monthly and a yearly price** so the pricing
      table can show the period toggle. Descriptions and features are rendered
      from Clerk; do not mention custom domains in them. The dashboard maps
      Clerk slugs to quotas in `src/utils/plans.js` — it accepts Clerk's
      `free_user` default as well as `free`; update that file if you choose
      different slugs or limits.

      Once the CLI is linked, the catalog can be seeded without the Dashboard:
      `clerk config pull --keys billing`, edit the JSON, then
      `clerk config patch --file billing.json --dry-run` and re-run without
      `--dry-run`. Amounts are integer cents; `annual_monthly_amount` is the
      monthly equivalent of the yearly price.

5. **Run the server:**
    ```sh
    npm run dev
    ```

6. **Frontend:**
    - The frontend code is available at [https://github.com/SaiBende/SGGS](https://github.com/SaiBende/SGGS)

## API Documentation

Protected endpoints expect `Authorization: Bearer <Clerk session token>`. The
frontend obtains the token with Clerk's `getToken()` helper; MongoDB user records
are created or linked automatically on the first authenticated request. New
users are assigned a unique username derived from their verified email; existing
usernames and public profile URLs are preserved.

- **Postman Collection:**  
  [![Run in Postman](https://run.pstmn.io/button.svg)](https://god.gw.postman.com/run-collection/36146554-a40822b8-8e0d-4614-81c8-f2d8f9db34fd?action=collection%2Ffork&source=rip_markdown&collection-url=entityId%3D36146554-a40822b8-8e0d-4614-81c8-f2d8f9db34fd%26entityType%3Dcollection%26workspaceId%3D660e842f-3675-4dc6-89e2-705d6acab151)

- **Full API Docs:**  
  [View API Documentation](https://documenter.getpostman.com/view/36146554/2sA3rwNEr3)

## Project Structure

```
src/
  app.js
  constants.js
  index.js
  config/
    env.js
  controllers/
    auth.controller.js
    billing.controller.js
    dashboard.controller.js
    deleteurl.controller.js
    editurl.controller.js
    redirecturl.controller.js
    url.controller.js
    urlstatus.controller.js
    publicprofile/
      publicprofile.controller.js
  db/
    ConnectMongoDB.js
  legacy/
    stripe/               # inactive Stripe implementation, kept for reference
  middlewares/
    auth.middleware.js
    error.middleware.js
    ratelimit.middleware.js
  models/
    url.model.js
    user.model.js
  routes/
    auth.route.js
    billing.route.js
    publicprofile.route.js
    url.router.js
  utils/
    clerkBilling.js
    cloudinary.js
    plans.js
uploads/
```

## Billing

Clerk Billing owns checkout, renewals, invoices and the subscription manager.
The backend never creates charges itself.

- `GET /api/billing` returns the cached plan and subscription snapshot.
- `POST /api/billing/sync` forces a fresh pull from Clerk (used after checkout).
- `src/middlewares/auth.middleware.js` refreshes the snapshot with a short TTL
  (default 5 minutes, override with `BILLING_SYNC_TTL_MS`), so URL quotas stay
  correct without a Clerk API call on every request.
- `src/utils/plans.js` maps Clerk plan slugs to local categories and limits.
  Unknown slugs fall back to the Free quota rather than granting unlimited use.

### Currency and availability

Clerk Billing is currently **USD-only** and is **not available to merchants
based in India**. If you require INR pricing or an India-based merchant of
record, Clerk Billing cannot satisfy that requirement; the preserved Stripe
implementation in `src/legacy/stripe/` can be re-enabled instead (or Razorpay
can be added as a new rail). The UI reads prices from Clerk, so it never
advertises an INR amount that Clerk would not actually charge.

### Legacy Stripe

The original Stripe implementation is preserved in `src/legacy/stripe/` and is
not mounted. See that folder's `README.md` for re-enabling instructions. Legacy
one-time purchases continue to be honoured through `user.category` and
`user.planExpiresAt` until their paid period ends.

## License

This project is licensed under the ISC License.

---

**Frontend Repository:** [https://github.com/SaiBende/SGGS](https://github.com/SaiBende/SGGS)