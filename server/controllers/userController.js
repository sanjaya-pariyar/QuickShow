//api controller function to get userBookings

import { clerkClient } from "@clerk/express";
import Booking from "../models/Booking.js";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import {
  buildMovieVector, 
  buildUserPreferenceVector,
  cosineSimilarity, 
  normalizeRating, 
  jaccardSimilarity, 
  findKNearestNeighbors, 
  calculateNeighborWeightedScores, 
  sortRecommendationsByScore
} from "../utils/recommendationAlgorithm.js";

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
      return res.json({
        success: true,
        recommendations: [],
        recommendationMethod: "cold-start",
        message:
          "Add some movies to your favourites to receive personalised recommendations.",
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
     // Check whether candidate already exists in user's favourites
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
    for (let i = 0;i < candidateMovies.length;i++) {
      const movie = candidateMovies[i];
      // Build candidate movie vector
      const movieVector = buildMovieVector(movie);
      // Calculate content similarity
      const similarityScore =cosineSimilarity(userVector,movieVector);
      // Normalize movie rating
      const ratingScore = normalizeRating(movie.vote_average);
      // Hybrid recommendation score
      const finalScore =(similarityScore * 0.8) + (ratingScore * 0.2);
      // Convert Mongoose document
      const movieData = movie.toObject();
      // Store different scores
      movieData.similarityScore = similarityScore;
      movieData.ratingScore = ratingScore;
      movieData.recommendationScore = finalScore;
      scoredMovies[scoredMovies.length] = movieData;
}

    // Remove movies with weak content similarity
    const relevantMovies = [];
    const minimumSimilarity = 0.05;
    for (let i = 0; i < scoredMovies.length; i++) {
      if (
        scoredMovies[i].similarityScore >=
        minimumSimilarity
      ) {
        relevantMovies[
          relevantMovies.length
        ] = scoredMovies[i];
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


export const getCollaborativeRecommendations = async (req, res) => {
  try {
    const { userId } = req.auth();
    console.log(
  "Collaborative Request User ID:",
  userId
);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User is not authenticated",
      });
    }
    //  Get current user's favourites
    const currentUser = await clerkClient.users.getUser(userId);
    const currentUserFavorites = currentUser.privateMetadata?.favorites || [];


        // DEBUG 1
    console.log(
      "Current User Favorites:",
      currentUserFavorites
    );

    // Collaborative cold-start
    if (currentUserFavorites.length === 0) {
      return res.json({
        success: true,
        recommendations: [],
        message:
          "Add favourite movies to receive collaborative recommendations.",
      });
    }

    // Get other QuickShow users

    const clerkUsersResponse = await clerkClient.users.getUserList({
        limit: 100,
      });

    const clerkUsers = clerkUsersResponse.data || [];
    const otherUsers = [];
    for (let i = 0; i < clerkUsers.length; i++) {
      const user = clerkUsers[i];
      // Do not compare user with themselves
      if (user.id === userId) {
        continue;
      }
      const favorites =
        user.privateMetadata?.favorites || [];
      // Users without favourites cannot  contribute to collaborative filtering
      if (favorites.length === 0) {
        continue;
      }
      otherUsers.push({
        userId: user.id,
        favorites: favorites,
      });
    }



    // DEBUG 2
    console.log(
      "Other Users:",
      otherUsers
    );

    // 3. Find top 5 nearest neighbours

    const nearestNeighbors = findKNearestNeighbors( currentUserFavorites, otherUsers, 5);

    // DEBUG 3
    console.log(
      "Nearest Neighbors:",
      nearestNeighbors
    );

    if (nearestNeighbors.length === 0) {
      return res.json({
        success: true,
        recommendations: [],
        message:
          "No users with similar movie preferences were found.",
      });
    }

    // 4. Calculate candidate movie scores

    const candidateMovies = calculateNeighborWeightedScores( currentUserFavorites, nearestNeighbors);

    console.log(
  "User:",
  userId,
  "Candidate Movies:",
  candidateMovies
);
        // DEBUG 4
    console.log(
      "Candidate Movies:",
      candidateMovies
    );
    if (candidateMovies.length === 0) {
      return res.json({
        success: true,
        recommendations: [],
        message:
          "No collaborative recommendation candidates were found.",
      });
    }

    // 5. Rank candidates

    const rankedCandidates = sortRecommendationsByScore(candidateMovies);

    // DEBUG 5
    console.log(
      "Ranked Candidates:",
      rankedCandidates
    );

    // 6. Get candidate movie IDs

    const candidateMovieIds = [];
    for (let i = 0; i < rankedCandidates.length; i++) {
      candidateMovieIds.push(rankedCandidates[i].movieId);
    }

    // 7. Keep only movies with upcoming QuickShow shows

    const upcomingShows = await Show.find({
      movie: {
        $in: candidateMovieIds,
      },
      showDateTime: {
        $gte: new Date(),
      },
    }).populate("movie");

    // Create a map so one movie appearing in multiple shows is stored once
    const availableMovieMap = new Map();
    for (let i = 0; i < upcomingShows.length; i++) {
      const show = upcomingShows[i];
      if (!show.movie) {
        continue;
      }
      availableMovieMap.set(
        show.movie._id.toString(),
        show.movie
      );
    }

    // 8. Preserve recommendation ranking while attaching movie details

    const finalRecommendations = [];
    for (let i = 0; i < rankedCandidates.length; i++) {
      const candidate = rankedCandidates[i];
      const movie = availableMovieMap.get(candidate.movieId.toString());
      if (!movie) {
        continue;
      }
      finalRecommendations.push({
        ...movie.toObject(),

        collaborativeScore:
          candidate.recommendationScore,
      });

      // Maximum Top 8
      if ( finalRecommendations.length === 8) {
        break;
      }
    }

    console.log(
      "Final Recommendations:",
      finalRecommendations
    );


    // 9. Return result

    if (finalRecommendations.length === 0) {
      return res.json({
        success: true,
        recommendations: [],
        message:
          "No bookable collaborative recommendations are currently available.",
      });
    }

    return res.json({
      success: true,

      recommendations:
        finalRecommendations,

      neighborsUsed:
        nearestNeighbors.length,

      message:
        "Collaborative recommendations generated successfully.",
    });


    
  } catch (error) {
    console.error(
      "Collaborative recommendation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate collaborative recommendations.",
    });
  }
  
};
