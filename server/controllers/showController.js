import axios from "axios"
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";


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