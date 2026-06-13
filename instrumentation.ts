export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { S3Storage } = await import("./lib/storage-s3");
  await S3Storage.checkConnection();
}
