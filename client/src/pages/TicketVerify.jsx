import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { SignInButton, useUser } from "@clerk/react";

const TicketVerify = () => {
  const { ticketCode } = useParams();
  const { axios, getToken } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [ticketData, setTicketData] = useState(null);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [validating, setValidating] = useState(false);
  const { isSignedIn, user } = useUser();

  const verifyTicket = async () => {
    try {
      setLoading(true);

      const { data } = await axios.get(
        `/api/booking/verify-ticket/${ticketCode}`,
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
  const checkAdmin = async () => {
    try {
      const { data } = await axios.get("/api/user/check-admin", {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      if (data.success) {
        setIsAdmin(data.isAdmin);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.log(error);
      setIsAdmin(false);
    }
  };
  const handleValidateTicket = async () => {
    try {
      setValidating(true);

      const { data } = await axios.post(
        `/api/booking/validate-ticket/${ticketCode}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        },
      );

      if (data.success && data.valid) {
        setMessage(data.message);

        setTicketData((prev) => ({
          ...prev,
          isTicketUsed: true,
        }));
      } else {
        setMessage(data.message || "Ticket validation failed.");
      }
    } catch (error) {
      console.log(error);

      setMessage(error.response?.data?.message || "Unable to validate ticket.");
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if (ticketCode) {
      verifyTicket();
    }
  }, [ticketCode]);

  useEffect(() => {
    if (isSignedIn && user) {
      checkAdmin();
    } else {
      setIsAdmin(false);
    }
  }, [isSignedIn, user]);

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
            Please check whether the ticket code is correct or the payment is
            completed.
          </p>
        </div>
      </div>
    );
  }

  const movie = ticketData.show?.movie;
  const showDateTime = ticketData.show?.showDateTime;

  return (
    <div className="min-h-[100dvh] bg-primary/5 px-3 sm:px-4 py-6 sm:py-10 flex items-start md:items-center justify-center overflow-x-hidden">
      <div className="w-full max-w-2xl bg-gray-900 border border-green-500/30 rounded-xl overflow-hidden">
        {/* Valid Ticket Header */}
        <div className="bg-green-600 text-white text-center px-4 py-4">
          <h1 className="text-xl sm:text-2xl font-semibold">Valid Ticket</h1>

          <p className="text-xs sm:text-sm mt-1">
            This ticket is successfully verified.
          </p>
        </div>

        {/* Ticket Content */}
        <div className="p-4 sm:p-6">
          <div className="flex flex-col md:flex-row gap-5 sm:gap-6">
            {/* Movie Poster */}
            {movie?.poster_path && (
              <div className="flex justify-center md:block shrink-0">
                <img
                  src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                  alt={movie.title}
                  className="
                  w-32
                  sm:w-40
                  md:w-40
                  max-h-60
                  md:max-h-none
                  rounded-lg
                  object-cover
                "
                />
              </div>
            )}

            {/* Ticket Information */}
            <div className="flex-1 min-w-0 text-gray-300">
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 text-center md:text-left">
                {movie?.title}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 text-sm">
                <p className="break-words">
                  <span className="font-medium text-gray-100">
                    Ticket Code:
                  </span>{" "}
                  {ticketData.ticketCode}
                </p>

                <p>
                  <span className="font-medium text-gray-100">Seats:</span>{" "}
                  {ticketData.bookedSeats?.join(", ")}
                </p>

                <p>
                  <span className="font-medium text-gray-100">Amount:</span> $
                  {ticketData.amount}
                </p>

                <p>
                  <span className="font-medium text-gray-100">
                    Payment Status:
                  </span>{" "}
                  {ticketData.isPaid ? "Paid" : "Unpaid"}
                </p>

                {showDateTime && (
                  <>
                    <p>
                      <span className="font-medium text-gray-100">Date:</span>{" "}
                      {new Date(showDateTime).toLocaleDateString("en-US", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </p>

                    <p>
                      <span className="font-medium text-gray-100">Time:</span>{" "}
                      {new Date(showDateTime).toLocaleTimeString("en-US", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </p>
                  </>
                )}

                <p className="break-words">
                  <span className="font-medium text-gray-100">Customer:</span>{" "}
                  {ticketData.user?.name || "N/A"}
                </p>

                <p className="break-all">
                  <span className="font-medium text-gray-100">Email:</span>{" "}
                  {ticketData.user?.email || "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Verification Message */}
          <div className="mt-5 sm:mt-6 bg-green-500/10 border border-green-500/30 rounded-lg p-3 sm:p-4 text-center">
            <p className="text-green-400 text-sm sm:text-base font-medium">
              {message}
            </p>
          </div>
        </div>

        {/* Validation Action Section */}
        <div className="border-t border-gray-800 bg-gray-950 p-4 sm:p-5">
          <div className="w-full flex flex-col items-center gap-3">
            {/* Staff is not logged in */}
            {!isSignedIn && (
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="
                  w-full
                  sm:w-auto
                  bg-primary
                  hover:bg-primary/80
                  px-6
                  py-3
                  rounded-lg
                  text-sm
                  font-medium
                  cursor-pointer
                  transition
                "
                >
                  Staff Sign In to Validate
                </button>
              </SignInButton>
            )}

            {/* Logged in but not admin */}
            {isSignedIn && !isAdmin && (
              <p className="text-gray-400 text-sm text-center px-2">
                Staff authorization is required to validate this ticket.
              </p>
            )}

            {/* Admin can validate unused ticket */}
            {isSignedIn && isAdmin && !ticketData.isTicketUsed && (
              <button
                type="button"
                onClick={handleValidateTicket}
                disabled={validating}
                className="
                w-full
                sm:w-auto
                bg-primary
                hover:bg-primary/80
                px-8
                py-3
                rounded-lg
                text-sm
                font-medium
                cursor-pointer
                transition
                disabled:opacity-50
                disabled:cursor-not-allowed
              "
              >
                {validating ? "Validating..." : "Validate Entry"}
              </button>
            )}

            {/* Ticket already used */}
            {ticketData.isTicketUsed && (
              <div className="w-full bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-center">
                <p className="text-red-400 font-medium">Ticket Already Used</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketVerify;
