import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodemailer.js";

export const inngest = new Inngest({ id: "movie-ticket-booking" });

// Inngest function to save user data to database
const syncUserCreation = inngest.createFunction(
  {
    id: "sync-user-from-client",
    triggers: { event: "clerk/user.created" },
  },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } =
      event.data;

    const userData = {
      _id: id,
      email: email_addresses?.[0]?.email_address,
      name: `${first_name || ""} ${last_name || ""}`.trim(),
      image: image_url,
    };

    await User.create(userData);
  },
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
  },
);

// Inngest function to update user in database
const syncUserUpdation = inngest.createFunction(
  {
    id: "update-user-with-clerk",
    triggers: { event: "clerk/user.updated" },
  },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } =
      event.data;

    const userData = {
      email: email_addresses?.[0]?.email_address,
      name: `${first_name || ""} ${last_name || ""}`.trim(),
      image: image_url,
    };

    await User.findByIdAndUpdate(id, userData);
  },
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
  },
);

//inngest function to send email when user books a show
const sendBookingConfirmationEmail = inngest.createFunction(
  {
    id: "send-booking-confirmation-email",
    triggers: { event: "app/show.booked" },
  },
  async ({ event, step }) => {
    const { bookingId } = event.data;

    await step.run("send-booking-confirmation-email", async () => {
      const booking = await Booking.findById(bookingId)
        .populate({
          path: "show",
          populate: {
            path: "movie",
            model: "Movie",
          },
        })
        .populate("user");

      if (!booking) {
        throw new Error("Booking not found");
      }

      if (!booking.user?.email) {
        throw new Error("User email not found");
      }

      await sendEmail({
        to: booking.user.email,
        subject: `Payment Confirmation: "${booking.show.movie.title}" booked`,
        body: `<div style="font-family: Arial, sans-serif; line-height: 1.5;">
  <h2>Hi ${booking.user.name},</h2>

  <p>
    Your booking for
    <strong style="color: #F84565;">
      "${booking.show.movie.title}"
    </strong>
    is confirmed.
  </p>

  <p>
    <strong>Date:</strong>
    ${new Date(booking.show.showDateTime).toLocaleDateString("en-US", {
      timeZone: "Asia/Kolkata",
    })}
    <br />

    <strong>Time:</strong>
    ${new Date(booking.show.showDateTime).toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
    })}
  </p>

  <p>Enjoy the show! 🍿</p>

  <p>
    Thanks for booking with us!
    <br />
    — QuickShow Team
  </p>
</div>`,
      });
    });
  }
);

//inngest function to send reminders
const sendShowReminders = inngest.createFunction(
  {
    id: "send-show-reminders",
    triggers: {
      cron: "TZ=Asia/Kolkata */10 * * * *",
    },
  },

  async ({ step }) => {
    const reminderTasks = await step.run(
      "prepare-reminder-tasks",
      async () => {
        const now = new Date();

        // Shows starting between 8 hours and 8 hours 10 minutes from now
        const windowStart = new Date(
          now.getTime() + 8 * 60 * 60 * 1000
        );

        const windowEnd = new Date(
          windowStart.getTime() + 10 * 60 * 1000
        );

        const shows = await Show.find({
          showDateTime: {
            $gte: windowStart,
            $lt: windowEnd,
          },
        }).populate("movie");

        const tasks = [];

        for (const show of shows) {
          if (!show.movie || !show.occupiedSeats) {
            continue;
          }

          const userIds = [
            ...new Set(Object.values(show.occupiedSeats)),
          ];

          if (userIds.length === 0) {
            continue;
          }

          const users = await User.find({
            _id: { $in: userIds },
          }).select("name email");

          for (const user of users) {
            if (!user.email) {
              continue;
            }

            tasks.push({
              userEmail: user.email,
              userName: user.name,
              movieTitle: show.movie.title,

              // Your schema uses showDateTime
              showDateTime: show.showDateTime,
            });
          }
        }

        return tasks;
      }
    );

    if (reminderTasks.length === 0) {
      return {
        sent: 0,
        failed: 0,
        message: "No reminders to send.",
      };
    }

    const results = await step.run(
      "send-all-reminders",
      async () => {
        const emailResults = await Promise.allSettled(
          reminderTasks.map((task) =>
            sendEmail({
              to: task.userEmail,

              subject: `Reminder: Your movie "${task.movieTitle}" starts soon!`,

              body: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                  <h2>Hello ${task.userName},</h2>

                  <p>This is a quick reminder that your movie:</p>

                  <h3 style="color: #F84565;">
                    "${task.movieTitle}"
                  </h3>

                  <p>
                    is scheduled for
                    <strong>
                      ${new Date(
                        task.showDateTime
                      ).toLocaleDateString("en-US", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </strong>
                    at
                    <strong>
                      ${new Date(
                        task.showDateTime
                      ).toLocaleTimeString("en-US", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </strong>.
                  </p>

                  <p>
                    It starts in approximately
                    <strong>8 hours</strong>.
                    Make sure you are ready!
                  </p>

                  <br />

                  <p>
                    Enjoy the show!
                    <br />
                    QuickShow Team
                  </p>
                </div>
              `,
            })
          )
        );

        return emailResults.map((result) => result.status);
      }
    );

    const sent = results.filter(
      (status) => status === "fulfilled"
    ).length;

    const failed = results.length - sent;

    return {
      sent,
      failed,
      message: `Sent ${sent} reminder(s), ${failed} failed.`,
    };
  }
);


//function to send notification when a new show is added
const sendNewShowNotifications = inngest.createFunction(
  {
    id: "send-new-show-notifications",
    triggers: {
      event: "app/show.added",
    },
  },

  async ({ event, step }) => {
    const { movieTitle } = event.data;

    const users = await step.run("get-users", async () => {
      return await User.find({
        email: {
          $exists: true,
          $ne: "",
        },
      })
        .select("name email")
        .lean();
    });

    const result = await step.run(
      "send-new-show-notifications",
      async () => {
        let sent = 0;
        let failed = 0;

        for (const user of users) {
          try {
            await sendEmail({
              to: user.email,

              subject: `New Show Added: ${movieTitle}`,

              body: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                  <h2>Hi ${user.name},</h2>

                  <p>
                    We have just added a new show to our library:
                  </p>

                  <h3 style="color: #F84565;">
                    "${movieTitle}"
                  </h3>

                  <p>Visit our website to check the available shows.</p>

                  <br />

                  <p>
                    Thanks,
                    <br />
                    QuickShow Team
                  </p>
                </div>
              `,
            });

            sent++;
          } catch (error) {
            console.error(
              `Failed to send email to ${user.email}:`,
              error
            );

            failed++;
          }
        }

        return { sent, failed };
      }
    );

    return {
      message: `Sent ${result.sent} notification(s), ${result.failed} failed.`,
    };
  }
);

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  releaseSeatsAndDeleteBooking,
  sendBookingConfirmationEmail,
  sendShowReminders,
  sendNewShowNotifications,
];
