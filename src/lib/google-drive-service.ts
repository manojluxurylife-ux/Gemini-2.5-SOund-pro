export class GoogleDriveService {
  private static instance: GoogleDriveService;
  private accessToken: string | null = null;
  private fileName = 'nexus_justice.sqlite';

  private constructor() {}

  public static getInstance(): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService();
    }
    return GoogleDriveService.instance;
  }

  public setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async getHeaders() {
    if (!this.accessToken) throw new Error("No Google Drive access token");
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  public async findFile() {
    const headers = await this.getHeaders();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${this.fileName}'&spaces=drive`, {
      headers
    });
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  }

  public async uploadFile(binaryData: Uint8Array) {
    const headers = await this.getHeaders();
    const existingFile = await this.findFile();

    const metadata = {
      name: this.fileName,
      mimeType: 'application/x-sqlite3'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([binaryData], { type: 'application/x-sqlite3' }));

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (existingFile) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
      method = 'PATCH';
    }

    const response = await fetch(url, {
      method,
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
      body: form
    });

    return await response.json();
  }

  // Upload any file with a custom name and mimeType (used for Gemma3n model saves)
  public async uploadFileWithName(binaryData: Uint8Array, fileName: string, mimeType: string = 'application/octet-stream') {
    if (!this.accessToken) throw new Error("No Google Drive access token");

    // Check if file already exists
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(fileName)}'&spaces=drive&fields=files(id,name)`,
      { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
    );
    const listData = await listRes.json();
    const existingFile = listData.files && listData.files.length > 0 ? listData.files[0] : null;

    const metadata = { name: fileName, mimeType };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([binaryData], { type: mimeType }));

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';
    if (existingFile) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
      method = 'PATCH';
    }

    const response = await fetch(url, {
      method,
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
      body: form
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Drive upload failed: ${err}`);
    }
    return await response.json();
  }

  public async downloadFile() {
    const existingFile = await this.findFile();
    if (!existingFile) return null;

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });

    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
}
