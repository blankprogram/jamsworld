import React from 'react';
import styles from './LoadingScreen.module.css';
import xp from '../../assets/Icons/xp.png';

const LoadingScreen = ({ onClick }) => {
  return (
    <div className={styles.loadingScreenContainer} onClick={onClick}>
      <div className={styles.window}>
        <div className={styles.logo}>
          <div className={styles.microsoftWithIcon}>
            <p className={styles.top}>Microsoft</p>
            <img src={xp} alt="XP Logo" className={styles.xpIcon} />
          </div>
          <p className={styles.mid}>
            Windows<span>XP</span>
          </p>
        </div>
        <div className={styles.container}>
          <div className={styles.box}></div>
          <div className={styles.box}></div>
          <div className={styles.box}></div>
        </div>
        <p className={styles.clickText}>Click anywhere to start ...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
