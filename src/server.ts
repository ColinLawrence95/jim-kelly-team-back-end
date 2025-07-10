import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

import reviewsRouter from "./routes/reviews";
import listingsRouter from "./routes/listings";

const app = express();

// ALLOW your frontend explicitly
const allowedOrigins = [
  "http://localhost:3000",
  "https://thejimkellyteam.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// Explicitly handle OPTIONS requests
app.options("*", cors());

app.use(express.json());
app.use("/api/reviews", reviewsRouter);
app.use("/api/listings", listingsRouter);
app.use("/images", express.static(path.join(__dirname, "public/images")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
