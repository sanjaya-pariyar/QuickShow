import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, ref: "User" },
    show: { type: String, required: true, ref: "Show" },
    amount: { type: Number, required: true },
    currency: {
      type: String,
      default: "NPR",
    },

    paymentMethod: {
      type: String,
      enum: ["stripe", "esewa"],
    },

    paymentAmount: {
      type: Number,
    },

    paymentCurrency: {
      type: String,
    },
    bookedSeats: { type: Array, required: true },
    isPaid: { type: Boolean, default: false },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "expired"],
      default: "pending",
    },
    reservationExpiresAt: {
      type: Date,
      required: true,
    },
    paymentLink: { type: String },
    ticketCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    isTicketUsed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
