import { useTranslation } from "react-i18next";
import { useContext } from "react";
import { gameDetailsContext } from "@renderer/context";
import { BookmarkIcon } from "@primer/octicons-react";
import "./description-header.scss";

export function DescriptionHeader() {
  const { shopDetails, game } = useContext(gameDetailsContext);
  const { t } = useTranslation("game_details");

  if (!shopDetails) return null;

  return (
    <div className="description-header">
      <section className="description-header__info">
        <p>
          {t("release_date", {
            date: shopDetails?.release_date.date,
          })}
        </p>

        {Array.isArray(shopDetails.publishers) && (
          <p>{t("publisher", { publisher: shopDetails.publishers[0] })}</p>
        )}
      </section>

      {game && (
        <div className="description-header__library-badge">
          <BookmarkIcon size={12} />
          {t("in_library", { defaultValue: "In Library" })}
        </div>
      )}
    </div>
  );
}
