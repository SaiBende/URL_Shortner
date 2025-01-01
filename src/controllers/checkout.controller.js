import stripePackage from 'stripe';
import { User } from '../models/user.model.js';


const stripe = new stripePackage(process.env.STRIPE_SECRET_KEY);

const YOUR_DOMAIN = process.env.FRONTEND_URL;


const createCheckoutSession = async (req, res) => {


  try {
    console.log(req.body);
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: req.body.planName,
            },
            unit_amount: req.body.price * 100,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      return_url: `${YOUR_DOMAIN}/payment/session-status/return?session_id={CHECKOUT_SESSION_ID}`,
    });

    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }

}

const sessionStatus = async (req, res) => {

  const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
  console.log(session);
  const email = session.customer_details.email;
  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(404).json({ message: "User not found  kindly login through payment mail is" });
    }

    const amount = session.amount_total / 100;
    if (amount == 29) { 
      await User.updateOne({ email: email }, { category: "basic" });
    }

    if (amount == 99) {
      await User.updateOne({ email: email }, { category: "standard" });

    }
    if (amount == 499) {
      await User.updateOne  ({ email: email }, { category: "premium" });
    }

    user.save();
    res.send({
      status: session.status,
      customer_email: session.customer_details.email
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
    

  }




  
}


export { createCheckoutSession, sessionStatus };