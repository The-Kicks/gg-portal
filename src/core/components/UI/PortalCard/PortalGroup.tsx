import styles from './PortalCard.module.css';

interface PortalGroupProps {
  children: React.ReactNode; // Content to be rendered inside the group container
  title?: string;             // Optional header text title for the card collection
  className?: string;         // Optional extra CSS classes injected from parent views
  customBg?: string;          // Optional custom inline background color override
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
      {/* Conditional rendering: Only outputs the heading element if a title string prop is actually provided */}
      {title && <h2 className={styles.groupTitle}>{title}</h2>}
      
      <div className={styles.groupContent}>
        {children} {/* Renders the nested individual child cards */}
      </div>
    </div>
  );
};