import axios from "axios";

export interface XboxGame {
  productId: string;
  title: string;
  packageFamilyName: string;
  coverUrl: string | null;
  description: string | null;
}

const GAMEPASS_CATALOG_URL =
  "https://catalog.gamepass.com/sigls/v2?id=fdd9e2a7-0fee-49f6-ad69-4354098401ff&language=en-us&market=US";

const DISPLAY_CATALOG_URL =
  "https://displaycatalog.mp.microsoft.com/v7.0/products";

function pickImageUrl(images: any[]): string | null {
  if (!Array.isArray(images)) return null;
  const priority = ["Poster", "BoxArt", "SuperHeroArt", "Logo"];
  for (const purpose of priority) {
    const img = images.find((i: any) => i.ImagePurpose === purpose);
    if (img?.Uri) {
      const uri: string = img.Uri;
      return uri.startsWith("//") ? `https:${uri}` : uri;
    }
  }
  const first = images[0];
  if (!first?.Uri) return null;
  const uri: string = first.Uri;
  return uri.startsWith("//") ? `https:${uri}` : uri;
}

export async function getGamePassCatalog(): Promise<XboxGame[]> {
  const catalogRes = await axios.get<any[]>(GAMEPASS_CATALOG_URL, {
    timeout: 15000,
  });

  const productIds: string[] = catalogRes.data
    .filter((entry: any) => entry.id)
    .map((entry: any) => entry.id as string);

  const games: XboxGame[] = [];
  const BATCH = 20;

  for (let i = 0; i < productIds.length; i += BATCH) {
    const batch = productIds.slice(i, i + BATCH);
    try {
      const detailRes = await axios.get(DISPLAY_CATALOG_URL, {
        params: {
          bigIds: batch.join(","),
          market: "US",
          languages: "en-us",
          "MS-CV": "F.1",
        },
        timeout: 15000,
      });

      const products: any[] = detailRes.data?.Products ?? [];
      for (const product of products) {
        // Skip add-ons
        if (product.ProductBSchema === "ProductAddOn;3") continue;

        const pfn: string =
          product.Properties?.PackageFamilyName ?? "";
        // Skip bundles/collections with no launchable package
        if (!pfn) continue;

        const id: string = product.ProductId;
        const title: string =
          product.LocalizedProperties?.[0]?.ProductTitle ?? id;
        const description: string | null =
          product.LocalizedProperties?.[0]?.ShortDescription ?? null;
        const images: any[] =
          product.LocalizedProperties?.[0]?.Images ?? [];
        const coverUrl = pickImageUrl(images);

        games.push({ productId: id, title, packageFamilyName: pfn, coverUrl, description });
      }
    } catch {
      // skip failed batch
    }
  }

  return games;
}

export const XBOX_AUTH_URL =
  "https://login.live.com/oauth20_authorize.srf?" +
  new URLSearchParams({
    client_id: "000000004C12AE6F",
    redirect_uri: "https://login.live.com/oauth20_desktop.srf",
    response_type: "token",
    scope: "service::user.auth.xboxlive.com::MBI_SSL",
    display: "touch",
    locale: "en",
  }).toString();
