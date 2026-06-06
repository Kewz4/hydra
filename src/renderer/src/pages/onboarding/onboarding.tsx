import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, TextField } from "@renderer/components";
import { useAppSelector } from "@renderer/hooks";
import {
  CheckCircleFillIcon,
  PersonIcon,
} from "@primer/octicons-react";
import SteamLogo from "@renderer/assets/steam-logo.svg?react";
import EpicLogo from "@renderer/assets/epic-logo.svg?react";
import GogLogo from "@renderer/assets/gog-logo.svg?react";
import XboxLogo from "@renderer/assets/xbox-logo.svg?react";
import "./onboarding.scss";

type StepId = "welcome" | "steam" | "epic" | "gog" | "xbox" | "done";

const STEPS: StepId[] = ["welcome", "steam", "epic", "gog", "xbox", "done"];

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { t } = useTranslation("settings");
  const userPreferences = useAppSelector((state) => state.userPreferences.value);

  const [stepIndex, setStepIndex] = useState(0);

  // Steam state
  const [steamId, setSteamId] = useState("");
  const [steamApiKey, setSteamApiKey] = useState("");
  const [steamLinked, setSteamLinked] = useState(false);
  const [steamBusy, setSteamBusy] = useState(false);

  // Epic state
  const [epicBusy, setEpicBusy] = useState(false);
  const [epicLinked, setEpicLinked] = useState(false);
  const [epicAccount, setEpicAccount] = useState<string | null>(null);

  // GOG state
  const [gogBusy, setGogBusy] = useState(false);
  const [gogLinked, setGogLinked] = useState(false);
  const [gogUsername, setGogUsername] = useState<string | null>(null);

  // Xbox state
  const [xboxBusy, setXboxBusy] = useState(false);
  const [xboxLinked, setXboxLinked] = useState(!!userPreferences?.xboxGamertag);
  const [xboxGamertag, setXboxGamertag] = useState(userPreferences?.xboxGamertag ?? null);

  const currentStep = STEPS[stepIndex];

  const next = useCallback(() => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex]);

  const finish = useCallback(async () => {
    await window.electron.updateUserPreferences({ onboardingComplete: true });
    onComplete();
  }, [onComplete]);

  const handleSteamConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!steamId.trim() || !steamApiKey.trim()) return;
    setSteamBusy(true);
    try {
      const summary = await window.electron.getSteamPlayerSummary(steamId.trim(), steamApiKey.trim());
      if (!summary) return;
      await window.electron.updateUserPreferences({ steamId: steamId.trim(), steamApiKey: steamApiKey.trim() });
      setSteamLinked(true);
    } catch {
      // silently ignore — user can configure later in Settings
    } finally {
      setSteamBusy(false);
    }
  };

  const handleEpicConnect = async () => {
    setEpicBusy(true);
    try {
      // Try to install legendary first if needed
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
      // ignore — user can configure later
    } finally {
      setEpicBusy(false);
    }
  };

  const handleGogConnect = async () => {
    setGogBusy(true);
    try {
      const result = await window.electron.openGogAuthWindow();
      if (result) {
        await window.electron.updateUserPreferences({ gogRefreshToken: result.refresh_token });
        setGogLinked(true);
        setGogUsername(result.username ?? "GOG User");
      }
    } catch {
      // ignore
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
      // ignore
    } finally {
      setXboxBusy(false);
    }
  };

  const stepDots = STEPS.slice(0, -1); // exclude "done" from dots

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {/* Logo */}
        <div className="onboarding-logo">
          <h1>GameHub</h1>
          {currentStep === "welcome" && (
            <p>Your all-in-one game launcher</p>
          )}
        </div>

        {/* Step dots (not shown on welcome or done) */}
        {currentStep !== "welcome" && currentStep !== "done" && (
          <div className="onboarding-steps">
            {stepDots.slice(1).map((s, i) => {
              const realIndex = i + 1;
              return (
                <div
                  key={s}
                  className={[
                    "onboarding-step-dot",
                    stepIndex === realIndex ? "onboarding-step-dot--active" : "",
                    stepIndex > realIndex ? "onboarding-step-dot--done" : "",
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
                Let's connect your game libraries so everything shows up in one place.
                You can skip any integration and connect it later in Settings.
              </p>
              <div className="onboarding-actions">
                <Button type="button" onClick={next}>
                  Get Started
                </Button>
              </div>
            </>
          )}

          {/* ── Steam ── */}
          {currentStep === "steam" && (
            <>
              <div className="onboarding-step-header">
                <SteamLogo width={24} height={24} />
                <h2>Steam</h2>
              </div>

              {steamLinked ? (
                <div className="onboarding-connected-badge">
                  <CheckCircleFillIcon size={16} />
                  Steam connected — library will sync automatically
                </div>
              ) : (
                <form className="onboarding-form" onSubmit={handleSteamConnect}>
                  <p className="onboarding-step-description">
                    Enter your Steam ID and API key to sync your Steam library and achievements.
                    Get your API key at steamcommunity.com/dev/apikey
                  </p>
                  <TextField
                    label={t("steam_id")}
                    value={steamId}
                    onChange={(e) => setSteamId(e.target.value)}
                    placeholder="76561198..."
                  />
                  <TextField
                    label={t("steam_api_key")}
                    value={steamApiKey}
                    onChange={(e) => setSteamApiKey(e.target.value)}
                    type="password"
                    placeholder={t("steam_api_key_placeholder")}
                  />
                  <div className="onboarding-actions">
                    <button type="button" className="onboarding-skip" onClick={next}>
                      Skip for now
                    </button>
                    <Button
                      type="submit"
                      disabled={!steamId.trim() || !steamApiKey.trim() || steamBusy}
                    >
                      {steamBusy ? t("connecting") : "Connect Steam"}
                    </Button>
                  </div>
                </form>
              )}

              {steamLinked && (
                <div className="onboarding-actions">
                  <Button type="button" onClick={next}>
                    Continue
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── Epic ── */}
          {currentStep === "epic" && (
            <>
              <div className="onboarding-step-header">
                <EpicLogo width={24} height={24} />
                <h2>Epic Games</h2>
              </div>

              <p className="onboarding-step-description">
                Connect your Epic Games account via the Legendary open-source CLI.
                GameHub will install it automatically.
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
                  <button type="button" className="onboarding-skip" onClick={next}>
                    Skip for now
                  </button>
                  <Button
                    type="button"
                    onClick={handleEpicConnect}
                    disabled={epicBusy}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <PersonIcon size={14} />
                    {epicBusy ? t("signing_in") : "Connect Epic"}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── GOG ── */}
          {currentStep === "gog" && (
            <>
              <div className="onboarding-step-header">
                <GogLogo width={24} height={24} />
                <h2>GOG</h2>
              </div>

              <p className="onboarding-step-description">
                Connect your GOG account to sync your DRM-free game library.
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
                  <button type="button" className="onboarding-skip" onClick={next}>
                    Skip for now
                  </button>
                  <Button
                    type="button"
                    onClick={handleGogConnect}
                    disabled={gogBusy}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <PersonIcon size={14} />
                    {gogBusy ? t("connecting") : "Connect GOG"}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── Xbox ── */}
          {currentStep === "xbox" && (
            <>
              <div className="onboarding-step-header">
                <XboxLogo width={24} height={24} />
                <h2>Xbox / Game Pass</h2>
              </div>

              <p className="onboarding-step-description">
                Sign in with your Microsoft account to sync your Xbox and Game Pass PC library.
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
                  <button type="button" className="onboarding-skip" onClick={next}>
                    Skip for now
                  </button>
                  <Button
                    type="button"
                    onClick={handleXboxConnect}
                    disabled={xboxBusy}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <PersonIcon size={14} />
                    {xboxBusy ? t("signing_in") : "Connect Xbox"}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── Done ── */}
          {currentStep === "done" && (
            <>
              <p className="onboarding-step-description" style={{ textAlign: "center", fontSize: "1rem" }}>
                🎮 You're all set!<br /><br />
                Your libraries will sync in the background. You can connect more services
                anytime from <strong>Settings → Integrations</strong>.
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
