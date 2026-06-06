import axios from "axios";
import { logger } from "./logger";

const CLIENT_ID = "46899977096215655";
const CLIENT_SECRET = "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9";
// GOG's public client only accepts this exact redirect URI
const REDIRECT_URI = "https://embed.gog.com/on_login_success?origin=client";

export const GOG_AUTH_URL =
  `https://auth.gog.com/auth?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code&layout=client2`;

export interface GogTokens {
  access_token: string;
  refresh_token: string;
  user_id: string;
  username: string;
}

export interface GogOwnedGame {
  id: number;
  title: string;
  image: string;
  url: string;
}

export const exchangeGogCode = async (code: string): Promise<GogTokens> => {
  const response = await axios.get("https://auth.gog.com/token", {
    params: {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    },
  });

  const { access_token, refresh_token, user_id, username } = response.data;
  return { access_token, refresh_token, user_id, username };
};

export const refreshGogToken = async (
  refreshToken: string
): Promise<GogTokens> => {
  const response = await axios.get("https://auth.gog.com/token", {
    params: {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
  });

  const { access_token, refresh_token: newRefresh, user_id, username } = response.data;
  return {
    access_token,
    refresh_token: newRefresh ?? refreshToken,
    user_id,
    username,
  };
};

export const getGogUserInfo = async (
  accessToken: string
): Promise<{ userId: string; username: string } | null> => {
  try {
    const response = await axios.get("https://embed.gog.com/userData.json", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      userId: String(response.data.userId),
      username: response.data.username,
    };
  } catch (err) {
    logger.error("getGogUserInfo failed", err);
    return null;
  }
};

export const getGogOwnedGameIds = async (
  accessToken: string
): Promise<number[]> => {
  const response = await axios.get("https://embed.gog.com/user/data/games", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data?.owned ?? [];
};

export const getGogGameDetails = async (
  productId: number
): Promise<{ id: number; title: string; images: { logo2x: string; background: string } } | null> => {
  try {
    const response = await axios.get(
      `https://api.gog.com/products/${productId}`,
      { params: { expand: "downloads" } }
    );
    return response.data;
  } catch {
    return null;
  }
};
