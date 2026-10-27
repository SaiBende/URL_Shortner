# SGGS URL Shortener

A full-stack URL shortener and link studio for **SGGS — Shorten, Generate, Group & Share**. Users create, manage and share short links with analytics, branded QR codes and public link-in-bio profiles, backed by Clerk-powered authentication and Stripe plans. Built with Node.js, Express and MongoDB, with Cloudinary for profile photo uploads. The public frontend runs at **https://sggs.saibende.in**.

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
- **Subscription Plans:** Upgrade your account (basic, standard, premium) via Stripe payments.
- **Role-based URL Limits:** Different plans have different limits on the number of URLs you can create.
- **REST API:** Well-documented API endpoints for all features.

## Tech Stack

- **Backend:** Node.js, Express.js, MongoDB (Mongoose)
- **Authentication:** Clerk (`@clerk/express`), with local Mongo users linked by `clerkId` (email fallback)
- **File Uploads:** Multer, Cloudinary
- **Payments:** Stripe
- **Frontend:** [SGGS Link Studio](https://github.com/SaiBende/SGGS) — React 18, Vite, Tailwind CSS, Clerk, Stripe.js
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js & npm
- MongoDB instance (local or Atlas)
- Clerk application (for authentication)
- Cloudinary account (for profile photos)
- Stripe account (for payments)

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
    STRIPE_SECRET_KEY=your_stripe_secret_key
    FRONTEND_URL=http://localhost:5173
    # Optional until webhook upgrades are enabled:
    # STRIPE_WEBHOOK_SECRET=whsec_...
    ```

    `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` must come from the **same**
    Clerk application as the frontend's `VITE_CLERK_PUBLISHABLE_KEY`. Until both
    backend keys are set, protected API routes return `503`, while public routes
    (redirects, public profiles) continue to work.

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
    - MFA is optional; Clerk’s prebuilt login UI supports email code,
      authenticator (TOTP), backup code, and phone code second factors.

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
    checkout.controller.js
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
  middlewares/
    auth.middleware.js
    error.middleware.js
    ratelimit.middleware.js
  models/
    order.model.js
    url.model.js
    user.model.js
  routes/
    auth.route.js
    checkout.route.js
    publicprofile.route.js
    url.router.js
  utils/
    cloudinary.js
    plans.js
uploads/
```

## License

This project is licensed under the ISC License.

---

**Frontend Repository:** [https://github.com/SaiBende/SGGS](https://github.com/SaiBende/SGGS)