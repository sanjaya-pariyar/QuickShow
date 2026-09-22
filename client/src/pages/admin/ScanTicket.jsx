import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";

const ScanTicket = () => {
  const navigate = useNavigate();

  const hasScanned = useRef(false);

  const [error, setError] = useState("");

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: {
          width: 250,
          height: 250,
        },
        rememberLastUsedCamera: true,
      },
      false,
    );

    const handleScanSuccess = async (decodedText) => {
      if (hasScanned.current) return;

      try {
        console.log("Scanned QR:", decodedText);

        // Accept:
        // /verify-ticket/QS-XXXX
        // OR
        // /t/QS-XXXX
        const match = decodedText.match(
          /\/(?:verify-ticket|t)\/([^/?#]+)/,
        );

        if (!match) {
          setError("This QR code is not a valid QuickShow ticket.");
          return;
        }

        const ticketCode = decodeURIComponent(match[1]);

        hasScanned.current = true;

        await scanner.clear();

        navigate(`/verify-ticket/${ticketCode}`);
      } catch (error) {
        console.log("QR scan error:", error);

        setError("Unable to process this ticket QR code.");
      }
    };

    scanner.render(
      handleScanSuccess,
      () => {
        // Ignore normal scan-frame failures
      },
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [navigate]);

  return (
    <div className="min-h-[80vh] px-4 md:px-8 py-8">

      <div className="max-w-xl mx-auto">

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-white">
            Scan Ticket
          </h1>

          <p className="text-gray-400 text-sm mt-2">
            Scan the customer's QuickShow ticket QR code to verify entry.
          </p>
        </div>

        <div className="bg-gray-900 border border-primary/20 rounded-xl p-4 sm:p-6">

          <div
            id="qr-reader"
            className="w-full overflow-hidden rounded-lg"
          />

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
              <p className="text-red-400 text-sm">
                {error}
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

export default ScanTicket;