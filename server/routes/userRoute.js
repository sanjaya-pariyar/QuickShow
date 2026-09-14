import express from 'express'
import { getFavorites, getUserBookings, updateFavourites, getRecommendedMovies, getCollaborativeRecommendations } from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.get('/bookings', getUserBookings)
userRouter.post('/update-favorite', updateFavourites )
userRouter.get('/favorites', getFavorites )
userRouter.get("/recommendations", getRecommendedMovies);
userRouter.get("/recommendations/collaborative", getCollaborativeRecommendations);

export default userRouter;