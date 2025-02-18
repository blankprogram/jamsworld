import React, { useState } from 'react';
import './InternetExplorer.css';

import goIcon from '../../assets/Icons/go.png';
import backIcon from '../../assets/Icons/back.png';
import forwardIcon from '../../assets/Icons/forward.png';
import windowsIcon from '../../assets/Icons/windows.png';
import searchIcon from '../../assets/Icons/search.png';
import linksIcon from '../../assets/Icons/share.png';
import internetIcon from '../../assets/Icons/explorer.png';
import noFile from '../../assets/Icons/nofile.png';
import refreshFile from '../../assets/Icons/refreshfile.png';
import Home from '../../assets/Icons/home.png';
import Star from '../../assets/Icons/star.png';
import reverseTime from '../../assets/Icons/reversetime.png';
import openMail from '../../assets/Icons/openmail.png';
import Printer from '../../assets/Icons/printer.png';
import Send from '../../assets/Icons/send.png';
import Globe from '../../assets/Icons/globe.png';

function InternetExplorer({ isFocused }) {
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
    <div className="ie">
      {/* Toolbar */}
      <section className="ie__toolbar">
        <div className="ie__options">
          <div className="drop-down">
            <div className="drop-down__label">File</div>
          </div>
          <div className="drop-down">
            <div className="drop-down__label">Edit</div>
          </div>
          <div className="drop-down">
            <div className="drop-down__label">View</div>
          </div>
          <div className="drop-down">
            <div className="drop-down__label">Favorites</div>
          </div>
          <div className="drop-down">
            <div className="drop-down__label">Tools</div>
          </div>
          <div className="drop-down">
            <div className="drop-down__label">Help</div>
          </div>
        </div>
        <img className="ie__windows-logo" src={windowsIcon} alt="windows" />
      </section>

      {/* Function Bar */}
      <section className="ie__function_bar">
  <div className="ie__function_bar__button ie__function_bar__button--disable">
    <img className="ie__function_bar__icon" src={backIcon} alt="Back" />
    <span className="ie__function_bar__text">Back</span>
    {/* Drop-down arrow for Back */}
    <div className="ie__function_bar__arrow"></div>
  </div>

  <div className="ie__function_bar__button ie__function_bar__button--disable">
    <img className="ie__function_bar__icon" src={forwardIcon} alt="Forward" />

    {/* Drop-down arrow for Forward */}
    <div className="ie__function_bar__arrow"></div>
  </div>

  <div className="ie__function_bar__button">
    <img className="ie__function_bar__icon" src={noFile} alt="No File" />
    <img className="ie__function_bar__icon" src={refreshFile} alt="Refresh File" />
    <img className="ie__function_bar__icon" src={Home} alt="Home" />
  </div>

  {/* Divider between Home group and Search icon */}
  <div className="ie__function_bar__divider"></div>

  <div className="ie__function_bar__button">
    <img className="ie__function_bar__icon--small" src={searchIcon} alt="Search" />
    <span className="ie__function_bar__text">Search</span>
  </div>

  <div className="ie__function_bar__button">
    <img className="ie__function_bar__icon--small" src={Star} alt="Star" />
    <span className="ie__function_bar__text">Favourites</span>
  </div>

  <img className="ie__function_bar__icon" src={reverseTime} alt="Reverse Time" />

  {/* Divider between ReverseTime and OpenMail icons */}
  <div className="ie__function_bar__divider"></div>

  <div className="ie__function_bar__button">
    <img className="ie__function_bar__icon" src={openMail} alt="Open Mail" />
    {/* Drop-down arrow for Open Mail */}
    <div className="ie__function_bar__arrow"></div>
  </div>

  <img className="ie__function_bar__icon--small" src={Printer} alt="Printer" />
  <img className="ie__function_bar__icon" src={Send} alt="Send" />
  <img className="ie__function_bar__icon--small" src={linksIcon} alt="Links" />
</section>


      {/* Address Bar */}
      <section className="ie__address_bar">
        <div className="ie__address_bar__title">Address</div>
        <div className="ie__address_bar__content">
          <img
            src={internetIcon}
            alt="InternetIcon"
            className="ie__address_bar__content__img"
          />
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className="ie__address_bar__content__text"
          />
          <span className="ie__function_bar__arrow"></span>
        </div>
        <div className="ie__address_bar__go" onClick={navigate}>
          <img className="ie__address_bar__go__img" src={goIcon} alt="Go" />
          <span className="ie__address_bar__go__text">Go</span>
        </div>
        <div className="ie__address_bar__separate"></div>
        <div className="ie__address_bar__links">
          <span className="ie__address_bar__links__text">Links</span>
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

      <footer className="ie__footer">
        <div className="ie__footer__status">
          <img
            className="ie__footer__status__img"
            src={internetIcon}
            alt="InternetIcon"
          />
          <span className="ie__footer__status__text">Done</span>
        </div>
        <div className="ie__footer__block"></div>
        <div className="ie__footer__block"></div>
        <div className="ie__footer__block"></div>
        <div className="ie__footer__block"></div>
        <div className="ie__footer__right">
          <img
            className="ie__footer__right__img"
            src={Globe}
            alt="globe"
          />
          <span className="ie__footer__right__text">Internet</span>
          <div className="ie__footer__right__dots"></div>
        </div>
      </footer>
    </div>
  );
}

export default InternetExplorer;
