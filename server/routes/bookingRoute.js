import express from 'express'
import { createBooking, getOccupiedSeats, verifyTicket, retryPayment, validateTicket, verifyEsewaPayment  } from '../controllers/bookingController.js';

const bookingRouter = express.Router();


bookingRouter.post('/create', createBooking)
bookingRouter.get('/seats/:showId', getOccupiedSeats)
bookingRouter.get('/verify-ticket/:ticketCode', verifyTicket)
bookingRouter.post("/retry-payment/:bookingId",retryPayment);
bookingRouter.post("/validate-ticket/:ticketCode",validateTicket);
bookingRouter.post("/verify-esewa-payment",verifyEsewaPayment);

export default bookingRouter;