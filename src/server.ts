import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import reviewsRouter from "./routes/reviews";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000'}));
app.use(express.json());

app.use("/api/reviews", reviewsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
