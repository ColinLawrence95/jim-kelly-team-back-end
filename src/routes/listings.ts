import express from "express";
import axios from "axios";

const router = express.Router();

const AMPLIFY_ODS_URL_PROPERTY = process.env.AMPLIFY_ODS_URL_PROPERTY!;
const AMPLIFY_ODS_URL_MEDIA = process.env.AMPLIFY_ODS_URL_MEDIA!;

interface Property {
  ListingKey: string;
  ListPrice: number;
  ListAgentFullName: string;
  MlsStatus: string;
  PublicRemarks: string;
  UnparsedAddress: string;
  MediaURL?: string; 
}

interface DLAResponse<T = any> {
  "@odata.context": string;
  value: T[];
}

router.get("/", async (req, res) => {
  try {
    const agentNumbers = process.env.AGENT_NUMBERS?.split(",") || [];
    
    const filterQuery = agentNumbers.map((agent) => `ListAgentKey eq '${agent}'`).join(" or ");

 
    const propertyResponse = await axios.get<DLAResponse<Property>>(
      `${AMPLIFY_ODS_URL_PROPERTY}?$filter=${encodeURIComponent(
        filterQuery
      )}&$select=ListingKey,ListPrice,UnparsedAddress,PublicRemarks,ListAgentFullName,MlsStatus,ListOfficeKey`,
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
          const mediaUrl = `${AMPLIFY_ODS_URL_MEDIA}?$filter=${encodeURIComponent(
            `ResourceRecordKey eq '${property.ListingKey}' and ResourceName eq 'Property' and ImageSizeDescription eq 'Large'`
          )}&$orderby=ModificationTimestamp desc&$top=1`;

          const mediaResponse = await axios.get<DLAResponse>(
            mediaUrl,
            {
              headers: {
                Authorization: `Bearer ${process.env.DLA_TOKEN}`,
                Accept: "application/json",
              },
            }
          );

          const firstMedia = mediaResponse.data.value[0];
          property.MediaURL = firstMedia?.MediaURL || "";
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
