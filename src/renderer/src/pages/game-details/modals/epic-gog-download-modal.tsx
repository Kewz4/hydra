import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileDirectoryIcon } from "@primer/octicons-react";
import { Button, Modal, TextField } from "@renderer/components";

export type EpicGogPlatform = "epic" | "gog";

export interface EpicGogDownloadModalProps {
  visible: boolean;
  platform: EpicGogPlatform;
  onClose: () => void;
  onConfirm: (customPath: string | undefined) => void;
}

export function EpicGogDownloadModal({
  visible,
  platform,
  onClose,
  onConfirm,
}: Readonly<EpicGogDownloadModalProps>) {
  const { t } = useTranslation("game_details");
  const [customPath, setCustomPath] = useState("");

  const title =
    platform === "epic" ? "Download with Epic Games" : "Download with GOG";

  const handleBrowse = async () => {
    const result = await window.electron.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Choose install folder",
    });
    if (!result.canceled && result.filePaths[0]) {
      setCustomPath(result.filePaths[0]);
    }
  };

  const handleDownload = () => {
    onConfirm(customPath.trim() || undefined);
    setCustomPath("");
    onClose();
  };

  const handleClose = () => {
    setCustomPath("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      title={title}
      description={t("choose_install_folder_optional", {
        defaultValue:
          "Choose an install folder or leave blank to use the default.",
      })}
      onClose={handleClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <TextField
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder={t("default_install_folder", {
              defaultValue: "Default install folder",
            })}
            style={{ flex: 1 }}
          />
          <Button type="button" theme="outline" onClick={handleBrowse}>
            <FileDirectoryIcon />
            {t("browse", { defaultValue: "Browse" })}
          </Button>
        </div>
        <div
          style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}
        >
          <Button type="button" theme="outline" onClick={handleClose}>
            {t("cancel", { ns: "common", defaultValue: "Cancel" })}
          </Button>
          <Button type="button" theme="primary" onClick={handleDownload}>
            {t("download_now", { defaultValue: "Download" })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
