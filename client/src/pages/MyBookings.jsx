import { useEffect, useState } from "react";
import { dummyBookingData } from "../assets/assets";
import Loading from "../components/Loading";
import BlurCircle from "../components/BlurCircle";
import isoTimeFormat from "../lib/isoTimeFormat";
import timeFormat from "../lib/timeFormat";
import { dateFormat } from "../lib/dateFormat";
import React from "react";
import { useAppContext } from "../context/AppContext";

// STEP 9 ADDITION
import toast from "react-hot-toast";

// QR CODE ADDITION
import TicketDownload from "../components/TicketDownload";

const MyBookings = () => {
  const currency = import.meta.env.VITE_CURRENCY;

  const { axios, getToken, user, image_base_url } = useAppContext();

  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // QR CODE ADDITION
  const [selectedTicketBooking, setSelectedTicketBooking] = useState(null);

  const getMyBookings = async () => {
    try {
      const { data } = await axios.get("/api/user/bookings", {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });

      if (data.success) {
        setBookings(data.bookings);
      }
    } catch (error) {
      console.log(error);
    }

    setIsLoading(false);
  };

  // STEP 9 ADDITION:
  // check whether booking reservation is still active
  const isReservationActive = (booking) => {
    if (!booking.reservationExpiresAt) {
      return false;
    }

    return new Date(booking.reservationExpiresAt).getTime() > currentTime;
  };

  const getReservationTimeLeft = (booking) => {
    if (!booking.reservationExpiresAt) {
      return "00:00";
    }

    const expiryTime = new Date(booking.reservationExpiresAt).getTime();

    const remainingTime = expiryTime - currentTime;

    if (remainingTime <= 0) {
      return "00:00";
    }

    const totalSeconds = Math.floor(remainingTime / 1000);

    const minutes = Math.floor(totalSeconds / 60);

    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  // STEP 9 ADDITION:
  // retry payment for pending or failed booking
  const handleRetryPayment = async (bookingId) => {
    try {
      const { data } = await axios.post(
        `/api/booking/retry-payment/${bookingId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        },
      );

      if (data.success) {
        // redirect user to Stripe payment page
        window.location.href = data.url;
      } else {
        toast.error(data.message);

        // refresh booking status
        getMyBookings();
      }
    } catch (error) {
      console.log(error);

      toast.error(error.response?.data?.message || "Unable to retry payment");
    }
  };

  useEffect(() => {
    if (user) {
      getMyBookings();
    }
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return !isLoading ? (
    <div className="relative px-6 md:px-16 lg:px-40 pt-30 md:pt-40 min-h-[80vh]">
      <BlurCircle top="100px" left="100px" />

      <div>
        <BlurCircle bottom="0px" left="600px" />
      </div>

      <h1 className="text-lg font-semibold mb-4">My Bookings</h1>

      {bookings.map((item, index) => (
        <div
          key={index}
          className="flex flex-col md:flex-row justify-between bg-primary/8 border border-primary/20 rounded-lg mt-4 p-2 max-w-3xl"
        >
          <div className="flex flex-col md:flex-row">
            <img
              src={image_base_url + item.show.movie.poster_path}
              alt=""
              className="md:max-w-45 aspect-video h-auto object-cover object-bottom rounded"
            />

            <div className="flex flex-col p-4">
              <p className="text-lg font-semibold">{item.show.movie.title}</p>

              <p className="text-gray-400 text-sm">
                {timeFormat(item.show.movie.runtime)}
              </p>

              <p className="text-gray-400 text-sm mt-auto">
                {dateFormat(item.show.showDateTime)}
              </p>
            </div>
          </div>

          <div className="flex flex-col md:items-end md:text-right justify-between p-4">
            <div className="flex items-center gap-4">
              <p className="text-2xl font-semibold mb-3">
                {currency}
                {item.amount}
              </p>

              {/* STEP 9 CHANGE:
                  replaced old Pay Now link with controlled Retry Payment
              */}

              {!item.isPaid &&
                (item.paymentStatus === "pending" ||
                  item.paymentStatus === "failed") &&
                isReservationActive(item) && (
                  <button
                    onClick={() => handleRetryPayment(item._id)}
                    className="bg-primary px-4 py-1.5 mb-3 text-sm rounded-full font-medium cursor-pointer"
                  >
                    Retry Payment
                  </button>
                )}

              {/* QR CODE ADDITION */}
              {item.isPaid && item.ticketCode && (
                <button
                  onClick={() => setSelectedTicketBooking(item)}
                  className="bg-primary px-4 py-1.5 mb-3 text-sm rounded-full font-medium cursor-pointer"
                >
                  View Ticket
                </button>
              )}
            </div>

            <div className="text-sm">
              {/* STEP 9 ADDITION */}
              <p>
                <span className="text-gray-400">Payment Status:</span>{" "}
                <span className="capitalize">
                  {item.paymentStatus || (item.isPaid ? "paid" : "pending")}
                </span>
              </p>

              {/* STEP 10.5: Reservation countdown */}
              {!item.isPaid &&
                (item.paymentStatus === "pending" ||
                  item.paymentStatus === "failed") &&
                isReservationActive(item) && (
                  <p>
                    <span className="text-gray-400">
                      Reservation expires in:
                    </span>{" "}
                    <span className="font-medium">
                      {getReservationTimeLeft(item)}
                    </span>
                  </p>
                )}

              {/* STEP 9 ADDITION */}
              {!item.isPaid &&
                item.reservationExpiresAt &&
                !isReservationActive(item) && (
                  <p className="text-red-400">Reservation expired</p>
                )}

              <p>
                <span className="text-gray-400">Total Tickets:</span>
                {item.bookedSeats.length}
              </p>

              <p>
                <span className="text-gray-400">Seat Number:</span>
                {item.bookedSeats.join(", ")}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* QR CODE ADDITION */}
      {selectedTicketBooking && (
        <TicketDownload
          booking={selectedTicketBooking}
          onClose={() => setSelectedTicketBooking(null)}
        />
      )}
    </div>
  ) : (
    <Loading />
  );
};

export default MyBookings;
