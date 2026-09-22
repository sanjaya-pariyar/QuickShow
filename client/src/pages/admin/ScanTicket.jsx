import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { ScanLineIcon, SmartphoneIcon } from "lucide-react";

const ScanTicket = () => {
  const navigate = useNavigate();

  const hasScanned = useRef(false);

  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(null);

  // Check whether device is a mobile/touch device
  useEffect(() => {
    const checkMobile = () => {
      const smallScreen = window.matchMedia("(max-width: 900px)").matches;
      const touchDevice =
        window.matchMedia("(pointer: coarse)").matches ||
        navigator.maxTouchPoints > 0;

      setIsMobile(smallScreen && touchDevice);
    };

    checkMobile();

    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  // Extract ticket code from QuickShow QR URL
  const extractTicketCode = (decodedText) => {
    try {
      const url = new URL(decodedText);

      const match = url.pathname.match(
        /^\/(?:verify-ticket|t)\/([^/?#]+)$/,
      );

      if (!match) {
        return null;
      }

      return decodeURIComponent(match[1]);
    } catch (error) {
      return null;
    }
  };

  // Start QR scanner only on mobile devices
  useEffect(() => {
    if (!isMobile) return;

    hasScanned.current = false;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,

        qrbox: {
          width: 220,
          height: 220,
        },

        rememberLastUsedCamera: true,

        aspectRatio: 1,
      },
      false,
    );

    const handleScanSuccess = async (decodedText) => {
      // Prevent repeated scans
      if (hasScanned.current) return;

      const ticketCode = extractTicketCode(decodedText);

      if (!ticketCode) {
        setError("This QR code is not a valid QuickShow ticket.");
        return;
      }

      try {
        hasScanned.current = true;

        setError("");

        // Stop camera before navigation
        await scanner.clear();

        // Automatically open ticket verification page
        navigate(`/verify-ticket/${ticketCode}`);
      } catch (error) {
        console.log("QR scan processing error:", error);

        hasScanned.current = false;

        setError("Unable to process this ticket QR code.");
      }
    };

    scanner.render(
      handleScanSuccess,

      // Normal QR detection failures are ignored
      () => {},
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [isMobile, navigate]);

  // Wait until device check is complete
  if (isMobile === null) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="text-gray-400 text-sm">
          Loading scanner...
        </p>
      </div>
    );
  }

  // Desktop / non-touch device
  if (!isMobile) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-900 border border-primary/20 rounded-xl p-6 text-center">

          <SmartphoneIcon className="w-12 h-12 text-primary mx-auto mb-4" />

          <h1 className="text-xl font-semibold text-white">
            Mobile Scanner Required
          </h1>

          <p className="text-gray-400 text-sm mt-3">
            Ticket scanning is available on mobile devices. Please open the
            QuickShow admin panel on a phone to scan customer tickets.
          </p>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] px-2 sm:px-4 py-4 sm:py-8">

      <div className="w-full max-w-xl mx-auto">

        {/* Heading */}
        <div className="text-center mb-5">

          <ScanLineIcon className="w-9 h-9 text-primary mx-auto mb-3" />

          <h1 className="text-xl sm:text-2xl font-semibold text-white">
            Scan Ticket
          </h1>

          <p className="text-gray-400 text-sm mt-2">
            Scan the customer's QuickShow ticket QR code to verify entry.
          </p>

        </div>


        {/* Scanner */}
        <div className="w-full bg-gray-900 border border-primary/20 rounded-xl p-3 sm:p-5 overflow-hidden">

          <div
            id="qr-reader"
            className="w-full max-w-full overflow-hidden rounded-lg"
          />


          {/* Invalid QR Message */}
          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">

              <p className="text-red-400 text-sm">
                {error}
              </p>

            </div>
          )}

        </div>


        {/* Instructions */}
        <div className="mt-5 bg-primary/5 border border-primary/20 rounded-lg p-4">

          <p className="text-sm text-gray-300 font-medium mb-2">
            How to validate a ticket
          </p>

          <p className="text-xs sm:text-sm text-gray-400 leading-6">
            Point the camera at the customer's QuickShow QR code. Once the QR
            code is detected, the ticket verification page will open
            automatically.
          </p>

        </div>

      </div>

    </div>
  );
};

export default ScanTicket;