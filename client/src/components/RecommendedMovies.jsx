import React, { useEffect, useState } from "react";
import MovieCard from "./MovieCard";
import BlurCircle from "./BlurCircle";
import { useAppContext } from "../context/AppContext";
import toast from "react-hot-toast";

const RecommendedMovies = () => {
  const { axios, getToken, user, favoriteMovies } = useAppContext();

  const [recommendedMovies, setRecommendedMovies] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchRecommendedMovies = async () => {
    try {
      if (!user) return;

      setHasFetched(false);

      const { data } = await axios.get("/api/user/recommendations", {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      if (data.success) {
        setRecommendedMovies(data.recommendations || []);
      } else {
        setRecommendedMovies([]);
        toast.error(data.message);
      }
    } catch (error) {
      console.log(error);
      setRecommendedMovies([]);
      toast.error("Failed to fetch recommendations");
    } finally {
      setHasFetched(true);
    }
  };

  useEffect(() => {
    fetchRecommendedMovies();
  }, [user?.id, favoriteMovies]);

  if (!user) return null;

  // Do not render anything before API response
  if (!hasFetched) return null;

  // Main requirement:
  // Do not render the whole component if there are no recommended movies
  if (recommendedMovies.length === 0) return null;

  return (
    <div className="px-6 md:px-16 lg:px-24 xl:px-44 overflow-hidden">
      <div className="relative flex items-center justify-between pt-20 pb-10">
        <BlurCircle top="0" right="-80px" />

        <div>
          <p className="text-gray-300 font-medium text-lg">
            Recommended For You
          </p>

          <p className="text-sm text-gray-500 mt-1">
            Based on your favourite movies
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

export default RecommendedMovies;