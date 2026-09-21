import React from "react";
import { useSearchParams } from "react-router-dom";
import MovieCard from "../components/MovieCard";
import BlurCircle from "../components/BlurCircle";
import { useAppContext } from "../context/AppContext";
const Movies = () => {
  const { shows } = useAppContext();
  const [searchParams] = useSearchParams();

  const searchQuery = searchParams.get("search") || "";

  const filteredShows = shows.filter((movie) =>
    movie.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return shows.length > 0 ? (
    <div className="relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]">
      <BlurCircle top="150px" left="0px" />
      <BlurCircle bottom="50px" right="50px" />
      <h1 className="text-lg font-medium my-4">Now Showing</h1>
      {filteredShows.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          {filteredShows.map((movie) => (
            <MovieCard movie={movie} key={movie._id} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32">
          <h2 className="text-2xl font-medium">No movies found</h2>

          <p className="text-gray-400 mt-2">No movies match "{searchQuery}"</p>
        </div>
      )}
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-3xl font-bold text-center">No movies available</h1>
    </div>
  );
};

export default Movies;
