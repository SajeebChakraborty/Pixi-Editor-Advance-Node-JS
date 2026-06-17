import { readFile } from "node:fs/promises";
import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const region = process.env.S3_REGION || "eu-north-1";
const bucket = process.env.S3_BUCKET_NAME || "pixigen-first";
const endpoint = process.env.S3_ENDPOINT;
const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  throw new Error(
    "Missing S3 credentials. Set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in .env.local.",
  );
}

const corsRules = JSON.parse(await readFile("scripts/s3-cors.json", "utf8"));

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  ...(endpoint
    ? {
        endpoint,
        forcePathStyle: true,
      }
    : {}),
});

await s3.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: corsRules,
    },
  }),
);

console.log(`Applied CORS configuration to ${bucket} in ${region}.`);
