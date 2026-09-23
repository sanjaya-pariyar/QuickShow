import axios from "axios"
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import Booking from "../models/Booking.js";
import { inngest } from "../inngest/index.js";


//api to get now playing movies from tmdb api
export const getNowPlayingMovies = async (req, res) => {
    try {
        const response = await axios.get('https://api.themoviedb.org/3/movie/now_playing', {
            headers: {
                Authorization : `Bearer ${process.env.TMDB_API_KEY}`
            }
        })

        const movies = response.data.results;
        res.json({success:true, movies: movies})
    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message})
    }
}


//api to add a new show to the database

export const addShow = async (req, res) => {
     try {
        const {movieId, showsInput, showPrice} = req.body

        let movie = await Movie.findById(movieId)

        if(!movie) {
            //fetch movie details and credits from API
            const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
            headers: {
                Authorization : `Bearer ${process.env.TMDB_API_KEY}`
            }
        }),
        axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
            headers: {
                Authorization : `Bearer ${process.env.TMDB_API_KEY}`
            }
        })
            ]);
            const movieApiData = movieDetailsResponse.data;
            const movieCreditsData = movieCreditsResponse.data;


            const movieDetails = {
                _id: movieId,
                title:movieApiData.title,
                overview: movieApiData.overview,
                poster_path: movieApiData.poster_path,
                backdrop_path: movieApiData.backdrop_path,
                genres: movieApiData.genres,
                casts: movieCreditsData.cast || [],
                release_date: movieApiData.release_date,
                original_language: movieApiData.original_language,
                tagline: movieApiData.tagline || "",
                vote_average: movieApiData.vote_average,
                runtime: movieApiData.runtime,
            }

            //add movie to db

            movie = await Movie.create(movieDetails);

        }
        const showsToCreate =  [];
        showsInput.forEach(show => {
            const showDate = show.date;
            show.time.forEach((time)=>{
                const dateTimeString = `${showDate}T${time}`;
                showsToCreate.push({
                    movie: movieId,
                    showDateTime: new Date(dateTimeString),
                    showPrice,
                    occupiedSeats: {}
                })
            })
        });
        if(showsToCreate.length > 0){
            await Show.insertMany(showsToCreate);
        }   

        //trigger inngest event
        await inngest.send({
          name: "app/show.added",
          data: {movieTitle: movie.title}
        })

        res.json({success:true, message: 'Show added successfully'})
     } catch (error) {
        console.error(error);
        res.json({success: false, message: error.message});
     }
}





//api tp get all shows from database

export const getShows = async (req, res) => {
  try {
    const shows = await Show.find({
      showDateTime: { $gte: new Date() },
    })
      .populate("movie")
      .sort({ showDateTime: 1 });

    // Filter unique movies
    const uniqueShows = new Map();

    shows.forEach((show) => {
      if (show.movie) {
        uniqueShows.set(show.movie._id.toString(), show.movie);
      }
    });

    res.json({
      success: true,
      shows: Array.from(uniqueShows.values()),
    });
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};


//api to get a single show from the db

export const getShow = async (req, res) => {
  try {
    const { movieId } = req.params;

    // Get all upcoming shows for the movie
    const shows = await Show.find({
      movie: movieId,
      showDateTime: { $gte: new Date() },
    }).sort({ showDateTime: 1 });

    const movie = await Movie.findById(movieId);

    const dateTime = {};

    shows.forEach((show) => {
      const date = show.showDateTime.toISOString().split("T")[0];

      if (!dateTime[date]) {
        dateTime[date] = [];
      }

      dateTime[date].push({
        time: show.showDateTime,
        showId: show._id,
        showPrice: show.showPrice,
      });
    });

    res.json({
      success: true,
      movie,
      dateTime,
    });
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};



// Update existing show
export const updateShow = async (req, res) => {
  try {
    const { showId } = req.params;
    const {
      showDateTime,
      showPrice,
    } = req.body;

    if (!showId) {
      return res.status(400).json({
        success: false,
        message: "Show ID is required",
      });
    }
    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found",
      });
    }

    // Check whether paid bookings exist
    const paidBooking = await Booking.findOne({
      show: showId,
      isPaid: true,
    });

    // Protect shows with paid bookings
    if (paidBooking) {
      return res.status(400).json({
        success: false,
        message:
          "This show cannot be updated because paid bookings already exist.",
      });
    }

    // Update show date/time
    if (showDateTime !== undefined) {
      const newDateTime =
        new Date(showDateTime);

      // Validate date
      if (
        isNaN(
          newDateTime.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid show date and time",
        });
      }


      // Show must remain in future
      if (
        newDateTime <= new Date()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Show date and time must be in the future",
        });
      }
      show.showDateTime =
        newDateTime;
    }
    // Update ticket price
    if (showPrice !== undefined) {
      const price =
        Number(showPrice);
      if (
        isNaN(price) ||
        price <= 0
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Show price must be greater than zero",
        });
      }
      show.showPrice =
        price;
    }
    await show.save();

    return res.json({
      success: true,
      message:
        "Show updated successfully",
      show,
    });

  } catch (error) {
    console.error(
      error.message
    );
    return res.status(500).json({
      success: false,
      message:
        error.message,
    });
  }
};


// Delete existing show
export const deleteShow = async (req, res) => {
  try {
    const { showId } = req.params;
    if (!showId) {
      return res.status(400).json({
        success: false,
        message: "Show ID is required",
      });

    }
    const show =
      await Show.findById(showId);
    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found",
      });
    }
    // Check paid bookings

    const paidBooking =
      await Booking.findOne({
        show: showId,
        isPaid: true,
      });
    if (paidBooking) {
      return res.status(400).json({
        success: false,
        message:
          "This show cannot be deleted because paid bookings already exist.",
      });
    }
    // Delete show
    await Show.findByIdAndDelete(showId);
    return res.json({
      success: true,
      message:
        "Show deleted successfully",
    });

  } catch (error) {
    console.error(
      error.message
    );
    return res.status(500).json({
      success: false,
      message:
        error.message,
    });
  }
};