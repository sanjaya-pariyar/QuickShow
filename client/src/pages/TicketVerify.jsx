import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const TicketVerify = () => {
  const { ticketCode } = useParams();
  const { axios } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [ticketData, setTicketData] = useState(null);
  const [message, setMessage] = useState("");

  const verifyTicket = async () => {
    try {
      setLoading(true);

      const { data } = await axios.get(
        `/api/booking/verify-ticket/${ticketCode}`
      );

      if (data.success && data.valid) {
        setTicketData(data.booking);
        setMessage(data.message);
      } else {
        setTicketData(null);
        setMessage(data.message || "Invalid ticket");
      }
    } catch (error) {
      console.log(error);
      setTicketData(null);
      setMessage("Something went wrong while verifying the ticket.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketCode) {
      verifyTicket();
    }
  }, [ticketCode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary/5">
        <p className="text-lg text-gray-300">Verifying ticket...</p>
      </div>
    );
  }

  if (!ticketData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary/5 px-4">
        <div className="max-w-md w-full bg-gray-900 border border-red-500/30 rounded-xl p-6 text-center">
          <h1 className="text-2xl font-semibold text-red-500 mb-3">
            Invalid Ticket
          </h1>

          <p className="text-gray-300">{message}</p>

          <p className="text-sm text-gray-500 mt-4">
            Please check whether the ticket code is correct or the payment is completed.
          </p>
        </div>
      </div>
    );
  }

  const movie = ticketData.show?.movie;
  const showDateTime = ticketData.show?.showDateTime;

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary/5 px-4 py-10">
      <div className="max-w-2xl w-full bg-gray-900 border border-green-500/30 rounded-xl overflow-hidden">
        <div className="bg-green-600 text-white text-center py-4">
          <h1 className="text-2xl font-semibold">Valid Ticket</h1>
          <p className="text-sm mt-1">This ticket is successfully verified.</p>
        </div>

        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {movie?.poster_path && (
              <img
                src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                alt={movie.title}
                className="w-full md:w-40 rounded-lg object-cover"
              />
            )}

            <div className="flex-1 text-gray-300">
              <h2 className="text-xl font-semibold text-white mb-3">
                {movie?.title}
              </h2>

              <p className="mb-2">
                <span className="font-medium text-gray-100">Ticket Code:</span>{" "}
                {ticketData.ticketCode}
              </p>

              <p className="mb-2">
                <span className="font-medium text-gray-100">Seats:</span>{" "}
                {ticketData.bookedSeats?.join(", ")}
              </p>

              <p className="mb-2">
                <span className="font-medium text-gray-100">Amount:</span>{" "}
                ${ticketData.amount}
              </p>

              <p className="mb-2">
                <span className="font-medium text-gray-100">Payment Status:</span>{" "}
                {ticketData.isPaid ? "Paid" : "Unpaid"}
              </p>

              {showDateTime && (
                <>
                  <p className="mb-2">
                    <span className="font-medium text-gray-100">Date:</span>{" "}
                    {new Date(showDateTime).toLocaleDateString("en-US", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </p>

                  <p className="mb-2">
                    <span className="font-medium text-gray-100">Time:</span>{" "}
                    {new Date(showDateTime).toLocaleTimeString("en-US", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </p>
                </>
              )}

              <p className="mb-2">
                <span className="font-medium text-gray-100">Customer:</span>{" "}
                {ticketData.user?.name || "N/A"}
              </p>

              <p className="mb-2">
                <span className="font-medium text-gray-100">Email:</span>{" "}
                {ticketData.user?.email || "N/A"}
              </p>
            </div>
          </div>

          <div className="mt-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
            <p className="text-green-400 font-medium">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketVerify;