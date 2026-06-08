import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, TextField } from "@renderer/components";
import { useAppSelector } from "@renderer/hooks";
import {
  CheckCircleFillIcon,
  PersonIcon,
  LinkExternalIcon,
  BellIcon,
  GearIcon,
} from "@primer/octicons-react";
import SteamLogo from "@renderer/assets/steam-logo.svg?react";
import EpicLogo from "@renderer/assets/epic-logo.svg?react";
import GogLogo from "@renderer/assets/gog-logo.svg?react";
import XboxLogo from "@renderer/assets/xbox-logo.svg?react";
import GameHubIcon from "@renderer/assets/icons/gamehub.svg?react";
import { AuthPage } from "@shared";
import { orderBy } from "lodash-es";
import languageResources from "@locales";
import "./onboarding.scss";

type StepId =
  | "welcome"
  | "language"
  | "install-path"
  | "account"
  | "steam"
  | "epic"
  | "gog"
  | "xbox"
  | "notifications"
  | "startup"
  | "done";

const ALL_STEPS: StepId[] = [
  "welcome",
  "language",
  "install-path",
  "account",
  "steam",
  "epic",
  "gog",
  "xbox",
  "notifications",
  "startup",
  "done",
];
const INTEGRATION_STEPS: StepId[] = ["steam", "epic", "gog", "xbox"];

interface OnboardingProps {
  onComplete: () => void;
}

