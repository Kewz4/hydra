import axios from "axios";
import { session } from "electron";
import { logger } from "./logger";

/**
 * EA OAuth via the public ORIGIN_JS_SDK client. With redirect_uri=nucleus:rest
 * the auth endpoint does NOT redirect — it answers with a JSON body
 * ({"access_token": ...}) once the browser session is authenticated, which is
 * why the auth window must parse the page body rather than watch navigation.
 */
export const EA_AUTH_PARTITION = "persist:ea-auth";

export const EA_TOKEN_URL =
  "https://accounts.ea.com/connect/auth" +
  "?response_type=token" +
  "&client_id=ORIGIN_JS_SDK" +
  "&redirect_uri=nucleus:rest" +
  "&release_type=prod" +
  "&locale=en_US";

export interface EaTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: string | number;
  error?: string;
}

export const parseEaAuthJson = (text: string): EaTokenResponse | null => {
  try {
    const parsed = JSON.parse(text.trim());
    return parsed && typeof parsed === "object"
      ? (parsed as EaTokenResponse)
      : null;
  } catch {
    return null;
  }
};

/**
 * Re-acquire an access token using the remid/sid cookies persisted in the
 * auth window's session partition — lets library syncs keep working after
 * the short-lived (1h) access token expires, without prompting the user.
 */
export const refreshEaTokenSilently = async (): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> => {
  try {
    const ses = session.fromPartition(EA_AUTH_PARTITION);
    const cookies = await ses.cookies.get({ domain: ".ea.com" });
    if (cookies.length === 0) return null;

    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const res = await axios.get<EaTokenResponse>(`${EA_TOKEN_URL}&prompt=none`, {
      headers: { Cookie: cookieHeader },
      timeout: 15_000,
    });

    const data = res.data;
    if (data?.access_token) {
      return {
        accessToken: data.access_token,
        expiresIn: Number(data.expires_in ?? 3600),
      };
    }
    return null;
  } catch (err) {
    logger.warn("EA silent token refresh failed", err);
    return null;
  }
};
