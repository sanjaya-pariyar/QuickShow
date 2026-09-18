import React, { useEffect, useState } from "react";
import MovieCard from "./MovieCard";
import BlurCircle from "./BlurCircle";
import { useAppContext } from "../context/AppContext";
import toast from "react-hot-toast";

const CollaborativeRecommendedMovies = () => {
  const { axios, getToken, user, favoriteMovies } = useAppContext();

  const [recommendedMovies, setRecommendedMovies] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchCollaborativeRecommendations = async () => {
  if (isFetching.current) return;

  isFetching.current = true;

  console.log("Collaborative component loaded");

  try {
    if (!user) return;

    setHasFetched(false);

    const { data } = await axios.get(
      "/api/user/recommendations/collaborative",
      {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      }
    );

    console.log(
      "Collaborative response:",
      data
    );

    if (data.success) {
      setRecommendedMovies(
        data.recommendations || []
      );
    } else {
      setRecommendedMovies([]);
      toast.error(data.message);
    }

  } catch (error) {
    console.log(error);

    setRecommendedMovies([]);

    toast.error(
      "Failed to fetch collaborative recommendations"
    );

  } finally {
    setHasFetched(true);

    // Release request lock
    isFetching.current = false;
  }
};


  useEffect(() => {
    fetchCollaborativeRecommendations();
  }, [user?.id]);


  if (!user) return null;

  if (!hasFetched) return null;

  if (recommendedMovies.length === 0) return null;


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
          <MovieCard
            key={movie._id}
            movie={movie}
          />
        ))}

      </div>

    </div>
  );
};

export default CollaborativeRecommendedMovies;