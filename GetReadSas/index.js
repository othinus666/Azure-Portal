const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require("@azure/storage-blob");

module.exports = async function (context, req) {
  try {
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.BLOB_CONTAINER_NAME || "media";
    if (!conn) throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING");

    const blobName = req.params.blobName;
    if (!blobName) return (context.res = { status: 400, body: { error: "blobName required" } });

    const match = conn.match(/AccountName=([^;]+);.*AccountKey=([^;]+)/);
    if (!match) throw new Error("Connection string must include AccountName and AccountKey");
    const accountName = match[1];
    const accountKey = match[2];
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

    const blobServiceClient = BlobServiceClient.fromConnectionString(conn);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlockBlobClient(blobName);

    const expiresOn = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    const sas = generateBlobSASQueryParameters({
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse("r"),
      startsOn: new Date(Date.now() - 60 * 1000),
      expiresOn
    }, sharedKeyCredential).toString();

    const viewUrl = `${blobClient.url}?${sas}`;

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { blobName, viewUrl, expiresAt: expiresOn.toISOString() }
    };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: { error: err.message } };
  }
};
