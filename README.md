# SGGS URL Shortener

A full-stack URL shortener web application that allows users to create, manage, and share short links with analytics, user authentication, and public profiles. Built with Node.js, Express, MongoDB, and integrates with Stripe for payments and Cloudinary for profile photo uploads.

## Features

- **User Authentication:** Register, login, and logout securely using JWT.
- **Shorten URLs:** Generate unique or custom short URLs.
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
- **Authentication:** JWT, bcryptjs
- **File Uploads:** Multer, Cloudinary
- **Payments:** Stripe
- **Frontend:** [SGGS Frontend (React)](https://github.com/SaiBende/SGGS)
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js & npm
- MongoDB instance (local or Atlas)
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
    TOKEN_KEY=your_jwt_secret
    CLOUDINARY_CLOUD_NAME=your_cloudinary_name
    CLOUDINARY_API_KEY=your_cloudinary_api_key
    CLOUDINARY_API_SECRET=your_cloudinary_api_secret
    STRIPE_SECRET_KEY=your_stripe_secret_key
    FRONTEND_URL=https://sggs.me
    ```

4. **Run the server:**
    ```sh
    npm run dev
    ```

5. **Frontend:**
    - The frontend code is available at [https://github.com/SaiBende/SGGS](https://github.com/SaiBende/SGGS)

## API Documentation

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
  controllers/
    auth.controller.js
    checkout.controller.js
    dashboard.controller.js
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
  models/
    url.model.js
    user.model.js
  routes/
    auth.route.js
    checkout.route.js
    publicprofile.route.js
    url.router.js
  utils/
    cloudinary.js
uploads/
```

## License

This project is licensed under the ISC License.

---

**Frontend Repository:** [https://github.com/SaiBende/SGGS](https://github.com/SaiBende/SGGS)