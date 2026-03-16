import React, { useState } from 'react';
import styles from "./InternetExplorer.module.css";

import goIcon from '../../assets/Icons/go.png';
import backIcon from '../../assets/Icons/back.png';
import forwardIcon from '../../assets/Icons/forward.png';
import windowsIcon from '../../assets/Icons/windows.png';
import searchIcon from '../../assets/Icons/search.png';
import linksIcon from '../../assets/Icons/share.png';
import internetIcon from '../../assets/Icons/explorer.png';
import appInternetExplorerIcon from '../../assets/Icons/internetexplorer.png';
import noFile from '../../assets/Icons/nofile.png';
import refreshFile from '../../assets/Icons/refreshfile.png';
import Home from '../../assets/Icons/home.png';
import Star from '../../assets/Icons/star.png';
import reverseTime from '../../assets/Icons/reversetime.png';
import openMail from '../../assets/Icons/openmail.png';
import Printer from '../../assets/Icons/printer.png';
import Send from '../../assets/Icons/send.png';
import Globe from '../../assets/Icons/globe.png';
import { createAppManifest } from '../createAppManifest';

export const appManifest = createAppManifest({
  id: "internet-explorer",
  title: "Internet Explorer",
  icon: appInternetExplorerIcon,
});

function InternetExplorer({ isFocused }) {
  const cx = (...keys) => keys.map((key) => styles[key]).join(" ");

  // Base URL (your own page without query parameters)
  const defaultUrl = window.location.origin + window.location.pathname;

  // Helper: increment the "nest" query parameter
  const getNestedUrl = (baseUrl) => {
    const urlObj = new URL(baseUrl, window.location.href);
    const currentNest = Number(urlObj.searchParams.get('nest')) || 0;
    urlObj.searchParams.set('nest', currentNest + 1);
    return urlObj.toString();
  };

  // Start with the current URL nested once
  const initialUrl = getNestedUrl(window.location.href);

  const [url, setUrl] = useState(initialUrl);
  const [inputValue, setInputValue] = useState(initialUrl);

  const handleInputChange = (e) => setInputValue(e.target.value);

  const navigate = () => {
    let formattedUrl = inputValue.trim();
    if (formattedUrl.startsWith(defaultUrl)) {
      formattedUrl = getNestedUrl(formattedUrl);
    }
    setUrl(formattedUrl);
    setInputValue(formattedUrl);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') navigate();
  };

  return (
    <div className={styles.ie}>
      {/* Toolbar */}
      <section className={styles.ie__toolbar}>
        <div className={styles.ie__options}>
          <div className={styles["drop-down"]}>
            <div className={styles["drop-down__label"]}>File</div>
          </div>
          <div className={styles["drop-down"]}>
            <div className={styles["drop-down__label"]}>Edit</div>
          </div>
          <div className={styles["drop-down"]}>
            <div className={styles["drop-down__label"]}>View</div>
          </div>
          <div className={styles["drop-down"]}>
            <div className={styles["drop-down__label"]}>Favorites</div>
          </div>
          <div className={styles["drop-down"]}>
            <div className={styles["drop-down__label"]}>Tools</div>
          </div>
          <div className={styles["drop-down"]}>
            <div className={styles["drop-down__label"]}>Help</div>
          </div>
        </div>
        <img className={styles.ie__windowsLogo} src={windowsIcon} alt="windows" />
      </section>

      {/* Function Bar */}
      <section className={styles.ie__functionBar}>
        <div className={cx("ie__functionBar__button", "ie__functionBar__buttonDisable")}>
          <img className={styles.ie__functionBar__icon} src={backIcon} alt="Back" />
          <span className={styles.ie__functionBar__text}>Back</span>
          {/* Drop-down arrow for Back */}
          <div className={styles.ie__functionBar__arrow} />
        </div>

        <div className={cx("ie__functionBar__button", "ie__functionBar__buttonDisable")}>
          <img className={styles.ie__functionBar__icon} src={forwardIcon} alt="Forward" />
          {/* Drop-down arrow for Forward */}
          <div className={styles.ie__functionBar__arrow} />
        </div>

        <div className={styles.ie__functionBar__button}>
          <img className={styles.ie__functionBar__icon} src={noFile} alt="No File" />
          <img className={styles.ie__functionBar__icon} src={refreshFile} alt="Refresh File" />
          <img className={styles.ie__functionBar__icon} src={Home} alt="Home" />
        </div>

        {/* Divider between Home group and Search icon */}
        <div className={styles.ie__functionBar__divider} />

        <div className={styles.ie__functionBar__button}>
          <img className={styles.ie__functionBar__iconSmall} src={searchIcon} alt="Search" />
          <span className={styles.ie__functionBar__text}>Search</span>
        </div>

        <div className={styles.ie__functionBar__button}>
          <img className={styles.ie__functionBar__iconSmall} src={Star} alt="Star" />
          <span className={styles.ie__functionBar__text}>Favourites</span>
        </div>

        <img className={styles.ie__functionBar__icon} src={reverseTime} alt="Reverse Time" />

        {/* Divider between ReverseTime and OpenMail icons */}
        <div className={styles.ie__functionBar__divider} />

        <div className={styles.ie__functionBar__button}>
          <img className={styles.ie__functionBar__icon} src={openMail} alt="Open Mail" />
          {/* Drop-down arrow for Open Mail */}
          <div className={styles.ie__functionBar__arrow} />
        </div>

        <img className={styles.ie__functionBar__iconSmall} src={Printer} alt="Printer" />
        <img className={styles.ie__functionBar__icon} src={Send} alt="Send" />
        <img className={styles.ie__functionBar__iconSmall} src={linksIcon} alt="Links" />
      </section>

      {/* Address Bar */}
      <section className={styles.ie__addressBar}>
        <div className={styles.ie__addressBar__title}>Address</div>
        <div className={styles.ie__addressBar__content}>
          <img
            src={internetIcon}
            alt="InternetIcon"
            className={styles.ie__addressBar__content__img}
          />
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className={styles.ie__addressBar__content__text}
          />
          <span className={styles.ie__functionBar__arrow} />
        </div>
        <div className={styles.ie__addressBar__go} onClick={navigate}>
          <img className={styles.ie__addressBar__go__img} src={goIcon} alt="Go" />
          <span className={styles.ie__addressBar__go__text}>Go</span>
        </div>
        <div className={styles.ie__addressBar__separate} />
        <div className={styles.ie__addressBar__links}>
          <span className={styles.ie__addressBar__links__text}>Links</span>
        </div>
      </section>


  <iframe
    src={url}
    title="Internet Explorer"
    style={{
      flex: 1,
      width: '100%',
      border: 'none',
      margin: 0,
      padding: 0,
      pointerEvents: isFocused ? 'auto' : 'none',
    }}
  />

      <footer className={styles.ie__footer}>
        <div className={styles.ie__footer__status}>
          <img
            className={styles.ie__footer__status__img}
            src={internetIcon}
            alt="InternetIcon"
          />
          <span className={styles.ie__footer__status__text}>Done</span>
        </div>
        <div className={styles.ie__footer__block} />
        <div className={styles.ie__footer__block} />
        <div className={styles.ie__footer__block} />
        <div className={styles.ie__footer__block} />
        <div className={styles.ie__footer__right}>
          <img
            className={styles.ie__footer__right__img}
            src={Globe}
            alt="globe"
          />
          <span className={styles.ie__footer__right__text}>Internet</span>
          <div className={styles.ie__footer__right__dots} />
        </div>
      </footer>
    </div>
  );
}

export default InternetExplorer;
