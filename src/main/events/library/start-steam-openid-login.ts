import { registerEvent } from "../register-event";
import { shell } from "electron";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { logger } from "@main/services";

const OPENID_STEAM_URL = "https://steamcommunity.com/openid/login";
const STEAM_ID_REGEX = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/;

function verifyOpenId(
  params: URLSearchParams,
  _realm: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const verifyParams = new URLSearchParams(params);
    verifyParams.set("openid.mode", "check_authentication");

    const body = verifyParams.toString();
    const req = https.request(
      OPENID_STEAM_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve(data.includes("is_valid:true"));
        });
      }
    );
    req.on("error", () => resolve(false));
    req.write(body);
    req.end();
  });
}

const startSteamOpenIdLogin = async (
  _event: Electron.IpcMainInvokeEvent
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const server = http.createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const port = address.port;
      const callbackUrl = `http://localhost:${port}/callback`;
      const realm = `http://localhost:${port}/`;

      const loginUrl = new URL(OPENID_STEAM_URL);
      loginUrl.searchParams.set(
        "openid.ns",
        "http://specs.openid.net/auth/2.0"
      );
      loginUrl.searchParams.set("openid.mode", "checkid_setup");
      loginUrl.searchParams.set("openid.return_to", callbackUrl);
      loginUrl.searchParams.set("openid.realm", realm);
      loginUrl.searchParams.set(
        "openid.identity",
        "http://specs.openid.net/auth/2.0/identifier_select"
      );
      loginUrl.searchParams.set(
        "openid.claimed_id",
        "http://specs.openid.net/auth/2.0/identifier_select"
      );

      shell.openExternal(loginUrl.toString());

      const timeout = setTimeout(
        () => {
          server.close();
          reject(new Error("Steam login timed out after 5 minutes"));
        },
        5 * 60 * 1000
      );

      server.on("request", async (req, res) => {
        try {
          const reqUrl = new URL(`http://localhost${req.url}`);
          if (reqUrl.pathname !== "/callback") {
            res.writeHead(404);
            res.end("Not found");
            return;
          }

          const params = reqUrl.searchParams;
          const claimedId = params.get("openid.claimed_id") ?? "";
          const match = claimedId.match(STEAM_ID_REGEX);
          if (!match) {
            res.writeHead(400);
            res.end("Steam login failed: could not extract SteamID");
            clearTimeout(timeout);
            server.close();
            reject(new Error("Could not extract SteamID from OpenID response"));
            return;
          }

          const steamId = match[1];

          // Verify the response with Steam
          const valid = await verifyOpenId(params, realm);
          if (!valid) {
            res.writeHead(400);
            res.end("Steam login failed: OpenID verification failed");
            clearTimeout(timeout);
            server.close();
            reject(new Error("OpenID verification failed"));
            return;
          }

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#1a1a2e;color:#fff">
              <h2>&#10003; Steam account linked!</h2>
              <p>SteamID: ${steamId}</p>
              <p>You can close this window and return to GameHub.</p>
            </body></html>
          `);

          clearTimeout(timeout);
          server.close();
          resolve(steamId);
        } catch (err) {
          logger.error("Steam OpenID callback error", err);
          res.writeHead(500);
          res.end("Internal error");
          clearTimeout(timeout);
          server.close();
          reject(err);
        }
      });
    });

    server.on("error", (err) => {
      reject(err);
    });
  });
};

registerEvent("startSteamOpenIdLogin", startSteamOpenIdLogin);
