import { Readable } from "node:stream";
import { google } from "googleapis";

// GOOGLE_SERVICE_ACCOUNT_JSON holds the service account's full JSON key,
// base64-encoded — chosen over pasting raw multi-line JSON into an env var
// because most env var UIs (Vercel's dashboard included) handle a single
// base64 line far more reliably than embedded newlines/quotes.
//
// Base64-encode the downloaded key file before setting the env var:
//   macOS/Linux: base64 -w0 service-account.json
//   Windows PowerShell: [Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
function loadServiceAccountCredentials(): { client_email: string; private_key: string } {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!encoded) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  }
  const json = Buffer.from(encoded, "base64").toString("utf-8");
  const parsed = JSON.parse(json) as { client_email?: string; private_key?: string };
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email/private_key");
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

function requireFolderId(): string {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is not configured");
  }
  return folderId;
}

export type DriveUploadResult = { fileId: string; fileUrl: string };

// Uploads an in-memory mp3 buffer to the configured Drive folder. The
// service account must already have been granted access to that folder
// (share the folder with its client_email, same as sharing with a person)
// — that's a one-time Google Drive setup step, not something this code can
// do on its own.
//
// drive.file scope only (not full drive access): this app only ever
// creates files in a folder it's been explicitly shared into, never reads
// or lists anything else in the DJ's Drive.
export async function uploadToDrive(buffer: Buffer, fileName: string): Promise<DriveUploadResult> {
  const credentials = loadServiceAccountCredentials();
  const folderId = requireFolderId();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });

  const { data } = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: "audio/mpeg", body: Readable.from(buffer) },
    fields: "id, webViewLink",
  });

  if (!data.id) {
    throw new Error("Drive upload did not return a file id");
  }

  return { fileId: data.id, fileUrl: data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view` };
}
