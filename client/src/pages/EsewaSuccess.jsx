import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const EsewaSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { axios } = useAppContext();

  const [message, setMessage] = useState(
    "Verifying your eSewa payment..."
  );

  const hasVerified = useRef(false);

  const verifyPayment = async () => {
    try {
      const paymentData = searchParams.get("data");

      if (!paymentData) {
        setMessage("eSewa payment information is missing.");
        return;
      }

      const { data } = await axios.post(
        "/api/booking/verify-esewa-payment",
        {
          data: paymentData,
        }
      );

      if (data.success) {
        setMessage("Payment verified successfully.");

        setTimeout(() => {
          navigate("/my-bookings");
        }, 1500);

        return;
      }

      setMessage(
        data.message || "Unable to verify eSewa payment."
      );
    } catch (error) {
      console.log(error);

      setMessage(
        error.response?.data?.message ||
          "Something went wrong while verifying payment."
      );
    }
  };

  useEffect(() => {
    if (hasVerified.current) return;

    hasVerified.current = true;

    verifyPayment();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary/5 px-4">
      <div className="bg-gray-900 border border-primary/30 rounded-xl p-8 text-center max-w-md w-full">
        <h1 className="text-2xl font-semibold mb-4">
          eSewa Payment
        </h1>

        <p className="text-gray-300">
          {message}
        </p>
      </div>
    </div>
  );
};

export default EsewaSuccess;