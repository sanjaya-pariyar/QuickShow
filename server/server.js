import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./configs/db.js";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";

const app = express();
const port = process.env.PORT || 8000;

await connectDB();

// middleware
app.use(cors());
app.use(express.json());

// Inngest route
app.use("/api/inngest", serve({ client: inngest, functions }));

// Clerk middleware
app.use(clerkMiddleware());

// API routes
app.get("/", (req, res) => res.send("Server is live!"));

app.listen(port, () =>
  console.log(`Server listening at http://localhost:${port}`)
);