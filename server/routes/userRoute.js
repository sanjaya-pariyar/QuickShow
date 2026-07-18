import express from 'express'
import { getFavorites, getUserBookings, updateFavourites } from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.get('/bookings', getUserBookings)
userRouter.post('/update-favorite', updateFavourites )
userRouter.get('/favorites', getFavorites )


export default userRouter;