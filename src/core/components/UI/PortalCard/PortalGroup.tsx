import styles from './PortalCard.module.css';

interface PortalGroupProps {
  children: React.ReactNode; 
  title?: string;             
  className?: string;         
  customBg?: string;          
}

/**
 * PortalGroup serves as a structural wrapper to categorize and bundle multiple 
 * custom PortalCard items together under a neat captioned section layout.
 */
export const PortalGroup = ({ children, title, className, customBg }: PortalGroupProps) => {
  return (
    <div 
      className={`${styles.group} ${className || ''}`} 
      style={{ backgroundColor: customBg } as React.CSSProperties}
    >
      {title && <h2 className={styles.groupTitle}>{title}</h2>}
      
      <div className={styles.groupContent}>
        {children}
      </div>
    </div>
  );
};