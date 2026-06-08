import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button, Link, TextField } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import { CheckCircleFillIcon, LinkExternalIcon } from "@primer/octicons-react";

const UPLOADCARE_DOCS_URL = "https://uploadcare.com/docs/start/";

export function SettingsUploadcare() {
  const { t } = useTranslation("settings");
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
  const { updateUserPreferences } = useContext(settingsContext);
  const { showSuccessToast, showErrorToast } = useToast();

  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userPreferences) {
      setPublicKey(userPreferences.uploadcarePublicKey ?? "");
      setSecretKey(userPreferences.uploadcareSecretKey ?? "");
    }
  }, [userPreferences]);

  const isConfigured = !!(
    userPreferences?.uploadcarePublicKey && userPreferences?.uploadcareSecretKey
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey.trim() || !secretKey.trim()) return;
    setIsSaving(true);
    try {
      await updateUserPreferences({
        uploadcarePublicKey: publicKey.trim(),
        uploadcareSecretKey: secretKey.trim(),
      });
      showSuccessToast(t("uploadcare_saved"));
    } catch {
      showErrorToast(t("uploadcare_save_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    await updateUserPreferences({
      uploadcarePublicKey: null,
      uploadcareSecretKey: null,
    });
    setPublicKey("");
    setSecretKey("");
    showSuccessToast(t("uploadcare_disconnected"));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ margin: 0, opacity: 0.8 }}>{t("uploadcare_description")}</p>

      {isConfigured && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px",
            borderRadius: "8px",
            background: "var(--color-background-2, rgba(255,255,255,0.05))",
          }}
        >
          <CheckCircleFillIcon size={16} />
          <span style={{ flex: 1 }}>{t("uploadcare_connected")}</span>
          <Button type="button" onClick={handleDisconnect} theme="outline">
            {t("disconnect")}
          </Button>
        </div>
      )}

      <form
        onSubmit={handleSave}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <TextField
          label={t("uploadcare_public_key")}
          value={publicKey}
          onChange={(e) => setPublicKey(e.target.value)}
          placeholder="demopublickey"
        />
        <TextField
          label={t("uploadcare_secret_key")}
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          type="password"
          placeholder="demosecretkey"
          hint={
            <Trans i18nKey="uploadcare_key_hint" ns="settings">
              <Link to={UPLOADCARE_DOCS_URL}>
                <LinkExternalIcon size={12} />
              </Link>
            </Trans>
          }
        />
        <div>
          <Button
            type="submit"
            disabled={!publicKey.trim() || !secretKey.trim() || isSaving}
          >
            {isSaving ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
