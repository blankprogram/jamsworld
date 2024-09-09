import React from 'react';
import styles from './WelcomeScreen.module.css';

const WelcomeScreen = () => {
  return (
    <div className={styles.welcomeScreen}>
      <div className={styles.topBar}></div>
      <div className={styles.middleSection}>
        <div className={styles.fullCircle}></div>
        <p className={styles.welcomeMessage}>welcome</p>
      </div>
      <div className={styles.bottomBar}></div>
    </div>
  );
};

export default WelcomeScreen;
