import express from 'express'
import { getFavorites, getUserBookings, updateFavourites, getRecommendedMovies, getCollaborativeRecommendations, checkAdminRole } from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.get('/bookings', getUserBookings)
userRouter.post('/update-favorite', updateFavourites )
userRouter.get('/favorites', getFavorites )
userRouter.get("/recommendations", getRecommendedMovies);
userRouter.get("/recommendations/collaborative", getCollaborativeRecommendations);
userRouter.get("/check-admin",checkAdminRole);

export default userRouter;