import React, { useState } from 'react';

function InternetExplorer({ isFocused }) {
  const [url, setUrl] = useState("https://blankprogram.github.io/jamsworld/");
  const [inputValue, setInputValue] = useState(url);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const navigate = () => {
    let formattedUrl = inputValue.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = "https://" + formattedUrl;
    }
    setUrl(formattedUrl);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
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
