import { useRef } from 'react';
import styles from './PortalCard.module.css';

// Fixed allowable structural flex grid percentages width keys 
type CardSize = 25 | 33 | 50 | 66 | 75 | 100;

interface PortalCardProps {
  children: React.ReactNode;
  size?: CardSize;           // Determines card width percentage layout sizing presets
  customBg?: string;         // Optional custom inline background color override
  spotlight?: boolean;       // Toggles whether the reactive cursor flashlight effect triggers
  onClick?: () => void;      // Optional click handler function
  className?: string;        
}

/**
 * PortalCard is an interactive dashboard item button tile.
 * It features entry animations, hover liftoffs, and an advanced high-performance 
 * mouse-tracking spotlight gradient flashlight glow effect.
 */
export const PortalCard = ({ children, size = 100, spotlight = false, customBg, onClick, className }: PortalCardProps) => {
  // Directly targets the specific underlying raw HTML div element container in the DOM tree
  const cardRef = useRef<HTMLDivElement>(null);

  /**
   * Tracks local cursor spatial movements across the individual card box surface area boundaries.
   * Directly injects relative coordinates into CSS variables to drive the glowing spotlight shader.
   */
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Guards: Stop instantly if spotlight toggles are disabled or the DOM reference node isn't initialized
    if (!spotlight || !cardRef.current) return;
    
    // Finds the absolute physical pixel boundaries and location coordinates of this card on the screen
    const rect = cardRef.current.getBoundingClientRect();
    
    // Mathematical subtraction isolates local X/Y coordinates relative to the card's top-left corner
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Direct DOM styling manipulation bypassing heavy React structural state re-renders for high-performance fluid animations
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  // Assembles clean string class listings, removing trailing whitespace fragments with trim()
  const cardClasses = `${styles.card} ${styles[`size${size}`]} ${className || ''}`.trim();

  return (
    <div 
      ref={cardRef}
      className={cardClasses} 
      onClick={onClick}
      onMouseMove={handleMouseMove}
      style={{ backgroundColor: customBg } as React.CSSProperties}
    >
      {/* Hidden layer absolute box wrapper container that renders the gradient flashlight circular beam shine */}
      <div className={styles.spotlight} />
      
      {/* Upper layered content container grouping holding text elements safely above background effects */}
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
};