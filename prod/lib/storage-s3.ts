import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.S3_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  // If using a custom endpoint (like MinIO or R2), otherwise comment out
  // endpoint: process.env.S3_ENDPOINT
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "pixigen-first";

export class S3Storage {
  /**
   * Upload a file to S3
   */
  static async uploadFile(file: File | Buffer, fileName: string, contentType: string): Promise<string | null> {
    try {
      const body = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: body,
        ContentType: contentType,
      });

      await s3Client.send(command);

      // Construct public URL
      // https://BUCKET.s3.REGION.amazonaws.com/KEY
      const url = `https://${BUCKET_NAME}.s3.${process.env.S3_REGION || "eu-north-1"}.amazonaws.com/${fileName}`;
      return url;
    } catch (error) {
      console.error("Error uploading to S3:", error);
      return null;
    }
  }

  /**
   * Delete a file from S3
   */
  static async deleteFile(fileName: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error("Error deleting from S3:", error);
      return false;
    }
  }

  /**
   * Get public URL (helper)
   */
  static getPublicUrl(fileName: string): string {
    return `https://${BUCKET_NAME}.s3.${process.env.S3_REGION || "eu-north-1"}.amazonaws.com/${fileName}`;
  }
}
