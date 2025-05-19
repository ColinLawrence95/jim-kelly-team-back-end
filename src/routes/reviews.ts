import { Request, Response, Router } from "express";
import axios from "axios";
import NodeCache from "node-cache";

const router = Router();
const cache = new NodeCache({ stdTTL: 3600 });

interface Review {
    author_name: string;
    rating: number;
    text: string;
    time: number;
}

interface ErrorResponse {
    error: string;
}

router.get("/", async (req: Request, res: Response) => {
    try {
        const apiKey = process.env.GOOGLE_API_KEY;
        const placeId = process.env.PLACE_ID;

        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${apiKey}`;
        const response = await axios.get(url);
        
   

        const reviews: Review[] = response.data.result?.reviews || [];
       

        res.json(reviews);
    } catch (error) {
        console.error("Error fetching reviews:", error instanceof Error ? error.message : error);
        res.status(500).json({ error: "Failed to fetch reviews" });
    }
});

export default router;
