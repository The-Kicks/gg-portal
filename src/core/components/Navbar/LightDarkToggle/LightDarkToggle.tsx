import styles from '../LightDarkToggle/LightDarkToggle.module.css';

/**
 * Prop definitions for the LightDarkToggle component.
 * It expects the current visual mode state (true for dark, false for light)
 * and a callback function to notify the parent app component when clicked.
 */
interface Props {
  isDark: boolean;
  onToggle: () => void;
}

/**
 * LightDarkToggle is a custom visual sliding switch component.
 * It displays a sun and moon icon, animating a sliding selector thumb
 * based on the current global application styling state.
 */
export const LightDarkToggle = ({ isDark, onToggle }: Props) => {
  return (
    /* The outer container bar representing the slider track.
      It dynamically appends the 'trackDark' class name modifiers using template strings 
      if the dark mode styling condition evaluated to true.
    */
    <div 
      className={`${styles.track} ${isDark ? styles.trackDark : ''}`} 
      onClick={onToggle}
    >
      {/* Sun icon visual indicator on the left side of the slider layout */}
      <span className={`${styles.icon} ${styles.sunIcon}`}>☀️</span>
      
      {/* The actual sliding circular handle (thumb).
        It shifts physical position horizontally to the right via the 'thumbRight' CSS module rule
        whenever dark mode state evaluations are active.
      */}
      <div className={`${styles.thumb} ${isDark ? styles.thumbRight : ''}`} />
      
      {/* Moon icon visual indicator on the right side of the slider layout */}
      <span className={`${styles.icon} ${styles.moonIcon}`}>🌙</span>
    </div>
  );
};