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

        // Atomically mark booking as paid only
        // if the reservation is still active
        const paidBooking = await Booking.findOneAndUpdate(
          {
            _id: bookingId,

            paymentMethod: "stripe",

            isPaid: false,

            paymentStatus: {
              $in: ["pending", "failed"],
            },

            reservationExpiresAt: {
              $gt: new Date(),
            },
          },
          {
            $set: {
              isPaid: true,
              paymentStatus: "paid",
              paymentLink: "",
            },
          },
          {
            new: true,
          },
        );

        if (!paidBooking) {
          const currentBooking = await Booking.findById(bookingId);

          if (!currentBooking) {
            throw new Error("Booking not found");
          }

          if (
            currentBooking.isPaid ||
            currentBooking.paymentStatus === "paid"
          ) {
            console.log("Booking already paid:", bookingId);

            break;
          }

          console.log(
            "Stripe payment ignored because reservation is expired or inactive:",
            bookingId,
          );

          break;
        }

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

        const failedBooking = await Booking.findOneAndUpdate(
          {
            _id: bookingId,

            paymentMethod: "stripe",

            isPaid: false,

            paymentStatus: {
              $in: ["pending", "failed"],
            },

            reservationExpiresAt: {
              $gt: new Date(),
            },
          },
          {
            $set: {
              isPaid: false,
              paymentStatus: "failed",
            },
          },
          {
            new: true,
          },
        );

        if (!failedBooking) {
          const currentBooking = await Booking.findById(bookingId);

          if (!currentBooking) {
            console.log("Booking not found:", bookingId);
            break;
          }

          console.log(
            "Ignoring Stripe failed-payment event for booking:",
            bookingId,
            currentBooking.paymentStatus,
          );

          break;
        }

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
