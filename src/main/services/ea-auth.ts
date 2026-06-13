import axios from "axios";
import { session } from "electron";
import { logger } from "./logger";

/**
 * EA OAuth is a TWO-STEP flow. The mistake that produced
 * {"error":"invalid_client","code":101102} was pointing the interactive login
 * window straight at the token endpoint with client_id=ORIGIN_JS_SDK /
 * HXC_WEBCLIENT — those clients are only valid for the SILENT token exchange,
 * not for rendering the login page, so EA rejects the client_id outright.
 *
 * Correct flow (matches the EA App / community EA library plugins):
 *   1. LOGIN: render accounts.ea.com/connect/auth with a login-capable SPA
 *      client (ORIGIN_SPA_ID + display=junoWeb/login) and a real redirect_uri.
 *      The user signs in; EA sets the remid/sid session cookies on .ea.com and
 *      redirects to EA_LOGIN_REDIRECT.
 *   2. TOKEN: once those cookies exist, GET connect/auth with
 *      client_id=ORIGIN_JS_SDK&response_type=token&redirect_uri=nucleus:rest&
 *      prompt=none — EA answers with a JSON body {"access_token": ...} (no
 *      redirect, "REST mode"), which we parse from the page body.
 */
export const EA_AUTH_PARTITION = "persist:ea-auth";

// Where EA sends the browser after a successful interactive login. Detecting a
// navigation to this URL is our signal to run the silent token exchange.
export const EA_LOGIN_REDIRECT = "https://www.ea.com/login_check";

// Step 1 — interactive login page (login-capable SPA client).
export const EA_LOGIN_URL =
  "https://accounts.ea.com/connect/auth" +
  "?response_type=code" +
  "&client_id=ORIGIN_SPA_ID" +
  "&display=junoWeb/login" +
  "&locale=en_US" +
  "&release_type=prod" +
  `&redirect_uri=${encodeURIComponent(EA_LOGIN_REDIRECT)}`;

// Step 2 — silent token exchange (token-capable client + prompt=none).
export const EA_TOKEN_URL =
  "https://accounts.ea.com/connect/auth" +
  "?response_type=token" +
  "&client_id=ORIGIN_JS_SDK" +
  "&redirect_uri=nucleus:rest" +
  "&release_type=prod" +
  "&prompt=none" +
  "&locale=en_US";

export interface EaTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: string | number;
  error?: string;
  error_description?: string;
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
    const res = await axios.get<EaTokenResponse>(EA_TOKEN_URL, {
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
