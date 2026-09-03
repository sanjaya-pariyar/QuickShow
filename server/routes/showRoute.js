import express from 'express';
import { addShow, getNowPlayingMovies, getShows, getShow, updateShow, deleteShow } from '../controllers/showController.js';
import { protectAdmin } from '../middleware/auth.js';


const showRouter = express.Router();

showRouter.get('/now-playing', protectAdmin, getNowPlayingMovies)
showRouter.post('/add', protectAdmin, addShow)
showRouter.get('/all', getShows)
showRouter.get('/:movieId', getShow)
showRouter.put("/:showId",protectAdmin,updateShow);
showRouter.delete("/:showId",protectAdmin,deleteShow);

export default showRouter;