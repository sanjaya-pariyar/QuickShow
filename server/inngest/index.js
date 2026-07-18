import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";

export const inngest = new Inngest({ id: "movie-ticket-booking" });

// Inngest function to save user data to database
const syncUserCreation = inngest.createFunction(
  {
    id: "sync-user-from-client",
    triggers: { event: "clerk/user.created" },
  },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } = event.data;

    const userData = {
      _id: id,
      email: email_addresses?.[0]?.email_address,
      name: `${first_name || ""} ${last_name || ""}`.trim(),
      image: image_url,
    };

    await User.create(userData);
  }
);

// Inngest function to delete user from database
const syncUserDeletion = inngest.createFunction(
  {
    id: "delete-user-with-clerk",
    triggers: { event: "clerk/user.deleted" },
  },
  async ({ event }) => {
    const { id } = event.data;

    await User.findByIdAndDelete(id);
  }
);

// Inngest function to update user in database
const syncUserUpdation = inngest.createFunction(
  {
    id: "update-user-with-clerk",
    triggers: { event: "clerk/user.updated" },
  },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } = event.data;

    const userData = {
      email: email_addresses?.[0]?.email_address,
      name: `${first_name || ""} ${last_name || ""}`.trim(),
      image: image_url,
    };

    await User.findByIdAndUpdate(id, userData);
  }
);



//inngest function to cancel bookings and release seats of show after 10 minutes of bookinng created if payment is not made

const releaseSeatsAndDeleteBooking = inngest.createFunction(
  {
    id: "release-seats-delete-booking",
    triggers: { event: "app/checkpayment" },
  },
  async ({ event, step }) => {
    const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000);

    await step.sleepUntil("wait-for-10-minutes", tenMinutesLater);

    await step.run("check-payment-status", async () => {
      const bookingId = event.data.bookingId;

      const booking = await Booking.findById(bookingId);

      if (!booking) {
        return;
      }

      // If payment is not made, release seats and delete booking
      if (!booking.isPaid) {
        const show = await Show.findById(booking.show);

        if (!show) {
          await Booking.findByIdAndDelete(booking._id);
          return;
        }

        booking.bookedSeats.forEach((seat) => {
          delete show.occupiedSeats[seat];
        });

        show.markModified("occupiedSeats");
        await show.save();

        await Booking.findByIdAndDelete(booking._id);
      }
    });
  }
);

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  releaseSeatsAndDeleteBooking,
];