function parseSteamId(input: string): string {
  const trimmed = input.trim();
  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];
  if (/^\d{15,18}$/.test(trimmed)) return trimmed;
  return trimmed;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { t, i18n } = useTranslation("settings");
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const [stepIndex, setStepIndex] = useState(0);

  // Language
  const languageOptions = orderBy(
    Object.entries(languageResources).map(([option, value]) => ({
      option,
      nativeName: value.language_name as string,
    })),
    "nativeName"
  );
  const [selectedLanguage, setSelectedLanguage] = useState(
    userPreferences?.language ?? "en"
  );

  // Install path
  const [installPath, setInstallPath] = useState("");
  const [defaultInstallPath, setDefaultInstallPath] = useState("");

  // Account
  const [accountWindowOpen, setAccountWindowOpen] = useState(false);
  const [accountLinked, setAccountLinked] = useState(false);

  // Steam
  const [steamInput, setSteamInput] = useState("");
  const [steamApiKey, setSteamApiKey] = useState("");
  const [steamLinked, setSteamLinked] = useState(false);
  const [steamBusy, setSteamBusy] = useState(false);
  const [steamError, setSteamError] = useState("");
  const [steamOpenIdBusy, setSteamOpenIdBusy] = useState(false);
  const [steamProfile, setSteamProfile] = useState<{
    personaname: string;
    avatarfull: string;
  } | null>(null);

  // Epic
  const [epicBusy, setEpicBusy] = useState(false);
  const [epicWindowOpen, setEpicWindowOpen] = useState(false);
  const [epicLinked, setEpicLinked] = useState(false);
  const [epicAccount, setEpicAccount] = useState<string | null>(null);

  // GOG
  const [gogBusy, setGogBusy] = useState(false);
  const [gogWindowOpen, setGogWindowOpen] = useState(false);
  const [gogLinked, setGogLinked] = useState(false);
  const [gogUsername, setGogUsername] = useState<string | null>(null);

  // Xbox
  const [xboxBusy, setXboxBusy] = useState(false);
  const [xboxWindowOpen, setXboxWindowOpen] = useState(false);
  const [xboxLinked, setXboxLinked] = useState(!!userPreferences?.xboxGamertag);
  const [xboxGamertag, setXboxGamertag] = useState(
    userPreferences?.xboxGamertag ?? null
  );

  // Notifications
  const [downloadNotifs, setDownloadNotifs] = useState(true);
  const [achievementNotifs, setAchievementNotifs] = useState(true);

  // Startup
  const [startMinimized, setStartMinimized] = useState(false);

  const currentStep = ALL_STEPS[stepIndex];

  useEffect(() => {
    window.electron.getDefaultDownloadsPath().then((p) => {
      setDefaultInstallPath(p);
      setInstallPath((prev) => prev || p);
    });
  }, []);

  // Watch for sign-in while account window is open
  useEffect(() => {
    if (!accountWindowOpen) return;
    const unsub = window.electron.onSignIn(() => {
      setAccountLinked(true);
      setAccountWindowOpen(false);
      setStepIndex((i) => Math.min(i + 1, ALL_STEPS.length - 1));
    });
    return unsub;
  }, [accountWindowOpen]);

  const next = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, ALL_STEPS.length - 1));
  }, []);

  const skipIntegrations = useCallback(() => {
    setStepIndex(ALL_STEPS.indexOf("notifications"));
  }, []);

  const finish = useCallback(async () => {
    await window.electron.updateUserPreferences({
      onboardingComplete: true,
      downloadNotificationsEnabled: downloadNotifs,
      achievementNotificationsEnabled: achievementNotifs,
      startMinimized,
    });
    onComplete();
  }, [onComplete, downloadNotifs, achievementNotifs, startMinimized]);

  const handleLanguageSave = async () => {
    await window.electron.updateUserPreferences({ language: selectedLanguage });
    i18n.changeLanguage(selectedLanguage);
    next();
  };

  const handleInstallPathSave = async () => {
    const path = installPath.trim() || defaultInstallPath;
    await window.electron.updateUserPreferences({ downloadsPath: path });
    next();
  };

  const handlePickFolder = async () => {
    const result = await window.electron.showOpenDialog({
      properties: ["openDirectory"],
    });
    if (result && !result.canceled && result.filePaths[0]) {
      setInstallPath(result.filePaths[0]);
    }
  };

  const handleAccountSignIn = () => {
    setAccountWindowOpen(true);
    window.electron.openAuthWindow(AuthPage.SignIn);
  };

  const handleSteamOpenIdConnect = async () => {
    setSteamOpenIdBusy(true);
    setSteamError("");
    try {
      const detectedId = await window.electron.startSteamOpenIdLogin();
      const summary = await window.electron
        .getSteamPlayerSummary(detectedId, undefined)
        .catch(() => null);
      await window.electron.updateUserPreferences({ steamId: detectedId });
      if (summary) setSteamProfile(summary);
      setSteamLinked(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSteamError(msg || "Steam login failed.");
    } finally {
      setSteamOpenIdBusy(false);
    }
  };

  const handleSteamConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSteamError("");
    const steamId = parseSteamId(steamInput);
    if (!steamId) return;
    setSteamBusy(true);
    try {
      const summary = await window.electron.getSteamPlayerSummary(
        steamId,
        steamApiKey.trim() || undefined
      );
      if (!summary) {
        setSteamError("Steam account not found. Check your Steam ID.");
        return;
      }
      await window.electron.updateUserPreferences({
        steamId,
        steamApiKey: steamApiKey.trim() || undefined,
      });
      if (summary) setSteamProfile(summary);
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
      const status = await window.electron
        .getLegendaryStatus()
        .catch(() => null);
      if (!status?.binaryFound) {
        await window.electron.installLegendary().catch(() => null);
      }
      setEpicWindowOpen(true);
      const result = await window.electron.openLegendaryAuthWindow();
      setEpicWindowOpen(false);
      if (result?.success) {
        setEpicLinked(true);
        setEpicAccount(result.account ?? "Epic");
      }
    } catch {
      setEpicWindowOpen(false);
    } finally {
      setEpicBusy(false);
    }
  };

  const handleGogConnect = async () => {
    setGogBusy(true);
    try {
      setGogWindowOpen(true);
      const result = await window.electron.openGogAuthWindow();
      setGogWindowOpen(false);
      if (result) {
        await window.electron.updateUserPreferences({
          gogRefreshToken: result.refresh_token,
        });
        setGogLinked(true);
        setGogUsername(result.username ?? "GOG User");
      }
    } catch {
      setGogWindowOpen(false);
    } finally {
      setGogBusy(false);
    }
  };

  const handleXboxConnect = async () => {
    setXboxBusy(true);
    try {
      setXboxWindowOpen(true);
      const result = await window.electron.openXboxAuthWindow();
      setXboxWindowOpen(false);
      if (result?.success) {
        setXboxLinked(true);
        setXboxGamertag(result.gamertag ?? "Xbox User");
      }
    } catch {
      setXboxWindowOpen(false);
    } finally {
      setXboxBusy(false);
    }
  };

  const dotSteps = INTEGRATION_STEPS;
  const showDots =
    currentStep !== "welcome" &&
    currentStep !== "language" &&
    currentStep !== "install-path" &&
    currentStep !== "account" &&
    currentStep !== "notifications" &&
    currentStep !== "startup" &&
    currentStep !== "done";

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-logo">
          <GameHubIcon className="onboarding-logo__icon" />
          <h1>GameHub</h1>
          {currentStep === "welcome" && <p>Your all-in-one game launcher</p>}
        </div>

        {showDots && (
          <div className="onboarding-steps">
            {dotSteps.map((s) => {
              const isActive = currentStep === s;
              const isDone =
                dotSteps.indexOf(s) < dotSteps.indexOf(currentStep as StepId);
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
                Let's get you set up quickly. We'll configure a few basics,
                optionally connect your accounts, then you're in. You can change
                everything later in Settings.
              </p>
              <div className="onboarding-actions">
                <Button type="button" onClick={next}>
                  Get Started
                </Button>
              </div>
            </>
          )}

          {/* ── Language ── */}
          {currentStep === "language" && (
            <>
              <div className="onboarding-platform-hero">
                <GearIcon
                  size={32}
                  className="onboarding-platform-hero__icon"
                />
                <h2>Language</h2>
              </div>
              <p className="onboarding-step-description">
                Choose the language GameHub should use.
              </p>
              <div className="onboarding-select-list">
                {languageOptions.map(({ option, nativeName }) => (
                  <button
                    key={option}
                    type="button"
                    className={[
                      "onboarding-select-item",
                      selectedLanguage === option
                        ? "onboarding-select-item--active"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedLanguage(option)}
                  >
                    {selectedLanguage === option && (
                      <CheckCircleFillIcon size={14} />
                    )}
                    {nativeName}
                  </button>
                ))}
              </div>
              <div className="onboarding-actions">
                <Button type="button" onClick={handleLanguageSave}>
                  Continue
                </Button>
              </div>
            </>
          )}

          {/* ── Install Path ── */}
          {currentStep === "install-path" && (
            <>
              <div className="onboarding-platform-hero">
                <GearIcon
                  size={32}
                  className="onboarding-platform-hero__icon"
                />
                <h2>Default Install Folder</h2>
              </div>
              <p className="onboarding-step-description">
                Where should GameHub download and install games by default?
              </p>
              <div className="onboarding-path-row">
                <TextField
                  value={installPath}
                  onChange={(e) => setInstallPath(e.target.value)}
                  placeholder={defaultInstallPath}
                />
                <Button
                  type="button"
                  theme="outline"
                  onClick={handlePickFolder}
                >
                  Browse…
                </Button>
              </div>
              <div className="onboarding-actions">
                <button
                  type="button"
                  className="onboarding-skip"
                  onClick={next}
                >
                  Use default
                </button>
                <Button type="button" onClick={handleInstallPathSave}>
                  Continue
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
                profiles, and cross-device sync. Completely optional.
              </p>

              {accountLinked ? (
                <>
                  <div className="onboarding-connected-badge">
                    <CheckCircleFillIcon size={16} />
                    Signed in — you're all set
                  </div>
                  <div className="onboarding-actions">
                    <Button type="button" onClick={next}>
                      Continue
                    </Button>
                  </div>
                </>
              ) : accountWindowOpen ? (
                <div
                  className="onboarding-actions"
                  style={{ justifyContent: "center" }}
                >
                  <span style={{ opacity: 0.6, fontSize: "0.9rem" }}>
                    Waiting for sign-in…
                  </span>
                </div>
              ) : (
                <div className="onboarding-actions">
                  <button
                    type="button"
                    className="onboarding-skip"
                    onClick={skipIntegrations}
                  >
                    Skip — use without account
                  </button>
                  <Button type="button" onClick={handleAccountSignIn}>
                    <PersonIcon size={14} />
                    Sign in / Register
                  </Button>
                </div>
              )}
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
                  {steamProfile ? (
                    <div
                      className="onboarding-connected-badge"
                      style={{ gap: "10px" }}
                    >
                      <img
                        src={steamProfile.avatarfull}
                        alt={steamProfile.personaname}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <CheckCircleFillIcon size={14} />
                          <strong>{steamProfile.personaname}</strong>
                        </div>
                        <small style={{ opacity: 0.6 }}>
                          Steam connected — library will sync
                        </small>
                      </div>
                    </div>
                  ) : (
                    <div className="onboarding-connected-badge">
                      <CheckCircleFillIcon size={16} />
                      Steam connected — library will sync
                    </div>
                  )}
                  <div className="onboarding-actions">
                    <Button type="button" onClick={next}>
                      Continue
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="onboarding-step-description">
                    Sign in with Steam to import your library automatically, or
                    enter your Steam ID manually.
                  </p>

                  <div
                    className="onboarding-actions"
                    style={{ marginBottom: "12px" }}
                  >
                    <Button
                      type="button"
                      onClick={handleSteamOpenIdConnect}
                      disabled={steamOpenIdBusy}
                      style={{
                        background: "#1b2838",
                        color: "#c7d5e0",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <SteamLogo style={{ width: 18, height: 18 }} />
                      {steamOpenIdBusy
                        ? "Opening Steam…"
                        : "Sign in with Steam"}
                    </Button>
                  </div>

                  <p
                    style={{
                      margin: "0 0 8px",
                      opacity: 0.45,
                      textAlign: "center",
                      fontSize: "0.85rem",
                    }}
                  >
                    or enter manually
                  </p>

                  <form
                    className="onboarding-form"
                    onSubmit={handleSteamConnect}
                  >
                    <TextField
                      label="Steam Profile URL or ID"
                      value={steamInput}
                      onChange={(e) => setSteamInput(e.target.value)}
                      placeholder="https://steamcommunity.com/profiles/76561198…"
                      hint="Paste your full profile URL — we'll extract the ID automatically"
                    />

                    <TextField
                      label="Steam Web API Key (optional)"
                      value={steamApiKey}
                      onChange={(e) => setSteamApiKey(e.target.value)}
                      type="password"
                      placeholder="32-character API key (optional)"
                      hint={
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          Only needed for achievement tracking.{" "}
                          <button
                            type="button"
                            className="onboarding-link"
                            onClick={() =>
                              window.electron.openExternal(
                                "https://steamcommunity.com/dev/apikey"
                              )
                            }
                          >
                            Get key
                            <LinkExternalIcon size={10} />
                          </button>
                        </span>
                      }
                    />

                    {steamError && (
                      <p
                        style={{
                          color: "var(--color-danger, #f87171)",
                          margin: 0,
                          fontSize: "0.85rem",
                        }}
                      >
                        {steamError}
                      </p>
                    )}

                    <div className="onboarding-actions">
                      <button
                        type="button"
                        className="onboarding-skip"
                        onClick={next}
                      >
                        Skip for now
                      </button>
                      <Button
                        type="submit"
                        disabled={!steamInput.trim() || steamBusy}
                      >
                        {steamBusy ? "Connecting…" : "Connect Steam"}
                      </Button>
                    </div>
                  </form>
                </>
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
                GameHub will install it automatically.
              </p>

              {epicLinked ? (
                <>
                  <div className="onboarding-connected-badge">
                    <CheckCircleFillIcon size={16} />
                    Signed in as {epicAccount}
                  </div>
                  <div className="onboarding-actions">
                    <Button type="button" onClick={next}>
                      Continue
                    </Button>
                  </div>
                </>
              ) : epicWindowOpen ? (
                <div
                  className="onboarding-actions"
                  style={{ justifyContent: "center" }}
                >
                  <span style={{ opacity: 0.6, fontSize: "0.9rem" }}>
                    Waiting for sign-in…
                  </span>
                </div>
              ) : (
                <div className="onboarding-actions">
                  <button
                    type="button"
                    className="onboarding-skip"
                    onClick={next}
                    disabled={epicBusy}
                  >
                    Skip for now
                  </button>
                  <Button
                    type="button"
                    onClick={handleEpicConnect}
                    disabled={epicBusy}
                  >
                    <PersonIcon size={14} />
                    {epicBusy ? "Opening…" : "Connect Epic"}
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
                Connect your GOG account to import your DRM-free library.
              </p>

              {gogLinked ? (
                <>
                  <div className="onboarding-connected-badge">
                    <CheckCircleFillIcon size={16} />
                    Connected as {gogUsername}
                  </div>
                  <div className="onboarding-actions">
                    <Button type="button" onClick={next}>
                      Continue
                    </Button>
                  </div>
                </>
              ) : gogWindowOpen ? (
                <div
                  className="onboarding-actions"
                  style={{ justifyContent: "center" }}
                >
                  <span style={{ opacity: 0.6, fontSize: "0.9rem" }}>
                    Waiting for sign-in…
                  </span>
                </div>
              ) : (
                <div className="onboarding-actions">
                  <button
                    type="button"
                    className="onboarding-skip"
                    onClick={next}
                    disabled={gogBusy}
                  >
                    Skip for now
                  </button>
                  <Button
                    type="button"
                    onClick={handleGogConnect}
                    disabled={gogBusy}
                  >
                    <PersonIcon size={14} />
                    {gogBusy ? "Opening…" : "Connect GOG"}
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
                Sign in with your Microsoft account to import your Xbox and Game
                Pass PC library.
              </p>

              {xboxLinked ? (
                <>
                  <div className="onboarding-connected-badge">
                    <CheckCircleFillIcon size={16} />
                    Signed in as {xboxGamertag}
                  </div>
                  <div className="onboarding-actions">
                    <Button type="button" onClick={next}>
                      Continue
                    </Button>
                  </div>
                </>
              ) : xboxWindowOpen ? (
                <div
                  className="onboarding-actions"
                  style={{ justifyContent: "center" }}
                >
                  <span style={{ opacity: 0.6, fontSize: "0.9rem" }}>
                    Waiting for sign-in…
                  </span>
                </div>
              ) : (
                <div className="onboarding-actions">
                  <button
                    type="button"
                    className="onboarding-skip"
                    onClick={next}
                    disabled={xboxBusy}
                  >
                    Skip for now
                  </button>
                  <Button
                    type="button"
                    onClick={handleXboxConnect}
                    disabled={xboxBusy}
                  >
                    <PersonIcon size={14} />
                    {xboxBusy ? "Opening…" : "Connect Xbox"}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── Notifications ── */}
          {currentStep === "notifications" && (
            <>
              <div className="onboarding-platform-hero">
                <BellIcon
                  size={28}
                  className="onboarding-platform-hero__icon"
                />
                <h2>Notifications</h2>
              </div>
              <p className="onboarding-step-description">
                Choose which notifications GameHub should show you.
              </p>
              <div className="onboarding-toggles">
                <label className="onboarding-toggle">
                  <div className="onboarding-toggle__text">
                    <span>Download completed</span>
                    <small>Notify when a download finishes</small>
                  </div>
                  <input
                    type="checkbox"
                    checked={downloadNotifs}
                    onChange={(e) => setDownloadNotifs(e.target.checked)}
                  />
                </label>
                <label className="onboarding-toggle">
                  <div className="onboarding-toggle__text">
                    <span>Achievement unlocked</span>
                    <small>Show a pop-up when you unlock an achievement</small>
                  </div>
                  <input
                    type="checkbox"
                    checked={achievementNotifs}
                    onChange={(e) => setAchievementNotifs(e.target.checked)}
                  />
                </label>
              </div>
              <div className="onboarding-actions">
                <Button type="button" onClick={next}>
                  Continue
                </Button>
              </div>
            </>
          )}

          {/* ── Startup ── */}
          {currentStep === "startup" && (
            <>
              <div className="onboarding-platform-hero">
                <GearIcon
                  size={28}
                  className="onboarding-platform-hero__icon"
                />
                <h2>Startup Behavior</h2>
              </div>
              <p className="onboarding-step-description">
                How should GameHub behave when your computer starts?
              </p>
              <div className="onboarding-toggles">
                <label className="onboarding-toggle">
                  <div className="onboarding-toggle__text">
                    <span>Start minimized to tray</span>
                    <small>
                      Launch in background without opening the window
                    </small>
                  </div>
                  <input
                    type="checkbox"
                    checked={startMinimized}
                    onChange={(e) => setStartMinimized(e.target.checked)}
                  />
                </label>
              </div>
              <div className="onboarding-actions">
                <Button type="button" onClick={next}>
                  Continue
                </Button>
              </div>
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
                Your libraries will sync in the background. You can connect more
                services anytime from <strong>Settings → Integrations</strong>.
              </p>
              <div
                className="onboarding-actions"
                style={{ justifyContent: "center" }}
              >
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
