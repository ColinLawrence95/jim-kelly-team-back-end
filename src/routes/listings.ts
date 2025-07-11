import express from "express";
import axios from "axios";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
} from "@aws-sdk/client-s3";

import path from "path";

const router = express.Router();

const s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

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
    const extension = path.extname(mediaUrl) || ".jpg";
    const filename = `${listingKey}${extension}`;

    try {
        // Check if image already exists in R2
        await s3Client.send(
            new HeadObjectCommand({
                Bucket: process.env.R2_BUCKET,
                Key: filename,
            })
        );

        // If exists, just generate and return a signed URL
        const signedUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
                Bucket: process.env.R2_BUCKET,
                Key: filename,
            }),
            { expiresIn: 3600 }
        );
        return signedUrl;
    } catch (headErr: any) {
        if (headErr?.$metadata?.httpStatusCode !== 404) {
            console.error(`Error checking existence of image for ${listingKey}`, headErr);
            return "";
        }
        // If not found (404), continue to download and upload
    }

    // If not found, download the image and upload
    try {
        const response = await axios.get(mediaUrl, {
            responseType: "arraybuffer",
            headers: { Authorization: `Bearer ${process.env.DLA_TOKEN}` },
        });

        await s3Client.send(
            new PutObjectCommand({
                Bucket: process.env.R2_BUCKET,
                Key: filename,
                Body: Buffer.from(response.data),
                ContentType: `image/${extension.replace(".", "")}`,
            })
        );

        // Generate signed URL
        const signedUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
                Bucket: process.env.R2_BUCKET,
                Key: filename,
            }),
            { expiresIn: 3600 }
        );

        return signedUrl;
    } catch (err) {
        console.error(`Failed to download/upload image for ListingKey ${listingKey}`, err);
        return "";
    }
}

router.get("/", async (req, res) => {
    try {
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
                    const mediaUrl = `${
                        process.env.AMPLIFY_ODS_URL_MEDIA
                    }?$filter=${encodeURIComponent(
                        `ResourceRecordKey eq '${property.ListingKey}' and ResourceName eq 'Property'`
                    )}`;

                    const mediaResponse = await axios.get<DLAResponse<MediaItem>>(mediaUrl, {
                        headers: {
                            Authorization: `Bearer ${process.env.DLA_TOKEN}`,
                            Accept: "application/json",
                        },
                    });

                    const firstMedia = mediaResponse.data.value[0];
                    property.MediaURL = firstMedia?.MediaURL
                        ? await downloadImage(property.ListingKey, firstMedia.MediaURL)
                        : "";
                    property.ListingContractDate = property.ListingContractDate || "";
                } catch (mediaErr) {
                    console.error(
                        `Error fetching media for ListingKey ${property.ListingKey}`,
                        mediaErr
                    );
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
