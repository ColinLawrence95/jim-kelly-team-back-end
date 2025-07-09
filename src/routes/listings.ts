import express from "express";
import axios from "axios";
import fs from "fs/promises";
import path from "path";

const router = express.Router();


const IMAGE_STORAGE_PATH = path.join(__dirname, "../public/images");
const BASE_IMAGE_URL = process.env.BASE_IMAGE_URL;


async function ensureImageDirectory() {
    try {
        await fs.mkdir(IMAGE_STORAGE_PATH, { recursive: true });
    } catch (err) {
        console.error("Failed to create image storage directory", err);
    }
}

interface Property {
    ListingKey: string;
    ListPrice: number;
    ListAgentFullName: string;
    MlsStatus: string;
    PublicRemarks: string;
    UnparsedAddress: string;
    MediaURL: string;
    ListingContractDate: string;
}

interface DLAResponse<T = any> {
    "@odata.context": string;
    value: T[];
}

interface MediaItem {
    MediaURL: string;
}

async function downloadImage(listingKey: string, mediaUrl: string): Promise<string> {
    try {
        
        const extension = path.extname(mediaUrl) || ".jpg"; 
        const filename = `${listingKey}${extension}`;
        const filePath = path.join(IMAGE_STORAGE_PATH, filename);

        
        try {
            await fs.access(filePath);
            return `${BASE_IMAGE_URL}/${filename}`; 
        } catch {
         
        }

    
        const response = await axios.get(mediaUrl, {
            responseType: "arraybuffer",
            headers: {
                Authorization: `Bearer ${process.env.DLA_TOKEN}`,
            },
        });

      
        await fs.writeFile(filePath, Buffer.from(response.data));

        return `${BASE_IMAGE_URL}/${filename}`;
    } catch (err) {
        console.error(`Failed to download image for ListingKey ${listingKey}`, err);
        return "";
    }
}

router.get("/", async (req, res) => {
    try {
        await ensureImageDirectory();

        const agentNumbers = process.env.AGENT_NUMBERS?.split(",") || [];
        const filterQuery = agentNumbers.map((agent) => `ListAgentKey eq '${agent}'`).join(" or ");

        
        const propertyResponse = await axios.get<DLAResponse<Property>>(
            `${process.env.AMPLIFY_ODS_URL_PROPERTY}?$filter=${encodeURIComponent(
                filterQuery
            )}&$select=ListingKey,ListPrice,UnparsedAddress,PublicRemarks,ListAgentFullName,MlsStatus,ListOfficeKey,ListingContractDate`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.DLA_TOKEN}`,
                    Accept: "application/json",
                },
            }
        );

        const properties = propertyResponse.data.value;

        const enrichedProperties = await Promise.all(
            properties.map(async (property) => {
                try {
                    const mediaUrl = `${process.env.AMPLIFY_ODS_URL_MEDIA}?$filter=${encodeURIComponent(
                        `ResourceRecordKey eq '${property.ListingKey}' and ResourceName eq 'Property'`
                    )}`;

                    const mediaResponse = await axios.get<DLAResponse<MediaItem>>(mediaUrl, {
                        headers: {
                            Authorization: `Bearer ${process.env.DLA_TOKEN}`,
                            Accept: "application/json",
                        },
                    });

                    const firstMedia = mediaResponse.data.value[0];
                    property.MediaURL = firstMedia?.MediaURL ? await downloadImage(property.ListingKey, firstMedia.MediaURL) : "";
                    property.ListingContractDate = property.ListingContractDate || "";
                } catch (mediaErr) {
                    console.error(`Error fetching media for ListingKey ${property.ListingKey}`, mediaErr);
                    property.MediaURL = "";
                }
                return property;
            })
        );

        res.json(enrichedProperties);
    } catch (error) {
        console.error("Error fetching properties:", error);
        res.status(500).json({ error: "Failed to fetch properties" });
    }
});

export default router;