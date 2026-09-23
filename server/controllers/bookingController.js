// function to check availability of selected seats for a movie

import Show from "../models/Show.js";
import Booking from "../models/Booking.js";
import stripe from "stripe";
import { inngest } from "../inngest/index.js";
import crypto from "crypto";
import { clerkClient } from "@clerk/express";

//  function to generate unique ticket code
const generateTicketCode = async () => {
  let ticketCode;
  let existingTicket;

  do {
    ticketCode = `QS-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    existingTicket = await Booking.findOne({ ticketCode });
  } while (existingTicket);

  return ticketCode;
};

const generateEsewaSignature = (totalAmount, transactionUuid) => {
  const productCode = process.env.ESEWA_PRODUCT_CODE;

  const secretKey = process.env.ESEWA_SECRET_KEY;

  const message =
    `total_amount=${totalAmount},` +
    `transaction_uuid=${transactionUuid},` +
    `product_code=${productCode}`;

  return crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("base64");
};

const verifyEsewaResponseSignature = (responseData) => {
  try {
    const signedFields = responseData.signed_field_names?.split(",");

    if (!signedFields || !responseData.signature) {
      return false;
    }

    const message = signedFields
      .map((field) => `${field}=${responseData[field]}`)
      .join(",");

    const expectedSignature = crypto
      .createHmac("sha256", process.env.ESEWA_SECRET_KEY)
      .update(message)
      .digest("base64");

    const expectedBuffer = Buffer.from(expectedSignature);

    const receivedBuffer = Buffer.from(responseData.signature);

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (error) {
    console.log("eSewa signature verification error:", error.message);

    return false;
  }
};
export const verifyEsewaPayment = async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.json({
        success: false,
        message: "eSewa payment data is required",
      });
    }

    // Decode Base64 response from eSewa
    let responseData;

    try {
      const decodedString = Buffer.from(data, "base64").toString("utf8");

      responseData = JSON.parse(decodedString);
    } catch (error) {
      return res.json({
        success: false,
        message: "Invalid eSewa payment response",
      });
    }

    // Verify response signature
    const isSignatureValid = verifyEsewaResponseSignature(responseData);

    if (!isSignatureValid) {
      return res.json({
        success: false,
        message: "Invalid eSewa payment signature",
      });
    }

    const { status, total_amount, transaction_uuid, product_code } =
      responseData;

    // eSewa response itself must report COMPLETE
    if (status !== "COMPLETE") {
      return res.json({
        success: false,
        message: `eSewa payment status: ${status}`,
      });
    }

    // Verify merchant/product code
    if (product_code !== process.env.ESEWA_PRODUCT_CODE) {
      return res.json({
        success: false,
        message: "Invalid eSewa product code",
      });
    }

    // Find QuickShow booking
    const booking = await Booking.findOne({
      paymentReference: transaction_uuid,
    });

    if (!booking) {
      return res.json({
        success: false,
        message: "Booking not found",
      });
    }

    // Must actually be an eSewa booking
    if (booking.paymentMethod !== "esewa") {
      return res.json({
        success: false,
        message: "Invalid payment method",
      });
    }

    // Amount must match our booking
    if (Number(total_amount) !== Number(booking.paymentAmount)) {
      return res.json({
        success: false,
        message: "Payment amount does not match booking amount",
      });
    }

    // Avoid processing the same payment twice
    if (booking.isPaid || booking.paymentStatus === "paid") {
      return res.json({
        success: true,
        message: "Payment already verified",
        bookingId: booking._id,
      });
    }

    // Do not apply payment to an expired reservation
    if (
      booking.paymentStatus === "expired" ||
      !booking.reservationExpiresAt ||
      new Date() >= new Date(booking.reservationExpiresAt)
    ) {
      return res.json({
        success: false,
        message:
          "Reservation has expired. This payment can no longer be applied to the booking.",
      });
    }

    // Verify transaction directly with eSewa
    const statusUrl = new URL(process.env.ESEWA_STATUS_URL);

    statusUrl.searchParams.set("product_code", process.env.ESEWA_PRODUCT_CODE);

    statusUrl.searchParams.set("total_amount", String(booking.paymentAmount));

    statusUrl.searchParams.set("transaction_uuid", transaction_uuid);

    const statusResponse = await fetch(statusUrl.toString());

    if (!statusResponse.ok) {
      throw new Error("Unable to verify transaction with eSewa");
    }

    const verificationData = await statusResponse.json();

    if (verificationData.status !== "COMPLETE") {
      return res.json({
        success: false,
        message: "eSewa transaction could not be verified",
      });
    }

    // Extra amount verification if returned by eSewa
    const verifiedAmount =
      verificationData.total_amount ?? verificationData.totalAmount;

    if (
      verifiedAmount !== undefined &&
      Number(verifiedAmount) !== Number(booking.paymentAmount)
    ) {
      return res.json({
        success: false,
        message: "Verified eSewa amount does not match booking amount",
      });
    }

    // Payment is now trusted
    // Atomically mark payment as paid only if reservation is still active
    const paidBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,

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
      return res.json({
        success: false,
        message: "Reservation expired before payment could be confirmed.",
      });
    }

    // Use same post-payment workflow as Stripe
    await inngest.send({
      name: "app/show.booked",
      data: {
        bookingId: booking._id.toString(),
      },
    });

    return res.json({
      success: true,
      message: "eSewa payment verified successfully",
      bookingId: booking._id,
    });
  } catch (error) {
    console.log("eSewa verification error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const checkSeatsAvailability = async (showId, selectedSeats) => {
  try {
    const showData = await Show.findById(showId);

    if (!showData) return false;

    const occupiedSeats = showData.occupiedSeats || {};

    const isAnySeatTaken = selectedSeats.some((seat) => occupiedSeats[seat]);

    return !isAnySeatTaken;
  } catch (error) {
    console.log(error.message);
    return false;
  }
};

const reserveSeatsAtomically = async (showId, selectedSeats, userId) => {
  const seatConditions = {};

  const seatUpdates = {};

  selectedSeats.forEach((seat) => {
    seatConditions[`occupiedSeats.${seat}`] = {
      $exists: false,
    };

    seatUpdates[`occupiedSeats.${seat}`] = userId;
  });

  const updatedShow = await Show.findOneAndUpdate(
    {
      _id: showId,
      ...seatConditions,
    },
    {
      $set: seatUpdates,
    },
    {
      new: true,
    },
  );

  return updatedShow;
};

const releaseReservedSeats = async (showId, selectedSeats, userId) => {
  const seatConditions = {};
  const unsetUpdates = {};

  selectedSeats.forEach((seat) => {
    seatConditions[`occupiedSeats.${seat}`] = userId;
    unsetUpdates[`occupiedSeats.${seat}`] = "";
  });

  return await Show.findOneAndUpdate(
    {
      _id: showId,
      ...seatConditions,
    },
    {
      $unset: unsetUpdates,
    },
    {
      new: true,
    },
  );
};

export const createBooking = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { showId, selectedSeats, paymentMethod = "stripe" } = req.body;
    const { origin } = req.headers;

    if (!["stripe", "esewa"].includes(paymentMethod)) {
      return res.json({
        success: false,
        message: "Invalid payment method",
      });
    }

    if (!userId) {
      return res.json({
        success: false,
        message: "Please login to proceed",
      });
    }

    if (!showId || !selectedSeats || selectedSeats.length === 0) {
      return res.json({
        success: false,
        message: "Please select a show and seats",
      });
    }

    // check if the seats are available for the selected show

    // get the show details
    const showData = await Show.findById(showId).populate("movie");

    console.log("BOOKING DEBUG");
    console.log("Show ID:", showId);
    console.log("Movie:", showData.movie.title);
    console.log("Current DB price:", showData.showPrice);
    if (!showData) {
      return res.json({
        success: false,
        message: "Show not found",
      });
    }

    const reservedShow = await reserveSeatsAtomically(
      showId,
      selectedSeats,
      userId,
    );

    if (!reservedShow) {
      return res.json({
        success: false,
        message: "One or more selected seats are no longer available",
      });
    }

    //  generate unique ticket code for this booking
    const ticketCode = await generateTicketCode();

    const amount = showData.showPrice * selectedSeats.length;

    const reservationExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    // create a new booking
    const booking = await Booking.create({
      user: userId,
      show: showId,

      amount,
      currency: "NPR",

      paymentMethod,
      paymentAmount: amount,
      paymentCurrency: "NPR",

      bookedSeats: selectedSeats,

      isPaid: false,

      // Initial payment state
      paymentStatus: "pending",

      reservationExpiresAt,

      // Save ticket code for QR verification
      ticketCode: ticketCode,
      isTicketUsed: false,
    });

    // Stripe payment initialize can be added here later
    // Handle Stripe payment
    if (paymentMethod === "stripe") {
      try {
        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

        const line_items = [
          {
            price_data: {
              currency: "npr",
              product_data: {
                name: showData.movie.title,
              },
              unit_amount: Math.round(booking.amount * 100),
            },
            quantity: 1,
          },
        ];

        const session = await stripeInstance.checkout.sessions.create({
          success_url: `${origin}/loading/my-bookings`,

          cancel_url: `${origin}/my-bookings`,

          line_items,
          mode: "payment",

          metadata: {
            bookingId: booking._id.toString(),
            ticketCode: booking.ticketCode,
          },

          expires_at: Math.floor(reservationExpiresAt.getTime() / 1000),
        });

        booking.paymentLink = session.url;
        booking.paymentReference = session.id;
        await booking.save();

        await inngest.send({
          name: "app/checkpayment",
          data: {
            bookingId: booking._id.toString(),
          },
        });

        return res.json({
          success: true,
          paymentMethod: "stripe",
          url: session.url,
          booking,
        });
      } catch (paymentError) {
        // Safely release only this user's reserved seats
        await releaseReservedSeats(showId, selectedSeats, userId);

        // Remove failed booking
        await Booking.findByIdAndDelete(booking._id);

        throw paymentError;
      }
    }
    // eSewa payment will be implemented next
    if (paymentMethod === "esewa") {
      const transactionUuid = `${booking._id.toString()}-${Date.now()}`;

      const totalAmount = String(booking.amount);

      const signature = generateEsewaSignature(totalAmount, transactionUuid);

      booking.paymentReference = transactionUuid;

      await booking.save();

      const esewaPaymentData = {
        amount: totalAmount,
        tax_amount: "0",
        total_amount: totalAmount,

        transaction_uuid: transactionUuid,

        product_code: process.env.ESEWA_PRODUCT_CODE,

        product_service_charge: "0",
        product_delivery_charge: "0",

        success_url: `${origin}/esewa-success`,

        failure_url: `${origin}/my-bookings`,

        signed_field_names: "total_amount,transaction_uuid,product_code",

        signature,
      };

      await inngest.send({
        name: "app/checkpayment",
        data: {
          bookingId: booking._id.toString(),
        },
      });

      return res.json({
        success: true,

        paymentMethod: "esewa",

        paymentUrl: process.env.ESEWA_PAYMENT_URL,

        paymentData: esewaPaymentData,

        booking,
      });
    }
  } catch (error) {
    console.log(error.message);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const getOccupiedSeats = async (req, res) => {
  try {
    const { showId } = req.params;

    const showData = await Show.findById(showId);

    if (!showData) {
      return res.json({
        success: false,
        message: "Show not found",
      });
    }

    const occupiedSeats = Object.keys(showData.occupiedSeats || {});

    res.json({
      success: true,
      occupiedSeats,
    });
  } catch (error) {
    console.log(error.message);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

// QR CODE ADDITION: verify ticket using ticketCode from QR scan
export const verifyTicket = async (req, res) => {
  try {
    const { ticketCode } = req.params;

    if (!ticketCode) {
      return res.json({
        success: false,
        valid: false,
        message: "Ticket code is required",
      });
    }

    const booking = await Booking.findOne({ ticketCode })
      .populate({
        path: "show",
        populate: {
          path: "movie",
          model: "Movie",
        },
      })
      .populate("user");

    if (!booking) {
      return res.json({
        success: false,
        valid: false,
        message: "Invalid ticket. Booking not found.",
      });
    }

    if (!booking.isPaid) {
      return res.json({
        success: true,
        valid: false,
        message: "Ticket is not valid because payment is not completed.",
        booking: {
          ticketCode: booking.ticketCode,
          isPaid: booking.isPaid,
        },
      });
    }

    // Check if ticket has already been used
    if (booking.isTicketUsed) {
      return res.json({
        success: true,
        valid: false,
        used: true,
        message: "This ticket has already been used.",
        booking: {
          ticketCode: booking.ticketCode,
          isPaid: booking.isPaid,
          isTicketUsed: booking.isTicketUsed,
        },
      });
    }

    if (!booking.show || !booking.show.movie) {
      return res.json({
        success: false,
        valid: false,
        message: "Invalid ticket. Show or movie details not found.",
      });
    }

    res.json({
      success: true,
      valid: true,
      message: "Ticket is valid.",
      booking: {
        ticketCode: booking.ticketCode,
        isPaid: booking.isPaid,
        isTicketUsed: booking.isTicketUsed,
        bookedSeats: booking.bookedSeats,
        amount: booking.amount,
        createdAt: booking.createdAt,
        user: {
          name: booking.user?.name,
          email: booking.user?.email,
        },
        show: {
          showDateTime: booking.show.showDateTime,
          showPrice: booking.show.showPrice,
          movie: {
            title: booking.show.movie.title,
            poster_path: booking.show.movie.poster_path,
            backdrop_path: booking.show.movie.backdrop_path,
            runtime: booking.show.movie.runtime,
          },
        },
      },
    });
  } catch (error) {
    console.log(error.message);

    res.json({
      success: false,
      valid: false,
      message: error.message,
    });
  }
};

export const validateTicket = async (req, res) => {
  try {
    const { ticketCode } = req.params;
    const { userId } = req.auth();

    if (!userId) {
      return res.status(401).json({
        success: false,
        valid: false,
        message: "Authentication required",
      });
    }

    const currentUser = await clerkClient.users.getUser(userId);

    const role = currentUser.privateMetadata?.role;

    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        valid: false,
        message: "Only authorised staff can validate tickets",
      });
    }

    if (!ticketCode) {
      return res.json({
        success: false,
        valid: false,
        message: "Ticket code is required",
      });
    }

    const booking = await Booking.findOne({
      ticketCode,
    })
      .populate({
        path: "show",
        populate: {
          path: "movie",
          model: "Movie",
        },
      })
      .populate("user");

    if (!booking) {
      return res.json({
        success: false,
        valid: false,
        message: "Invalid ticket. Booking not found.",
      });
    }

    if (!booking.isPaid || booking.paymentStatus !== "paid") {
      return res.json({
        success: true,
        valid: false,
        message: "Ticket cannot be validated because payment is not completed.",
      });
    }

    if (booking.isTicketUsed) {
      return res.json({
        success: true,
        valid: false,
        used: true,
        message: "This ticket has already been used.",
      });
    }

    booking.isTicketUsed = true;

    await booking.save();

    return res.json({
      success: true,
      valid: true,
      used: true,
      message: "Ticket validated successfully. Entry permitted.",
      booking: {
        ticketCode: booking.ticketCode,
        isPaid: booking.isPaid,
        paymentStatus: booking.paymentStatus,
        isTicketUsed: booking.isTicketUsed,
        bookedSeats: booking.bookedSeats,
        amount: booking.amount,
        user: {
          name: booking.user?.name,
          email: booking.user?.email,
        },
        show: {
          showDateTime: booking.show?.showDateTime,
          movie: {
            title: booking.show?.movie?.title,
          },
        },
      },
    });
  } catch (error) {
    console.log(error.message);

    return res.json({
      success: false,
      valid: false,
      message: error.message,
    });
  }
};

export const retryPayment = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { bookingId } = req.params;

    if (!userId) {
      return res.json({
        success: false,
        message: "Please login to continue",
      });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.json({
        success: false,
        message: "Booking not found",
      });
    }

    // Only owner can retry payment
    if (booking.user !== userId) {
      return res.json({
        success: false,
        message: "You are not allowed to access this booking",
      });
    }

    // Already completed
    if (booking.isPaid || booking.paymentStatus === "paid") {
      return res.json({
        success: false,
        message: "This booking has already been paid",
      });
    }

    // Reservation already expired
    if (
      booking.paymentStatus === "expired" ||
      !booking.reservationExpiresAt ||
      new Date() >= new Date(booking.reservationExpiresAt)
    ) {
      return res.json({
        success: false,
        message: "Reservation has expired. Please select your seats again.",
      });
    }

    // Only pending or failed payments can retry
    if (
      booking.paymentStatus !== "pending" &&
      booking.paymentStatus !== "failed"
    ) {
      return res.json({
        success: false,
        message: "Payment cannot be retried for this booking",
      });
    }
    // Retry Stripe payment
    if (booking.paymentMethod === "stripe") {
      if (!booking.paymentLink) {
        return res.json({
          success: false,
          message: "Stripe payment link is unavailable",
        });
      }

      if (booking.paymentStatus === "failed") {
        booking.paymentStatus = "pending";
        await booking.save();
      }

      return res.json({
        success: true,
        paymentMethod: "stripe",
        url: booking.paymentLink,
        reservationExpiresAt: booking.reservationExpiresAt,
        message: "Stripe payment retry available",
      });
    }

    // Retry eSewa payment
    if (booking.paymentMethod === "esewa") {
      const transactionUuid = `${booking._id.toString()}-${Date.now()}`;

      const totalAmount = String(booking.paymentAmount);

      const signature = generateEsewaSignature(totalAmount, transactionUuid);

      booking.paymentReference = transactionUuid;

      booking.paymentStatus = "pending";

      await booking.save();

      const esewaPaymentData = {
        amount: totalAmount,
        tax_amount: "0",
        total_amount: totalAmount,

        transaction_uuid: transactionUuid,

        product_code: process.env.ESEWA_PRODUCT_CODE,

        product_service_charge: "0",
        product_delivery_charge: "0",

        success_url: `${req.headers.origin}/esewa-success`,

        failure_url: `${req.headers.origin}/my-bookings`,

        signed_field_names: "total_amount,transaction_uuid,product_code",

        signature,
      };

      return res.json({
        success: true,
        paymentMethod: "esewa",

        paymentUrl: process.env.ESEWA_PAYMENT_URL,

        paymentData: esewaPaymentData,

        reservationExpiresAt: booking.reservationExpiresAt,

        message: "eSewa payment retry available",
      });
    }

    // Safety fallback
    return res.json({
      success: false,
      message: "Unsupported payment method",
    });
  } catch (error) {
    console.log(error.message);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};
