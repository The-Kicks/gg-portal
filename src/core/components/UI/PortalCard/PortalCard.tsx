import { useRef } from 'react';
import styles from './PortalCard.module.css';

type CardSize = 25 | 33 | 50 | 66 | 75 | 100;

interface PortalCardProps {
  children: React.ReactNode;
  size?: CardSize;
  customBg?: string;
  spotlight?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * An interactive container tile component that supports dynamic grid sizing presets,
 * structural content mounting, and high-performance cursor tracking spotlight gradients.
 */
export const PortalCard = ({ children, size = 100, spotlight = false, customBg, onClick, className }: PortalCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);

  /**
   * Tracks local cursor coordinates relative to the card container boundaries 
   * and injects position values into CSS variables to drive custom spotlight shaders.
   */
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!spotlight || !cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  const cardClasses = `${styles.card} ${styles[`size${size}`]} ${className || ''}`.trim();

  return (
    <div 
      ref={cardRef}
      className={cardClasses} 
      onClick={onClick}
      onMouseMove={handleMouseMove}
      style={{ backgroundColor: customBg } as React.CSSProperties}
    >
      <div className={styles.spotlight} />
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
};