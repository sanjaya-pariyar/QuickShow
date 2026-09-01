//api controller function to get userBookings

import { clerkClient } from "@clerk/express";
import Booking from "../models/Booking.js";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import {buildMovieVector, buildUserPreferenceVector,cosineSimilarity} from "../utils/recommendationAlgorithm.js";

export const getUserBookings = async (req, res) => {
  try {
    const user = req.auth().userId;

    const bookings = await Booking.find({ user })
      .populate({
        path: "show",
        populate: { path: "movie" },
      })
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};

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
      typeof item === "object" ? item.movieId : item,
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
      typeof item === "object" ? item.movieId : item,
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
export const getRecommendedMovies = async (req, res) => {
  try {

    // Get currently logged-in user
 
    const { userId } = req.auth();
    const user = await clerkClient.users.getUser(userId);
  
    // Get user's favourite movie IDs
    let favorites = [];
    if (user.privateMetadata && user.privateMetadata.favorites) {
      favorites = user.privateMetadata.favorites;
    }

    // Get all upcoming shows
    const currentTime = new Date();
    const upcomingShows = await Show.find({
      showDateTime: {
        $gte: currentTime,
      },
    }).populate("movie");

    // Build unique list of currently available movies
    const availableMovies = [];
    for (let i = 0; i < upcomingShows.length; i++) {
      const show = upcomingShows[i];
      if (!show.movie) {
        continue;
      }
      const movie = show.movie;
      let alreadyAdded = false;

      // Check whether movie was already added
      for (let j = 0; j < availableMovies.length; j++) {
        if (availableMovies[j]._id.toString() === movie._id.toString()) {
          alreadyAdded = true;
          break;
        }
      }

      // Add only once
      if (alreadyAdded === false) {
        availableMovies[availableMovies.length] = movie;
      }
    }


    // Handle cold-start user that is No favourites available

    if (favorites.length === 0) {

      // Rank available movies by rating using Selection Sort

      for (let i = 0; i < availableMovies.length - 1; i++) {
        let highestIndex = i;
        for (let j = i + 1; j < availableMovies.length; j++) {
          let currentRating = 0;
          let highestRating = 0;
          if (availableMovies[j].vote_average !== undefined) {
            currentRating = availableMovies[j].vote_average;
          }
          if (availableMovies[highestIndex].vote_average !== undefined) {
            highestRating = availableMovies[highestIndex].vote_average;
          }
          if (currentRating > highestRating) {
            highestIndex = j;
          }
        }

        // Swap
        if (highestIndex !== i) {
          const temporaryMovie = availableMovies[i];
          availableMovies[i] = availableMovies[highestIndex];
          availableMovies[highestIndex] = temporaryMovie;
        }
      }

      // Take top 8 available movies 
      const fallbackRecommendations = [];
      let fallbackLimit = 8;
      if (availableMovies.length < fallbackLimit) {
        fallbackLimit = availableMovies.length;
      }

      for (let i = 0; i < fallbackLimit; i++) {
        const movieData = availableMovies[i].toObject();
        movieData.recommendationType = "popular";
        fallbackRecommendations[fallbackRecommendations.length] = movieData;
      }

      // Return cold-start recommendations  
      return res.json({
        success: true,
        recommendations: fallbackRecommendations,
        recommendationMethod: "cold-start",
        message:
          "Popular upcoming movies are shown because the user has no favourites yet.",
      });
    }

  
    // Retrieve favourite movie documents 
    const favoriteMovies = await Movie.find({
      _id: {
        $in: favorites,
      },
    });
   
    // Build user preference vector   
    const userVector = buildUserPreferenceVector(favoriteMovies);
 
    // Build candidate movie list  Exclude movies already favourited

    const candidateMovies = [];
    for (let i = 0; i < availableMovies.length; i++) {
      const movie = availableMovies[i];
      let isFavorite = false;
     // Check whether candidate
      // already exists in user's favourites
      for (let j = 0; j < favorites.length; j++) {
        if (favorites[j].toString() === movie._id.toString()) {
          isFavorite = true;
          break;
        }
      }
      if (isFavorite === false) {
        candidateMovies[candidateMovies.length] = movie;
      }
    }
 
    // Calculate Cosine Similarity  for every candidate movie
    const scoredMovies = [];
    for (let i = 0; i < candidateMovies.length; i++) {
      const movie = candidateMovies[i];
      // Build candidate movie vector
      const movieVector = buildMovieVector(movie);
      // Compare user profile with candidate movie
 
      const similarityScore = cosineSimilarity(userVector, movieVector);

      // Convert Mongoose document into plain JavaScript object
      const movieData = movie.toObject();

      // Attach recommendation score
      movieData.recommendationScore = similarityScore;
      scoredMovies[scoredMovies.length] = movieData;
    }


    // Remove movies with similarity score = 0
    const relevantMovies = [];
    for (let i = 0; i < scoredMovies.length; i++) {
      if (scoredMovies[i].recommendationScore > 0) {
        relevantMovies[relevantMovies.length] = scoredMovies[i];
      }
    }


    // Rank recommendations using Selection Sort Highest similarity → Lowest similarity
   
    for (let i = 0; i < relevantMovies.length - 1; i++) {
      let highestIndex = i;
      for (let j = i + 1; j < relevantMovies.length; j++) {
        if (
          relevantMovies[j].recommendationScore >
          relevantMovies[highestIndex].recommendationScore
        ) {
          highestIndex = j;
        }
      }
      // Swap
      if (highestIndex !== i) {
        const temporaryMovie = relevantMovies[i];
        relevantMovies[i] = relevantMovies[highestIndex];
        relevantMovies[highestIndex] = temporaryMovie;
      }
    }


    // Select top 8 recommendations
    const topRecommendations = [];
    let recommendationLimit = 8;
    if (relevantMovies.length < recommendationLimit) {
      recommendationLimit = relevantMovies.length;
    }
    for (let i = 0; i < recommendationLimit; i++) {
      relevantMovies[i].recommendationType = "content-based";
      topRecommendations[topRecommendations.length] = relevantMovies[i];
    }

    // Return final recommendations
    return res.json({
      success: true,
      recommendations: topRecommendations,
      recommendationMethod: "content-based-cosine-similarity",
      message:
        "Recommendations generated using Content-Based Filtering with Cosine Similarity.",
    });
  } catch (error) {
    console.log(error.message);
    return res.json({
      success: false,
      message: error.message,
    });
  }
};
