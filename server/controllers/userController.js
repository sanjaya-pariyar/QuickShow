
//api controller function to get userBookings

import { clerkClient } from "@clerk/express";
import Booking from "../models/Booking.js";
import Movie from "../models/Movie.js";


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