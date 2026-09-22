import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import jsPDF from "jspdf";

const TicketDownload = ({ booking, onClose }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  const movie = booking?.show?.movie;
  const showDateTime = booking?.show?.showDateTime;

  const currency = import.meta.env.VITE_CURRENCY || "$";

  const frontendUrl = window.location.origin;
  const ticketVerifyUrl = `${frontendUrl}/verify-ticket/${booking?.ticketCode}`;

  const generateQRCode = async () => {
    try {
      const qrImage = await QRCode.toDataURL(ticketVerifyUrl, {
        width: 220,
        margin: 2,
      });

      setQrCodeUrl(qrImage);
    } catch (error) {
      console.log("QR Code generation error:", error);
    }
  };

  const downloadTicket = async () => {
    try {
      if (!booking || !qrCodeUrl) return;

      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();

      const movieTitle = movie?.title || "Movie Ticket";
      const seats = booking.bookedSeats?.join(", ") || "N/A";

      const date = showDateTime
        ? new Date(showDateTime).toLocaleDateString("en-US", {
            timeZone: "Asia/Kolkata",
          })
        : "N/A";

      const time = showDateTime
        ? new Date(showDateTime).toLocaleTimeString("en-US", {
            timeZone: "Asia/Kolkata",
          })
        : "N/A";

      // Background
      pdf.setFillColor(17, 24, 39);
      pdf.rect(0, 0, 210, 297, "F");

      // Main ticket box
      pdf.setFillColor(31, 41, 55);
      pdf.roundedRect(15, 20, 180, 220, 4, 4, "F");

      // Header
      pdf.setFillColor(248, 69, 101);
      pdf.roundedRect(15, 20, 180, 30, 4, 4, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text("QuickShow Movie Ticket", pageWidth / 2, 38, {
        align: "center",
      });

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text("Payment Confirmed", pageWidth / 2, 46, {
        align: "center",
      });

      // Movie title
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");

      const splitTitle = pdf.splitTextToSize(movieTitle, 160);
      pdf.text(splitTitle, 25, 70);

      let y = 88;

      const addInfo = (label, value) => {
        pdf.setFontSize(12);
        pdf.setTextColor(180, 180, 180);
        pdf.setFont("helvetica", "bold");
        pdf.text(`${label}:`, 25, y);

        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "normal");
        pdf.text(String(value), 70, y);

        y += 10;
      };

      addInfo("Ticket Code", booking.ticketCode);
      addInfo("Seats", seats);
      addInfo("Amount", `${currency}${booking.amount}`);
      addInfo("Payment", booking.isPaid ? "Paid" : "Unpaid");
      addInfo("Date", date);
      addInfo("Time", time);

      // QR code
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(70, y + 5, 70, 70, 3, 3, "F");
      pdf.addImage(qrCodeUrl, "PNG", 75, y + 10, 60, 60);

      y += 90;

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Scan QR to verify ticket", pageWidth / 2, y, {
        align: "center",
      });

      y += 8;

      pdf.setTextColor(180, 180, 180);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");

      const splitUrl = pdf.splitTextToSize(ticketVerifyUrl, 150);
      pdf.text(splitUrl, pageWidth / 2, y, {
        align: "center",
      });

      // Footer
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(9);
      pdf.text(
        "This ticket is valid only after successful payment verification.",
        pageWidth / 2,
        230,
        { align: "center" },
      );

      pdf.save(`QuickShow-Ticket-${booking.ticketCode}.pdf`);
    } catch (error) {
      console.log("Ticket download error:", error);
    }
  };

  useEffect(() => {
    if (booking?.ticketCode) {
      generateQRCode();
    }
  }, [booking?.ticketCode]);

  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-4">
      {/* Modal */}
      <div
        className="
        w-full
        max-w-3xl
        max-h-[calc(100dvh-24px)]
        sm:max-h-[calc(100dvh-32px)]
        bg-gray-950
        border
        border-primary/30
        rounded-xl
        overflow-hidden
        flex
        flex-col
      "
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800">
          <h2 className="text-lg sm:text-xl font-semibold text-white">
            QuickShow Ticket
          </h2>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* Scrollable ticket content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            {/* Ticket Header */}
            <div className="bg-primary text-white text-center px-4 py-4 sm:py-5">
              <h1 className="text-xl sm:text-2xl font-bold">
                QuickShow Movie Ticket
              </h1>

              <p className="text-xs sm:text-sm mt-1">Payment Confirmed</p>
            </div>

            {/* Ticket Main Content */}
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
              {/* Poster */}
              <div className="md:col-span-1 flex justify-center md:block">
                {movie?.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                    alt={movie?.title}
                    className="
                    w-36
                    sm:w-44
                    md:w-full
                    max-w-60
                    rounded-lg
                    object-cover
                  "
                  />
                ) : (
                  <div className="w-36 sm:w-44 md:w-full h-52 sm:h-64 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400">
                    No Poster
                  </div>
                )}
              </div>

              {/* Ticket Information */}
              <div className="md:col-span-2 text-gray-300 min-w-0">
                <h3 className="text-xl sm:text-2xl font-semibold text-white mb-4 text-center md:text-left">
                  {movie?.title}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <p className="break-words">
                    <span className="text-gray-100 font-medium">
                      Ticket Code:
                    </span>{" "}
                    {booking.ticketCode}
                  </p>

                  <p>
                    <span className="text-gray-100 font-medium">
                      Payment Status:
                    </span>{" "}
                    {booking.isPaid ? "Paid" : "Unpaid"}
                  </p>

                  <p>
                    <span className="text-gray-100 font-medium">Seats:</span>{" "}
                    {booking.bookedSeats?.join(", ")}
                  </p>

                  <p>
                    <span className="text-gray-100 font-medium">Amount:</span>{" "}
                    {currency}
                    {booking.amount}
                  </p>

                  {showDateTime && (
                    <>
                      <p>
                        <span className="text-gray-100 font-medium">Date:</span>{" "}
                        {new Date(showDateTime).toLocaleDateString("en-US", {
                          timeZone: "Asia/Kolkata",
                        })}
                      </p>

                      <p>
                        <span className="text-gray-100 font-medium">Time:</span>{" "}
                        {new Date(showDateTime).toLocaleTimeString("en-US", {
                          timeZone: "Asia/Kolkata",
                        })}
                      </p>
                    </>
                  )}
                </div>

                {/* QR Section */}
                <div className="mt-6 flex flex-col sm:flex-row gap-4 sm:gap-5 items-center sm:items-start">
                  {qrCodeUrl && (
                    <div className="bg-white p-2 sm:p-3 rounded-lg shrink-0">
                      <img
                        src={qrCodeUrl}
                        alt="Ticket QR Code"
                        className="w-28 h-28 sm:w-36 sm:h-36"
                      />
                    </div>
                  )}

                  <div className="min-w-0 text-center sm:text-left">
                    <p className="text-gray-100 font-medium mb-2">
                      Scan QR to verify ticket
                    </p>

                    <p className="text-xs text-gray-400 break-all">
                      {ticketVerifyUrl}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ticket Footer */}
            <div className="px-4 sm:px-6 py-4 bg-gray-950 border-t border-gray-800 text-center">
              <p className="text-xs text-gray-400">
                This ticket is valid only after successful payment verification.
              </p>
            </div>
          </div>
        </div>

        {/* Always-visible Actions */}
        <div className="shrink-0 border-t border-gray-800 bg-gray-950 p-3 sm:p-4">
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="
                w-full
                sm:w-auto
                px-5
                py-2.5
                rounded-md
                bg-gray-800
                text-gray-300
                hover:bg-gray-700
                transition
                cursor-pointer
              "
              >
                Close
              </button>
            )}

            <button
              type="button"
              onClick={downloadTicket}
              disabled={!qrCodeUrl}
              className="
              w-full
              sm:w-auto
              px-5
              py-2.5
              rounded-md
              bg-primary
              text-white
              hover:bg-primary/80
              transition
              cursor-pointer
              disabled:opacity-50
              disabled:cursor-not-allowed
            "
            >
              Download Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDownload;
