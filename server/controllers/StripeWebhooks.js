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
      process.env.STRIPE_WEBHOOK_SECRET,
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
        if (!session) {
          throw new Error("Stripe checkout session not found");
        }

        console.log("Stripe session:", session.id);
        console.log("Stripe metadata:", session?.metadata);

        const { bookingId } = session.metadata;

        if (!bookingId) {
          throw new Error("Booking ID not found in Stripe session metadata");
        }

        // Get current booking before updating
        const booking = await Booking.findById(bookingId);

        if (!booking) {
          throw new Error("Booking not found");
        }

        // Prevent duplicate webhook processing
        if (booking.isPaid || booking.paymentStatus === "paid") {
          console.log("Booking already paid:", bookingId);

          break;
        }

        // Prevent expired booking from becoming paid
        if (booking.paymentStatus === "expired") {
          console.log("Payment received for expired booking:", bookingId);

          break;
        }

        // Mark booking as paid
        booking.isPaid = true;
        booking.paymentStatus = "paid";
        booking.paymentLink = "";

        await booking.save();

        await inngest.send({
          name: "app/show.booked",
          data: {
            bookingId,
          },
        });

        console.log("Inngest event sent: app/show.booked", bookingId);

        break;
      }

      case "payment_intent.payment_failed": {
        console.log("Payment intent failed");

        const paymentIntent = event.data.object;

        const sessionList = await stripeInstance.checkout.sessions.list({
          payment_intent: paymentIntent.id,
        });

        const session = sessionList.data[0];

        if (!session) {
          console.log("Stripe checkout session not found for failed payment");
          break;
        }

        const bookingId = session.metadata?.bookingId;

        if (!bookingId) {
          console.log("Booking ID not found in Stripe session metadata");
          break;
        }

        const booking = await Booking.findById(bookingId);

        if (!booking) {
          console.log("Booking not found:", bookingId);
          break;
        }

        // Do not overwrite paid or expired bookings
        if (
          booking.isPaid ||
          booking.paymentStatus === "paid" ||
          booking.paymentStatus === "expired"
        ) {
          console.log(
            "Ignoring failed payment event for booking:",
            bookingId,
            booking.paymentStatus,
          );

          break;
        }

        booking.isPaid = false;
        booking.paymentStatus = "failed";

        await booking.save();

        console.log("Booking marked as failed:", bookingId);

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
