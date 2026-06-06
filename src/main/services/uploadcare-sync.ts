import axios from "axios";
import FormData from "form-data";
import fs from "node:fs";
import crypto from "node:crypto";
import type { GameArtifact, GameShop } from "@types";
import { logger } from "./logger";

const UPLOAD_BASE = "https://upload.uploadcare.com/base/";
const API_BASE = "https://api.uploadcare.com";
const CDN_BASE = "https://ucarecdn.com";

export class UploadcareSync {
  private static publicKey: string | null = null;
  private static secretKey: string | null = null;

  static configure(publicKey: string | null, secretKey: string | null) {
    this.publicKey = publicKey ?? null;
    this.secretKey = secretKey ?? null;
  }

  static isConfigured() {
    return !!(this.publicKey && this.secretKey);
  }

  private static authHeader() {
    return `Uploadcare.Simple ${this.publicKey}:${this.secretKey}`;
  }

  /** Upload a file and tag it with metadata for later lookup. Returns the Uploadcare UUID. */
  static async uploadFile(
    filePath: string,
    metadata: Record<string, string>
  ): Promise<string> {
    if (!this.publicKey || !this.secretKey) {
      throw new Error("Uploadcare keys not configured");
    }

    const form = new FormData();
    form.append("UPLOADCARE_PUB_KEY", this.publicKey);
    form.append("UPLOADCARE_STORE", "1");
    form.append("file", fs.createReadStream(filePath), {
      filename: `${metadata.shop}-${metadata.objectId}-${Date.now()}.tar`,
      contentType: "application/tar",
    });

    const uploadRes = await axios.post<{ file: string }>(UPLOAD_BASE, form, {
      headers: form.getHeaders(),
      timeout: 120_000,
    });

    const uuid = uploadRes.data.file;

    // Attach metadata via management API
    await axios.patch(
      `${API_BASE}/files/${uuid}/metadata/`,
      metadata,
      {
        headers: {
          Authorization: this.authHeader(),
          "Content-Type": "application/json",
          Accept: "application/vnd.uploadcare-v0.7+json",
        },
      }
    );

    logger.log(`Uploadcare: uploaded ${uuid} with metadata`, metadata);
    return uuid;
  }

  /** List save artifacts for a game, newest first. */
  static async listArtifacts(
    userId: string,
    shop: GameShop,
    objectId: string
  ): Promise<GameArtifact[]> {
    if (!this.publicKey || !this.secretKey) return [];

    const res = await axios.get(`${API_BASE}/files/`, {
      params: {
        "metadata[userId]": userId,
        "metadata[shop]": shop,
        "metadata[objectId]": objectId,
        ordering: "-datetime_uploaded",
        limit: 20,
      },
      headers: {
        Authorization: this.authHeader(),
        Accept: "application/vnd.uploadcare-v0.7+json",
      },
      timeout: 15_000,
    });

    const results: any[] = res.data.results ?? [];
    return results.map((f) => ({
      id: f.uuid as string,
      artifactLengthInBytes: f.size as number,
      downloadOptionTitle: (f.metadata?.downloadOptionTitle as string) ?? null,
      createdAt: f.datetime_uploaded as string,
      updatedAt: f.datetime_uploaded as string,
      hostname: (f.metadata?.hostname as string) ?? "",
      downloadCount: 0,
      label: (f.metadata?.label as string) ?? undefined,
      isFrozen: false,
    }));
  }

  /** Download a file by UUID to a local path. */
  static async downloadFile(uuid: string, destPath: string): Promise<void> {
    const res = await axios.get(`${CDN_BASE}/${uuid}/`, {
      responseType: "arraybuffer",
      timeout: 120_000,
    });
    await fs.promises.writeFile(destPath, Buffer.from(res.data as ArrayBuffer));
    logger.log(`Uploadcare: downloaded ${uuid} → ${destPath}`);
  }

  /** Delete a file by UUID. */
  static async deleteFile(uuid: string): Promise<void> {
    if (!this.publicKey || !this.secretKey) return;
    await axios.delete(`${API_BASE}/files/${uuid}/`, {
      headers: {
        Authorization: this.authHeader(),
        Accept: "application/vnd.uploadcare-v0.7+json",
      },
    });
    logger.log(`Uploadcare: deleted ${uuid}`);
  }

  /** Get or create a stable user ID stored in preferences. */
  static generateUserId(): string {
    return crypto.randomUUID();
  }
}
