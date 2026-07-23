import express from 'express'
import { getFavorites, getUserBookings, updateFavourites, getRecommendedMovies } from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.get('/bookings', getUserBookings)
userRouter.post('/update-favorite', updateFavourites )
userRouter.get('/favorites', getFavorites )
userRouter.get("/recommendations", getRecommendedMovies);


export default userRouter;