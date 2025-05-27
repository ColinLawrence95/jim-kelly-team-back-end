import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import reviewsRouter from "./routes/reviews";
import listingsRouter from "./routes/listings";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/reviews", reviewsRouter);
app.use("/api/listings", listingsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
