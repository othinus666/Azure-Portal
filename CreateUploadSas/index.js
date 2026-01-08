const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require("@azure/storage-blob");
const { v4: uuidv4 } = require("uuid");

module.exports = async function (context, req) {
  try {
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.BLOB_CONTAINER_NAME || "media";
    if (!conn) throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING");

    const body = req.body || {};
    const fileName = (body.fileName || "file.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
    const contentType = body.contentType || "application/octet-stream";

    const mediaId = uuidv4();
    const blobName = `${mediaId}_${fileName}`;

    // Parse connection string to get account name/key
    const match = conn.match(/AccountName=([^;]+);.*AccountKey=([^;]+)/);
    if (!match) throw new Error("Connection string must include AccountName and AccountKey");
    const accountName = match[1];
    const accountKey = match[2];

    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobServiceClient = BlobServiceClient.fromConnectionString(conn);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();

    const expiresOn = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const sas = generateBlobSASQueryParameters({
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse("cw"), // create + write
      startsOn: new Date(Date.now() - 60 * 1000),
      expiresOn,
      contentType
    }, sharedKeyCredential).toString();

    const uploadUrl = `${containerClient.getBlockBlobClient(blobName).url}?${sas}`;

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { id: mediaId, blobName, uploadUrl, expiresAt: expiresOn.toISOString() }
    };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: { error: err.message } };
  }
};
