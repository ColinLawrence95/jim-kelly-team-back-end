import dotenv from "dotenv";
dotenv.config();

import express from "express";

import path from "path";
const cors = require("cors");
import reviewsRouter from "./routes/reviews";
import listingsRouter from "./routes/listings";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/reviews", reviewsRouter);
app.use("/api/listings", listingsRouter);
app.use("/images", express.static(path.join(__dirname, "public/images")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));