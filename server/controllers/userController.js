
//api controller function to get userBookings

import { clerkClient } from "@clerk/express";
import Booking from "../models/Booking.js";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";


export const getUserBookings = async (req, res) =>{
    try {
        const user = req.auth().userId;

        const bookings = await Booking.find({user}).populate({
            path: "show",
            populate:{path: "movie"}
        }).sort({createdAt: -1})
        res.json({success: true, bookings})
    } catch (error) {
        console.error(error.message);
        res.json({success: false, message: error.message});
    }
}




//api controller function to update favourite movie in clerk user meta data
export const updateFavourites = async (req, res) => {
  try {
    const { movieId } = req.body;
    const userId = req.auth().userId;

    if (!movieId) {
      return res.json({
        success: false,
        message: "Movie ID is required",
      });
    }

    const user = await clerkClient.users.getUser(userId);

    let favorites = user.privateMetadata.favorites || [];

    // Fix old wrongly saved data like { movieId: "1477317" }
    favorites = favorites.map((item) =>
      typeof item === "object" ? item.movieId : item
    );

    if (!favorites.includes(movieId)) {
      favorites.push(movieId);
    } else {
      favorites = favorites.filter((item) => item !== movieId);
    }

    await clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: {
        ...user.privateMetadata,
        favorites,
      },
    });

    res.json({
      success: true,
      message: "Favorite movies updated",
      favorites,
    });
  } catch (error) {
    console.error(error.message);

    res.json({
      success: false,
      message: error.message,
    });
  }
};





export const getFavorites = async (req, res) => {
  try {
    const user = await clerkClient.users.getUser(req.auth().userId);

    let favorites = user.privateMetadata.favorites || [];

    // Fix old wrongly saved data
    favorites = favorites.map((item) =>
      typeof item === "object" ? item.movieId : item
    );

    const movies = await Movie.find({
      _id: { $in: favorites },
    });

    res.json({
      success: true,
      movies,
    });
  } catch (error) {
    console.error(error.message);

    res.json({
      success: false,
      message: error.message,
    });
  }
};





