import Stripe from "stripe";
import Booking from "../models/Booking.js";
import { inngest } from "../inngest/index.js";

export const stripeWebhooks = async (request, response) => {
  console.log("Stripe webhook hit");

  const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = request.headers["stripe-signature"];

  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(
      request.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log("Stripe event type:", event.type);
  } catch (error) {
    console.log("Stripe webhook signature error:", error.message);
    return response.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        console.log("Payment intent succeeded");

        const paymentIntent = event.data.object;

        const sessionList = await stripeInstance.checkout.sessions.list({
          payment_intent: paymentIntent.id,
        });

        const session = sessionList.data[0];

        console.log("Stripe session:", session.id);
        console.log("Stripe metadata:", session?.metadata);

        if (!session) {
          throw new Error("Stripe checkout session not found");
        }

        const { bookingId } = session.metadata;

        if (!bookingId) {
          throw new Error("Booking ID not found in Stripe session metadata");
        }

        await Booking.findByIdAndUpdate(bookingId, {
          isPaid: true,
          paymentLink: "",
        });

        await inngest.send({
          name: "app/show.booked",
          data: {
            bookingId,
          },
        });

        console.log("Inngest event sent: app/show.booked", bookingId);

        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    response.json({ received: true });
  } catch (error) {
    console.log("Webhook processing error:", error);
    response.status(500).send("Internal Server error");
  }
};