import React, { useEffect, useState } from "react";
import MovieCard from "./MovieCard";
import BlurCircle from "./BlurCircle";
import { useAppContext } from "../context/AppContext";
import toast from "react-hot-toast";

const CollaborativeRecommendedMovies = () => {
  const { axios, getToken, user } = useAppContext();

  const [recommendedMovies, setRecommendedMovies] = useState([]);

  const [hasFetched, setHasFetched] = useState(false);

  const [debugMessage, setDebugMessage] = useState("Waiting for user...");




  const fetchCollaborativeRecommendations = async () => {

    if (!user?.id) {
      console.log("Fetch stopped: user is not available");

      setDebugMessage("User is not available");

      return;
    }

    try {
      setHasFetched(false);

      setDebugMessage("Sending collaborative recommendation request...");


      const token = await getToken();


      const { data } = await axios.get(
        "/api/user/recommendations/collaborative",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );


      if (data.success) {
        const recommendations = data.recommendations || [];

        setRecommendedMovies(recommendations);

        if (recommendations.length === 0) {
          setDebugMessage(
            data.message || "No collaborative recommendations found.",
          );
        } else {
          setDebugMessage(
            `${recommendations.length} collaborative recommendation(s) received.`,
          );
        }
      } else {
        console.log("Backend returned success false:", data.message);

        setRecommendedMovies([]);

        setDebugMessage(
          data.message || "Backend returned an unsuccessful response.",
        );

        toast.error(data.message || "Collaborative recommendation failed");
      }
    } catch (error) {
      console.error("Collaborative recommendation request failed:");

      console.error(error);

      console.log("Error message:", error.message);

      console.log("Error status:", error.response?.status);

      console.log("Error response:", error.response?.data);

      setRecommendedMovies([]);

      setDebugMessage(
        error.response?.data?.message ||
          error.message ||
          "Collaborative API request failed.",
      );

      toast.error("Failed to fetch collaborative recommendations");
    } finally {
      console.log("Collaborative fetch completed");

      setHasFetched(true);
    }
  };

  useEffect(() => {


    if (user?.id) {
      console.log("User available - calling collaborative API");

      fetchCollaborativeRecommendations();
    } else {
      console.log("User not ready - API not called");
    }
  }, [user?.id]);

  if (!user) {
    return null;
  }

  if (!hasFetched) {
    return (
      <div className="px-6 md:px-16 lg:px-24 xl:px-44 py-10">
        <p className="text-gray-400 text-sm">
          Loading collaborative recommendations...
        </p>
      </div>
    );
  }

  if (recommendedMovies.length === 0) {
    return (
      <div className="px-6 md:px-16 lg:px-24 xl:px-44 py-10">
        <p className="text-gray-300 font-medium">
          Collaborative Recommendation Debug
        </p>

        <p className="text-gray-500 text-sm mt-2">{debugMessage}</p>
      </div>
    );
  }

  return (
    <div className="px-6 md:px-16 lg:px-24 xl:px-44 overflow-hidden">
      <div className="relative flex items-center justify-between pt-20 pb-10">
        <BlurCircle top="0" right="-80px" />

        <div>
          <p className="text-gray-300 font-medium text-lg">
            Similar Users Also Like
          </p>

          <p className="text-sm text-gray-500 mt-1">
            Based on users with similar favourite movies
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
        {recommendedMovies.map((movie) => (
          <MovieCard key={movie._id} movie={movie} />
        ))}
      </div>
    </div>
  );
};

export default CollaborativeRecommendedMovies;