// Content-Based Filtering Recommendation Algorithm
// Content-Based Filtering Recommendation Algorithm
export const getRecommendedMovies = async (req, res) => {
  try {
    const userId = req.auth().userId;

    if (!userId) {
      return res.json({
        success: false,
        message: "User not authenticated",
      });
    }

    const user = await clerkClient.users.getUser(userId);

    let favoriteIds = user.privateMetadata.favorites || [];

    favoriteIds = favoriteIds.map((item) =>
      typeof item === "object" ? String(item.movieId) : String(item)
    );

    favoriteIds = [...new Set(favoriteIds)];

    if (favoriteIds.length === 0) {
      return res.json({
        success: true,
        recommendations: [],
        mode: "no_favourites",
        message: "Add movies to favourites to get recommendations",
      });
    }

    const favoriteMovies = await Movie.find({
      _id: { $in: favoriteIds },
    });

    if (favoriteMovies.length === 0) {
      return res.json({
        success: true,
        recommendations: [],
        mode: "no_favourites",
        message: "Add movies to favourites to get recommendations",
      });
    }

    const upcomingShows = await Show.find({
      showDateTime: { $gte: new Date() },
    })
      .populate("movie")
      .sort({ showDateTime: 1 });

    const availableMoviesMap = new Map();

    upcomingShows.forEach((show) => {
      if (show.movie) {
        availableMoviesMap.set(show.movie._id.toString(), show.movie);
      }
    });

    const availableMovies = Array.from(availableMoviesMap.values());

    if (availableMovies.length === 0) {
      return res.json({
        success: true,
        recommendations: [],
        mode: "no_available_movies",
        message: "No upcoming movies available",
      });
    }

    const favouriteGenres = new Set();
    const favouriteCasts = new Set();

    const getGenreKey = (genre) => {
      if (!genre) return "";
      if (typeof genre === "string") return genre.toLowerCase();
      return String(genre.id || genre.name || "").toLowerCase();
    };

    const getGenreName = (genre) => {
      if (!genre) return "";
      if (typeof genre === "string") return genre;
      return genre.name || String(genre.id || "");
    };

    const getCastKey = (cast) => {
      if (!cast) return "";
      if (typeof cast === "string") return cast.toLowerCase();
      return String(cast.id || cast.name || "").toLowerCase();
    };

    const getCastName = (cast) => {
      if (!cast) return "";
      if (typeof cast === "string") return cast;
      return cast.name || String(cast.id || "");
    };

    favoriteMovies.forEach((movie) => {
      movie.genres?.forEach((genre) => {
        const key = getGenreKey(genre);

        if (key) {
          favouriteGenres.add(key);
        }
      });

      movie.casts?.slice(0, 10).forEach((cast) => {
        const key = getCastKey(cast);

        if (key) {
          favouriteCasts.add(key);
        }
      });
    });

const calculateRecommendationDetails = (movie) => {
  let genreScore = 0;
  let castScore = 0;

  const matchedGenres = [];
  const matchedCasts = [];

  movie.genres?.forEach((genre) => {
    const key = getGenreKey(genre);

    if (favouriteGenres.has(key)) {
      genreScore += 5;
      matchedGenres.push(getGenreName(genre));
    }
  });

  movie.casts?.slice(0, 10).forEach((cast) => {
    const key = getCastKey(cast);

    if (favouriteCasts.has(key)) {
      castScore += 2;
      matchedCasts.push(getCastName(cast));
    }
  });

  // Main fix:
  // Genre match is required.
  // Cast match alone is not enough.
  if (genreScore === 0) {
    return {
      score: 0,
      matchedGenres: [],
      matchedCasts,
      reason: "No genre match",
    };
  }

  const ratingScore = (movie.vote_average || 0) * 0.3;
  const finalScore = genreScore + castScore + ratingScore;

  return {
    score: finalScore,
    matchedGenres,
    matchedCasts,
    reason: `Genre match: ${
      matchedGenres.length ? matchedGenres.join(", ") : "None"
    } | Cast match: ${
      matchedCasts.length ? matchedCasts.join(", ") : "None"
    } | Rating support: ${ratingScore.toFixed(2)}`,
  };
};

    const recommendations = availableMovies
      .filter((movie) => !favoriteIds.includes(movie._id.toString()))
      .map((movie) => {
        const details = calculateRecommendationDetails(movie);

        return {
          ...movie.toObject(),
          recommendationScore: details.score,
          matchedGenres: details.matchedGenres,
          matchedCasts: details.matchedCasts,
          recommendationReason: details.reason,
        };
      })
      .filter((movie) => movie.recommendationScore > 0)
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 8);

    console.log(
      "Favourite movies used:",
      favoriteMovies.map((movie) => ({
        title: movie.title,
        genres: movie.genres?.map((genre) => getGenreName(genre)),
        casts: movie.casts?.slice(0, 10).map((cast) => getCastName(cast)),
      }))
    );

    console.log(
      "Recommendations generated:",
      recommendations.map((movie) => ({
        title: movie.title,
        score: movie.recommendationScore,
        matchedGenres: movie.matchedGenres,
        matchedCasts: movie.matchedCasts,
        reason: movie.recommendationReason,
      }))
    );

    if (recommendations.length === 0) {
      return res.json({
        success: true,
        recommendations: [],
        mode: "no_similar_movies",
        message: "No similar movies found yet",
        debug: {
          favoriteIds,
          favoriteMovies: favoriteMovies.map((movie) => ({
            title: movie.title,
            genres: movie.genres?.map((genre) => getGenreName(genre)),
            casts: movie.casts?.slice(0, 10).map((cast) => getCastName(cast)),
          })),
        },
      });
    }

    res.json({
      success: true,
      recommendations,
      mode: "content_based",
      message: "Recommendations generated successfully",
      debug: {
        favoriteIds,
        favoriteMovies: favoriteMovies.map((movie) => ({
          title: movie.title,
          genres: movie.genres?.map((genre) => getGenreName(genre)),
          casts: movie.casts?.slice(0, 10).map((cast) => getCastName(cast)),
        })),
      },
    });
  } catch (error) {
    console.error(error.message);

    res.json({
      success: false,
      message: error.message,
    });
  }
};