# Legacy Stripe checkout

This folder keeps the original Stripe implementation intact. It is **not**
imported, mounted, or used by the running application. Clerk Billing is the
active billing system.

Files:

- `checkout.controller.js` - Stripe Checkout session, session status, webhook,
  and purchase history handlers.
- `checkout.route.js` - Express routes for the handlers above.
- `order.model.js` - MongoDB model for completed Stripe purchases.
- `checkout.route.js` was previously mounted at `/api/payment`.

The frontend copy lives at `SGGS/src/legacy/stripe/` (`Return.jsx` and the old
`Pricing.jsx`).

## Re-enabling Stripe (only if you deliberately switch back)

1. Mount the routes in `src/app.js`:

   ```js
   import { checkoutRoute } from "./legacy/stripe/checkout.route.js";
   import { webhookHandler } from "./legacy/stripe/checkout.controller.js";

   // Must be before express.json() so the raw body is available.
   app.post(
     "/api/payment/webhook",
     express.raw({ type: "application/json" }),
     webhookHandler
   );

   app.use("/api/payment", checkoutRoute);
   ```

2. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to the backend
   environment.

3. Add `VITE_STRIPE_PUBLIC_KEY` to the frontend environment and restore the
   Stripe pricing/return routes.

4. Remove or bypass the Clerk Billing flow. Never leave both rails active at
   the same time.
