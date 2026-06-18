import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './configs/db.js';
import { clerkMiddleware } from '@clerk/express'



const app = express();
const port = process.env.PORT || 8000;

await connectDB();

//middileware
app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());


//api routes
app.get('/', (req, res) => res.send('Server is live!'))





app.listen(port, ()=> console.log(`Server listening at http://localhost:${port}`));
