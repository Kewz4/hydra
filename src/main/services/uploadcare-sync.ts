import axios from "axios";
import FormData from "form-data";
import fs from "node:fs";
import crypto from "node:crypto";
import type { GameArtifact, GameArtifactWithGame, GameShop } from "@types";
import { logger } from "./logger";

const UPLOAD_BASE = "https://upload.uploadcare.com/base/";
const API_BASE = "https://api.uploadcare.com";
const CDN_BASE = "https://ucarecdn.com";

const PUBLIC_KEY = "4d9173a6d85878abcd29";
const SECRET_KEY = "4d7348da747422d46005";

const AUTH_HEADER = `Uploadcare.Simple ${PUBLIC_KEY}:${SECRET_KEY}`;

export class UploadcareSync {
  /** Upload a file and tag it with metadata for later lookup. Returns the Uploadcare UUID. */
  static async uploadFile(
    filePath: string,
    metadata: Record<string, string>
  ): Promise<string> {
    const form = new FormData();
    form.append("UPLOADCARE_PUB_KEY", PUBLIC_KEY);
    form.append("UPLOADCARE_STORE", "1");
    form.append("file", fs.createReadStream(filePath), {
      filename: `${metadata.shop}-${metadata.objectId}-${Date.now()}.tar`,
      contentType: "application/tar",
    });

    // Embed metadata directly in the upload form so it's always stored
    for (const [key, value] of Object.entries(metadata)) {
      form.append(`metadata[${key}]`, value);
    }

    const uploadRes = await axios.post<{ file: string }>(UPLOAD_BASE, form, {
      headers: form.getHeaders(),
      timeout: 120_000,
    });

    const uuid = uploadRes.data.file;

    // Also PATCH metadata for APIs that need it via the REST endpoint
    try {
      await axios.patch(`${API_BASE}/files/${uuid}/metadata/`, metadata, {
        headers: {
          Authorization: AUTH_HEADER,
          "Content-Type": "application/json",
          Accept: "application/vnd.uploadcare-v0.7+json",
        },
      });
    } catch (metaErr) {
      logger.error(`Uploadcare: metadata patch failed for ${uuid}`, metaErr);
    }

    logger.log(`Uploadcare: uploaded ${uuid} with metadata`, metadata);
    return uuid;
  }

  /** List save artifacts for a game, newest first. */
  static async listArtifacts(
    userId: string,
    shop: GameShop,
    objectId: string
  ): Promise<GameArtifact[]> {
    const qs = `metadata[userId]=${encodeURIComponent(userId)}&metadata[shop]=${encodeURIComponent(shop)}&metadata[objectId]=${encodeURIComponent(objectId)}&ordering=-datetime_uploaded&limit=20`;
    const res = await axios.get(`${API_BASE}/files/?${qs}`, {
      headers: {
        Authorization: AUTH_HEADER,
        Accept: "application/vnd.uploadcare-v0.7+json",
      },
      timeout: 15_000,
    });

    const results: any[] = res.data.results ?? [];
    return results
      .filter((f) => {
        const meta = f.metadata ?? {};
        if (meta.shop && meta.objectId) {
          return meta.shop === shop && meta.objectId === objectId;
        }
        // Fallback: parse filename — format is `{shop}-{objectId}-{timestamp}.tar`
        const filename: string = (f.original_filename as string) ?? "";
        return filename.startsWith(`${shop}-${objectId}-`);
      })
      .map((f) => ({
        id: f.uuid as string,
        artifactLengthInBytes: f.size as number,
        downloadOptionTitle:
          (f.metadata?.downloadOptionTitle as string) ?? null,
        createdAt: f.datetime_uploaded as string,
        updatedAt: f.datetime_uploaded as string,
        hostname: (f.metadata?.hostname as string) ?? "",
        downloadCount: 0,
        label: (f.metadata?.label as string) ?? undefined,
        isFrozen: false,
      }));
  }

  /** List all save artifacts across all games for a user, newest first. */
  static async listAllArtifacts(
    userId: string
  ): Promise<GameArtifactWithGame[]> {
    const qs = `metadata[userId]=${encodeURIComponent(userId)}&ordering=-datetime_uploaded&limit=100`;
    const res = await axios.get(`${API_BASE}/files/?${qs}`, {
      headers: {
        Authorization: AUTH_HEADER,
        Accept: "application/vnd.uploadcare-v0.7+json",
      },
      timeout: 20_000,
    });

    const results: any[] = res.data.results ?? [];
    return results
      .filter((f) => f.metadata?.shop && f.metadata?.objectId)
      .map((f) => ({
        id: f.uuid as string,
        artifactLengthInBytes: f.size as number,
        downloadOptionTitle:
          (f.metadata?.downloadOptionTitle as string) ?? null,
        createdAt: f.datetime_uploaded as string,
        updatedAt: f.datetime_uploaded as string,
        hostname: (f.metadata?.hostname as string) ?? "",
        downloadCount: 0,
        label: (f.metadata?.label as string) ?? undefined,
        isFrozen: false,
        shop: f.metadata.shop as GameShop,
        objectId: f.metadata.objectId as string,
        gameTitle: "",
        gameIconUrl: null,
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
    await axios.delete(`${API_BASE}/files/${uuid}/`, {
      headers: {
        Authorization: AUTH_HEADER,
        Accept: "application/vnd.uploadcare-v0.7+json",
      },
    });
    logger.log(`Uploadcare: deleted ${uuid}`);
  }

  /** Generate a stable user ID to namespace uploads. */
  static generateUserId(): string {
    return crypto.randomUUID();
  }
}
