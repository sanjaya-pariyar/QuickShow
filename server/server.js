import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./configs/db.js";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import showRouter from "./routes/showRoute.js";
import bookingRouter from "./routes/bookingRoute.js";
import adminRouter from "./routes/adminRoute.js";
import userRouter from "./routes/userRoute.js";
import { stripeWebhooks } from "./controllers/StripeWebhooks.js";

const app = express();
const port = process.env.PORT || 8000;

await connectDB();


//stripe webhooks route
app.use('/api/stripe', express.raw({type: 'application/json'}), stripeWebhooks)

// middleware
app.use(cors());
app.use(express.json());

// Inngest route
app.use("/api/inngest", serve({ client: inngest, functions }));

// Clerk middleware
app.use(clerkMiddleware());

// API routes
app.get("/", (req, res) => res.send("Server is live!"));
app.use('/api/show', showRouter);
app.use('/api/booking', bookingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/user', userRouter);

app.listen(port, () =>
  console.log(`Server listening at http://localhost:${port}`)
);