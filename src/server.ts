import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";

import reviewsRouter from "./routes/reviews";
import listingsRouter from "./routes/listings";

const app = express();

const allowedOrigins = ["https://thejimkellyteam.com", "http://localhost:3000"];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    })
);
app.use(express.json());

app.use("/api/reviews", reviewsRouter);
app.use("/api/listings", listingsRouter);
app.use("/images", express.static(path.join(__dirname, "public/images")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
