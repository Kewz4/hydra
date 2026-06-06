import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, TextField } from "@renderer/components";
import { useAppSelector } from "@renderer/hooks";
import {
  CheckCircleFillIcon,
  PersonIcon,
  LinkExternalIcon,
} from "@primer/octicons-react";
import SteamLogo from "@renderer/assets/steam-logo.svg?react";
import EpicLogo from "@renderer/assets/epic-logo.svg?react";
import GogLogo from "@renderer/assets/gog-logo.svg?react";
import XboxLogo from "@renderer/assets/xbox-logo.svg?react";
import GameHubIcon from "@renderer/assets/icons/gamehub.svg?react";
import { AuthPage } from "@shared";
import "./onboarding.scss";

// Steps (account is gating: skip account → skip integrations)
type StepId = "welcome" | "account" | "steam" | "epic" | "gog" | "xbox" | "done";
const ALL_STEPS: StepId[] = ["welcome", "account", "steam", "epic", "gog", "xbox", "done"];
const INTEGRATION_STEPS: StepId[] = ["steam", "epic", "gog", "xbox"];

interface OnboardingProps {
  onComplete: () => void;
}

/** Extract Steam ID from a profile URL or return the value as-is. */
function parseSteamId(input: string): string {
  const trimmed = input.trim();
  // https://steamcommunity.com/profiles/76561198...
  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];
  // plain numeric ID
  if (/^\d{15,18}$/.test(trimmed)) return trimmed;
  return trimmed;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { t } = useTranslation("settings");
  const userPreferences = useAppSelector((state) => state.userPreferences.value);

  const [stepIndex, setStepIndex] = useState(0);

  // Steam
  const [steamInput, setSteamInput] = useState("");
  const [steamApiKey, setSteamApiKey] = useState("");
  const [steamLinked, setSteamLinked] = useState(false);
  const [steamBusy, setSteamBusy] = useState(false);
  const [steamError, setSteamError] = useState("");

  // Epic
  const [epicBusy, setEpicBusy] = useState(false);
  const [epicLinked, setEpicLinked] = useState(false);
  const [epicAccount, setEpicAccount] = useState<string | null>(null);

  // GOG
  const [gogBusy, setGogBusy] = useState(false);
  const [gogLinked, setGogLinked] = useState(false);
  const [gogUsername, setGogUsername] = useState<string | null>(null);

  // Xbox
  const [xboxBusy, setXboxBusy] = useState(false);
  const [xboxLinked, setXboxLinked] = useState(!!userPreferences?.xboxGamertag);
  const [xboxGamertag, setXboxGamertag] = useState(userPreferences?.xboxGamertag ?? null);

  const currentStep = ALL_STEPS[stepIndex];

  const next = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, ALL_STEPS.length - 1));
  }, []);

  const skipToEnd = useCallback(() => {
    setStepIndex(ALL_STEPS.indexOf("done"));
  }, []);

  const finish = useCallback(async () => {
    await window.electron.updateUserPreferences({ onboardingComplete: true });
    onComplete();
  }, [onComplete]);

  const handleAccountSignIn = () => {
    window.electron.openAuthWindow(AuthPage.SignIn);
    // Move to next step — the user can complete sign-in in the auth window
    next();
  };

  const handleSteamConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSteamError("");
    const steamId = parseSteamId(steamInput);
    if (!steamId || !steamApiKey.trim()) return;
    setSteamBusy(true);
    try {
      const summary = await window.electron.getSteamPlayerSummary(
        steamId,
        steamApiKey.trim()
      );
      if (!summary) {
        setSteamError("Steam account not found. Check your Steam ID and API key.");
        return;
      }
      await window.electron.updateUserPreferences({
        steamId,
        steamApiKey: steamApiKey.trim(),
      });
      setSteamLinked(true);
    } catch {
      setSteamError("Could not connect to Steam. Verify your credentials.");
    } finally {
      setSteamBusy(false);
    }
  };

  const handleEpicConnect = async () => {
    setEpicBusy(true);
    try {
      const status = await window.electron.getLegendaryStatus().catch(() => null);
      if (!status?.binaryFound) {
        await window.electron.installLegendary().catch(() => null);
      }
      const result = await window.electron.openLegendaryAuthWindow();
      if (result?.success) {
        setEpicLinked(true);
        setEpicAccount(result.account ?? "Epic");
      }
    } catch {
      // user can retry in Settings
    } finally {
      setEpicBusy(false);
    }
  };

  const handleGogConnect = async () => {
    setGogBusy(true);
    try {
      const result = await window.electron.openGogAuthWindow();
      if (result) {
        await window.electron.updateUserPreferences({
          gogRefreshToken: result.refresh_token,
        });
        setGogLinked(true);
        setGogUsername(result.username ?? "GOG User");
      }
    } catch {
      // user can retry in Settings
    } finally {
      setGogBusy(false);
    }
  };

  const handleXboxConnect = async () => {
    setXboxBusy(true);
    try {
      const result = await window.electron.openXboxAuthWindow();
      if (result?.success) {
        setXboxLinked(true);
        setXboxGamertag(result.gamertag ?? "Xbox User");
      }
    } catch {
      // user can retry in Settings
    } finally {
      setXboxBusy(false);
    }
  };

  // Dot indicators: only show for integration steps
  const dotSteps = INTEGRATION_STEPS;
  const showDots =
    currentStep !== "welcome" &&
    currentStep !== "account" &&
    currentStep !== "done";

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {/* Logo */}
        <div className="onboarding-logo">
          <GameHubIcon className="onboarding-logo__icon" />
          <h1>GameHub</h1>
          {currentStep === "welcome" && (
            <p>Your all-in-one game launcher</p>
          )}
        </div>

        {/* Progress dots (integration steps only) */}
        {showDots && (
          <div className="onboarding-steps">
            {dotSteps.map((s) => {
              const isActive = currentStep === s;
              const isDone =
                dotSteps.indexOf(s) < dotSteps.indexOf(currentStep as any);
              return (
                <div
                  key={s}
                  className={[
                    "onboarding-step-dot",
                    isActive ? "onboarding-step-dot--active" : "",
                    isDone ? "onboarding-step-dot--done" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              );
            })}
          </div>
        )}

        <div className="onboarding-body">

          {/* ── Welcome ── */}
          {currentStep === "welcome" && (
            <>
              <p className="onboarding-step-description">
                Let's get you set up. First we'll connect your GameHub account,
                then link your game libraries so everything shows up in one place.
                You can skip any step and configure it later in Settings.
              </p>
              <div className="onboarding-actions">
                <Button type="button" onClick={next}>
                  Get Started
                </Button>
              </div>
            </>
          )}

          {/* ── GameHub Account ── */}
          {currentStep === "account" && (
            <>
              <div className="onboarding-platform-hero">
                <GameHubIcon className="onboarding-platform-hero__logo" />
                <h2>GameHub Account</h2>
              </div>
              <p className="onboarding-step-description">
                Sign in or create a GameHub account to enable cloud saves,
                profiles, and cross-device sync. This is optional — you can
                use GameHub entirely offline.
              </p>
              <div className="onboarding-actions">
                <button
                  type="button"
                  className="onboarding-skip"
                  onClick={skipToEnd}
                >
                  Skip — use without account
                </button>
                <Button type="button" onClick={handleAccountSignIn}>
                  <PersonIcon size={14} />
                  Sign in / Register
                </Button>
              </div>
            </>
          )}

          {/* ── Steam ── */}
          {currentStep === "steam" && (
            <>
              <div className="onboarding-platform-hero">
                <SteamLogo className="onboarding-platform-hero__logo" />
                <h2>Steam</h2>
              </div>

              {steamLinked ? (
                <>
                  <div className="onboarding-connected-badge">
                    <CheckCircleFillIcon size={16} />
                    Steam connected — library will sync
                  </div>
                  <div className="onboarding-actions">
                    <Button type="button" onClick={next}>Continue</Button>
                  </div>
                </>
              ) : (
                <form className="onboarding-form" onSubmit={handleSteamConnect}>
                  <p className="onboarding-step-description">
                    Paste your Steam profile URL or numeric Steam ID, plus your
                    Steam Web API key.
                  </p>

                  <TextField
                    label="Steam Profile URL or ID"
                    value={steamInput}
                    onChange={(e) => setSteamInput(e.target.value)}
                    placeholder="https://steamcommunity.com/profiles/76561198… or 765611…"
                    hint="Paste your full profile URL — we'll extract the ID automatically"
                  />

                  <TextField
                    label="Steam Web API Key"
                    value={steamApiKey}
                    onChange={(e) => setSteamApiKey(e.target.value)}
                    type="password"
                    placeholder="Your 32-character API key"
                    hint={
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        Get a key at{" "}
                        <button
                          type="button"
                          className="onboarding-link"
                          onClick={() =>
                            window.electron.openExternal(
                              "https://steamcommunity.com/dev/apikey"
                            )
                          }
                        >
                          steamcommunity.com/dev/apikey
                          <LinkExternalIcon size={10} />
                        </button>
                      </span>
                    }
                  />

                  {steamError && (
                    <p style={{ color: "var(--color-danger, #f87171)", margin: 0, fontSize: "0.85rem" }}>
                      {steamError}
                    </p>
                  )}

                  <div className="onboarding-actions">
                    <button type="button" className="onboarding-skip" onClick={next}>
                      Skip for now
                    </button>
                    <Button
                      type="submit"
                      disabled={!steamInput.trim() || !steamApiKey.trim() || steamBusy}
                    >
                      {steamBusy ? "Connecting…" : "Connect Steam"}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* ── Epic ── */}
          {currentStep === "epic" && (
            <>
              <div className="onboarding-platform-hero">
                <EpicLogo className="onboarding-platform-hero__logo" />
                <h2>Epic Games</h2>
              </div>

              <p className="onboarding-step-description">
                Connect your Epic Games account via Legendary (open-source CLI).
                GameHub will install Legendary automatically.
              </p>

              {epicLinked ? (
                <>
                  <div className="onboarding-connected-badge">
                    <CheckCircleFillIcon size={16} />
                    Signed in as {epicAccount}
                  </div>
                  <div className="onboarding-actions">
                    <Button type="button" onClick={next}>Continue</Button>
                  </div>
                </>
              ) : (
                <div className="onboarding-actions">
                  <button
                    type="button"
                    className="onboarding-skip"
                    onClick={next}
                    disabled={epicBusy}
                    style={{ opacity: epicBusy ? 0.4 : 1, pointerEvents: epicBusy ? 'none' : 'auto' }}
                  >
                    Skip for now
                  </button>
                  <Button
                    type="button"
                    onClick={handleEpicConnect}
                    disabled={epicBusy}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <PersonIcon size={14} />
                    {epicBusy ? "Opening Epic login…" : "Connect Epic"}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── GOG ── */}
          {currentStep === "gog" && (
            <>
              <div className="onboarding-platform-hero">
                <GogLogo className="onboarding-platform-hero__logo" />
                <h2>GOG</h2>
              </div>

              <p className="onboarding-step-description">
                Connect your GOG account to import your DRM-free game library.
                A sign-in window will open in your browser.
              </p>

              {gogLinked ? (
                <>
                  <div className="onboarding-connected-badge">
                    <CheckCircleFillIcon size={16} />
                    Connected as {gogUsername}
                  </div>
                  <div className="onboarding-actions">
                    <Button type="button" onClick={next}>Continue</Button>
                  </div>
                </>
              ) : (
                <div className="onboarding-actions">
                  <button
                    type="button"
                    className="onboarding-skip"
                    onClick={next}
                    disabled={gogBusy}
                    style={{ opacity: gogBusy ? 0.4 : 1, pointerEvents: gogBusy ? 'none' : 'auto' }}
                  >
                    Skip for now
                  </button>
                  <Button
                    type="button"
                    onClick={handleGogConnect}
                    disabled={gogBusy}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <PersonIcon size={14} />
                    {gogBusy ? "Waiting for sign-in…" : "Connect GOG"}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── Xbox ── */}
          {currentStep === "xbox" && (
            <>
              <div className="onboarding-platform-hero">
                <XboxLogo className="onboarding-platform-hero__logo" />
                <h2>Xbox / Game Pass</h2>
              </div>

              <p className="onboarding-step-description">
                Sign in with your Microsoft account to import your Xbox and
                Game Pass PC library. A sign-in window will open.
              </p>

              {xboxLinked ? (
                <>
                  <div className="onboarding-connected-badge">
                    <CheckCircleFillIcon size={16} />
                    Signed in as {xboxGamertag}
                  </div>
                  <div className="onboarding-actions">
                    <Button type="button" onClick={next}>Continue</Button>
                  </div>
                </>
              ) : (
                <div className="onboarding-actions">
                  <button
                    type="button"
                    className="onboarding-skip"
                    onClick={next}
                    disabled={xboxBusy}
                    style={{ opacity: xboxBusy ? 0.4 : 1, pointerEvents: xboxBusy ? 'none' : 'auto' }}
                  >
                    Skip for now
                  </button>
                  <Button
                    type="button"
                    onClick={handleXboxConnect}
                    disabled={xboxBusy}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <PersonIcon size={14} />
                    {xboxBusy ? "Waiting for sign-in…" : "Connect Xbox"}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── Done ── */}
          {currentStep === "done" && (
            <>
              <p
                className="onboarding-step-description"
                style={{ textAlign: "center", fontSize: "1rem" }}
              >
                You're all set!
                <br />
                <br />
                Your libraries will sync in the background. You can connect
                more services anytime from{" "}
                <strong>Settings → Integrations</strong>.
              </p>
              <div className="onboarding-actions" style={{ justifyContent: "center" }}>
                <Button type="button" onClick={finish}>
                  Launch GameHub
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
