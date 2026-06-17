import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env.S3_REGION || "eu-north-1";
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "pixigen-first";
const ENDPOINT = process.env.S3_ENDPOINT;
const PUBLIC_URL = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
type PresignClient = Parameters<typeof getSignedUrl>[0];

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  ...(ENDPOINT
    ? {
        endpoint: ENDPOINT,
        forcePathStyle: true,
      }
    : {}),
});

const formatStorageError = (error: unknown) => {
  if (!(error instanceof Error)) return error;

  const storageError = error as Error & {
    $metadata?: {
      httpStatusCode?: number;
      requestId?: string;
    };
  };

  return {
    name: storageError.name,
    message: storageError.message,
    statusCode: storageError.$metadata?.httpStatusCode,
    requestId: storageError.$metadata?.requestId,
  };
};

export class S3Storage {
  /**
   * Verify credentials, endpoint, and bucket access without modifying data.
   */
  static async checkConnection(): Promise<boolean> {
    try {
      await s3Client.send(
        new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          MaxKeys: 1,
        }),
      );

      console.info(
        `[S3] Storage connected successfully (bucket: ${BUCKET_NAME}, region: ${REGION})`,
      );
      return true;
    } catch (error) {
      console.error(
        `[S3] Storage connection failed (bucket: ${BUCKET_NAME}, region: ${REGION})`,
        formatStorageError(error),
      );
      return false;
    }
  }

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

      console.info(
        `[S3] Upload successful (bucket: ${BUCKET_NAME}, key: ${fileName}, bytes: ${body.byteLength})`,
      );
      return this.getPublicUrl(fileName);
    } catch (error) {
      console.error("[S3] Upload failed:", formatStorageError(error));
      return null;
    }
  }

  /**
   * Create a short-lived browser upload URL without exposing S3 credentials.
   */
  static async createPresignedUploadUrl(
    fileName: string,
    contentType: string,
  ): Promise<string | null> {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        ContentType: contentType,
      });

      return await getSignedUrl(s3Client as unknown as PresignClient, command, {
        expiresIn: 60 * 5,
      });
    } catch (error) {
      console.error("[S3] Presign failed:", formatStorageError(error));
      return null;
    }
  }

  /**
   * Read a private object for authenticated server-side downloads.
   */
  static async getFile(fileName: string, range?: string | null) {
    try {
      const result = await s3Client.send(
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
          ...(range ? { Range: range } : {}),
        }),
      );

      if (!result.Body) {
        throw new Error("Storage returned an empty response body");
      }

      return {
        body: result.Body.transformToWebStream(),
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        contentRange: result.ContentRange,
        acceptRanges: result.AcceptRanges,
      };
    } catch (error) {
      console.error(
        `[S3] Download failed (bucket: ${BUCKET_NAME}, key: ${fileName})`,
        formatStorageError(error),
      );
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
      console.error("[S3] Delete failed:", formatStorageError(error));
      return false;
    }
  }

  /**
   * Get public URL (helper)
   */
  static getPublicUrl(fileName: string): string {
    if (PUBLIC_URL) {
      return `${PUBLIC_URL}/${fileName}`;
    }

    return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileName}`;
  }
}
