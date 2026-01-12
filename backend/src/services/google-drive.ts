import { googleOAuthService } from './google-oauth';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

export class GoogleDriveService {
  private async getHeaders(): Promise<Headers> {
    const accessToken = await googleOAuthService.getValidAccessToken();
    if (!accessToken) {
      throw new Error('Not connected to Google Drive');
    }
    return new Headers({
      Authorization: `Bearer ${accessToken}`,
    });
  }

  async listFiles(query?: string, pageToken?: string, pageSize = 20): Promise<DriveListResponse> {
    const headers = await this.getHeaders();

    const params = new URLSearchParams({
      pageSize: String(pageSize),
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)',
    });

    // Default: show documents and text files only (useful for threat modeling context)
    let q = "mimeType contains 'text/' or mimeType contains 'document' or mimeType = 'application/pdf'";
    if (query) {
      q = `(${q}) and name contains '${query}'`;
    }
    params.set('q', q);

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(`${DRIVE_API_BASE}/files?${params.toString()}`, { headers });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list files: ${error}`);
    }

    return response.json();
  }

  async getFileContent(fileId: string): Promise<{ content: string; mimeType: string; name: string }> {
    const headers = await this.getHeaders();

    // First get file metadata
    const metaResponse = await fetch(`${DRIVE_API_BASE}/files/${fileId}?fields=name,mimeType`, { headers });
    if (!metaResponse.ok) {
      throw new Error('Failed to get file metadata');
    }
    const meta = await metaResponse.json();

    // For Google Docs, Sheets, etc - export as plain text
    let downloadUrl = `${DRIVE_API_BASE}/files/${fileId}`;
    if (meta.mimeType.startsWith('application/vnd.google-apps.')) {
      downloadUrl += '/export?mimeType=text/plain';
    } else {
      downloadUrl += '?alt=media';
    }

    const response = await fetch(downloadUrl, { headers });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to download file: ${error}`);
    }

    const content = await response.text();
    return {
      content,
      mimeType: meta.mimeType,
      name: meta.name,
    };
  }

  async getFileMetadata(fileId: string): Promise<DriveFile> {
    const headers = await this.getHeaders();

    const response = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,webViewLink`,
      { headers }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get file metadata: ${error}`);
    }

    return response.json();
  }
}

export const googleDriveService = new GoogleDriveService();
