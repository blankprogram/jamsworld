import React, { useState } from 'react';

function InternetExplorer({ isFocused }) {
  const defaultUrl = window.location.origin + window.location.pathname;

  const getNestedUrl = (baseUrl) => {
    const urlObj = new URL(baseUrl, window.location.href);
    const currentNest = Number(urlObj.searchParams.get('nest')) || 0;
    urlObj.searchParams.set('nest', currentNest + 1);
    return urlObj.toString();
  };

  const initialUrl = getNestedUrl(window.location.href);


  const [url, setUrl] = useState(initialUrl);
  const [inputValue, setInputValue] = useState(initialUrl);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const navigate = () => {
    let formattedUrl = inputValue.trim();

    if (formattedUrl.startsWith(defaultUrl)) {
      formattedUrl = getNestedUrl(formattedUrl);
    }
    setUrl(formattedUrl);
    setInputValue(formattedUrl);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      navigate();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
      }}
    >
      <div
        style={{
          flex: '0 0 35px',
          backgroundColor: '#ccc',
          display: 'flex',
          alignItems: 'center',
          padding: '5px',
        }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          style={{
            flex: 1,
            padding: '5px',
            border: '1px solid #999',
            borderRadius: '3px',
          }}
        />
        <button
          onClick={navigate}
          style={{
            padding: '5px 10px',
            marginLeft: '5px',
            cursor: 'pointer',
          }}
        >
          Go
        </button>
      </div>

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
    </div>
  );
}

export default InternetExplorer;
