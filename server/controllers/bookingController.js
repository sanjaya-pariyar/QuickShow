// function to check availability of selected seats for a movie

import Show from "../models/Show.js";
import Booking from "../models/Booking.js";
import stripe from 'stripe';
import { inngest } from "../inngest/index.js";
import crypto from "crypto";

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

export const createBooking = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { showId, selectedSeats } = req.body;
    const { origin } = req.headers;

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
    const isAvailable = await checkSeatsAvailability(showId, selectedSeats);

    if (!isAvailable) {
      return res.json({
        success: false,
        message: "Selected seats are not available",
      });
    }

    // get the show details
    const showData = await Show.findById(showId).populate("movie");

    if (!showData) {
      return res.json({
        success: false,
        message: "Show not found",
      });
    }

    //  generate unique ticket code for this booking
    const ticketCode = await generateTicketCode();

    // create a new booking
    const booking = await Booking.create({
      user: userId,
      show: showId,
      amount: showData.showPrice * selectedSeats.length,
      bookedSeats: selectedSeats,
      isPaid: false,

      //save ticket code for QR verification
      ticketCode: ticketCode,
      isTicketUsed: false,
    });

    // mark selected seats as occupied
    selectedSeats.forEach((seat) => {
      showData.occupiedSeats[seat] = userId;
    });

    showData.markModified("occupiedSeats");
    await showData.save();

    // Stripe payment initialize can be added here later
    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

    //creating line items from stripe
    const line_items = [{
      price_data: {
        currency: 'usd',
        product_data:{
          name: showData.movie.title
        },
        unit_amount: Math.floor(booking.amount) * 100
      },
      quantity: 1
    }]

    const session = await stripeInstance.checkout.sessions.create({
      success_url: `${origin}/loading/my-bookings`,
      cancel_url: `${origin}/my-bookings`,
      line_items: line_items,
      mode: 'payment',
      metadata: {
        bookingId: booking._id.toString(),

        // store ticket code in Stripe metadata also
        ticketCode: booking.ticketCode,
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60 //Expires in 30 minutes
    })


    booking.paymentLink = session.url
    await booking.save()

    //run inngest scheduler function to check payment after 10 minutes
    await inngest.send({
      name: "app/checkpayment",
      data: {
        bookingId: booking._id.toString()
      }
    })

    res.json({
      success: true,
      url: session.url,
      booking,
    });
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