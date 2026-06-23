import React, { useState } from "react";
import { createAppManifest } from "../createAppManifest";
import goIcon from "../../assets/Icons/go.png";
import backIcon from "../../assets/Icons/back.png";
import forwardIcon from "../../assets/Icons/forward.png";
import windowsIcon from "../../assets/Icons/windows.png";
import searchIcon from "../../assets/Icons/search.png";
import linksIcon from "../../assets/Icons/share.png";
import internetIcon from "../../assets/Icons/explorer.png";
import appInternetExplorerIcon from "../../assets/Icons/internetexplorer.png";
import noFile from "../../assets/Icons/nofile.png";
import refreshFile from "../../assets/Icons/refreshfile.png";
import Home from "../../assets/Icons/home.png";
import Star from "../../assets/Icons/star.png";
import reverseTime from "../../assets/Icons/reversetime.png";
import openMail from "../../assets/Icons/openmail.png";
import Printer from "../../assets/Icons/printer.png";
import Send from "../../assets/Icons/send.png";
import Globe from "../../assets/Icons/globe.png";
import styles from "./InternetExplorer.module.css";

export const appManifest = createAppManifest({
  id: "internet-explorer",
  title: "Internet Explorer",
  icon: appInternetExplorerIcon,
});

const MENU_ITEMS = ["File", "Edit", "View", "Favorites", "Tools", "Help"];

const cx = (...classes) => classes.filter(Boolean).join(" ");

function InternetExplorer({ isFocused }) {
  const defaultUrl = window.location.origin + window.location.pathname;

  const getNestedUrl = (baseUrl) => {
    const urlObj = new URL(baseUrl, window.location.href);
    const currentNest = Number(urlObj.searchParams.get("nest")) || 0;
    urlObj.searchParams.set("nest", currentNest + 1);
    return urlObj.toString();
  };

  const initialUrl = getNestedUrl(window.location.href);

  const [url, setUrl] = useState(initialUrl);
  const [inputValue, setInputValue] = useState(initialUrl);

  const handleInputChange = (event) => setInputValue(event.target.value);

  const navigate = () => {
    let formattedUrl = inputValue.trim();
    if (formattedUrl.startsWith(defaultUrl)) {
      formattedUrl = getNestedUrl(formattedUrl);
    }
    setUrl(formattedUrl);
    setInputValue(formattedUrl);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") navigate();
  };

  return (
    <div className={styles.root}>
      <section className={styles.toolbar}>
        <div className={styles.menu}>
          {MENU_ITEMS.map((item) => (
            <div key={item} className={styles.menuItem}>
              {item}
            </div>
          ))}
        </div>
        <img className={styles.windowsLogo} src={windowsIcon} alt="windows" />
      </section>

      <section className={styles.functionBar}>
        <div
          className={cx(styles.functionButton, styles.functionButtonDisabled)}
        >
          <img className={styles.functionIcon} src={backIcon} alt="Back" />
          <span className={styles.functionText}>Back</span>
          <div className={styles.arrow} />
        </div>

        <div
          className={cx(styles.functionButton, styles.functionButtonDisabled)}
        >
          <img className={styles.functionIcon} src={forwardIcon} alt="Forward" />
          <div className={styles.arrow} />
        </div>

        <div className={styles.functionButton}>
          <img className={styles.functionIcon} src={noFile} alt="No File" />
          <img
            className={styles.functionIcon}
            src={refreshFile}
            alt="Refresh File"
          />
          <img className={styles.functionIcon} src={Home} alt="Home" />
        </div>

        <div className={styles.functionDivider} />

        <div className={styles.functionButton}>
          <img
            className={styles.functionIconSmall}
            src={searchIcon}
            alt="Search"
          />
          <span className={styles.functionText}>Search</span>
        </div>

        <div className={styles.functionButton}>
          <img className={styles.functionIconSmall} src={Star} alt="Star" />
          <span className={styles.functionText}>Favourites</span>
        </div>

        <img
          className={styles.functionIcon}
          src={reverseTime}
          alt="Reverse Time"
        />

        <div className={styles.functionDivider} />

        <div className={styles.functionButton}>
          <img className={styles.functionIcon} src={openMail} alt="Open Mail" />
          <div className={styles.arrow} />
        </div>

        <img className={styles.functionIconSmall} src={Printer} alt="Printer" />
        <img className={styles.functionIcon} src={Send} alt="Send" />
        <img className={styles.functionIconSmall} src={linksIcon} alt="Links" />
      </section>

      <section className={styles.addressBar}>
        <div className={styles.addressTitle}>Address</div>
        <div className={styles.addressContent}>
          <img
            src={internetIcon}
            alt="InternetIcon"
            className={styles.addressIcon}
          />
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className={styles.addressInput}
          />
          <span className={styles.arrow} />
        </div>
        <div className={styles.addressGo} onClick={navigate}>
          <img className={styles.addressGoIcon} src={goIcon} alt="Go" />
          <span className={styles.addressGoText}>Go</span>
        </div>
        <div className={styles.addressSeparator} />
        <div className={styles.addressLinks}>
          <span className={styles.addressLinksText}>Links</span>
        </div>
      </section>

      <iframe
        src={url}
        title="Internet Explorer"
        className={cx(styles.frame, !isFocused && styles.frameBlocked)}
      />

      <footer className={styles.footer}>
        <div className={styles.footerStatus}>
          <img
            className={styles.footerStatusIcon}
            src={internetIcon}
            alt="InternetIcon"
          />
          <span>Done</span>
        </div>
        <div />
        <div />
        <div />
        <div />
        <div className={styles.footerRight}>
          <img className={styles.footerRightIcon} src={Globe} alt="globe" />
          <span>Internet</span>
          <div className={styles.footerRightDots} />
        </div>
      </footer>
    </div>
  );
}

export default InternetExplorer;
