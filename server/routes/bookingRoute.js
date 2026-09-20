import express from 'express'
import { createBooking, getOccupiedSeats, verifyTicket, retryPayment  } from '../controllers/bookingController.js';

const bookingRouter = express.Router();


bookingRouter.post('/create', createBooking)
bookingRouter.get('/seats/:showId', getOccupiedSeats)
bookingRouter.get('/verify-ticket/:ticketCode', verifyTicket)
bookingRouter.post("/retry-payment/:bookingId",retryPayment);



export default bookingRouter;