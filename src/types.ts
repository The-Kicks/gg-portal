import type { ThemeGameSettings } from './core/gamesConfig';
/**
 * Identifiers for the available games within the portal.
 */
export type GameID = "guesswho" | "sorter" | "blindranking";


/**
 * Core identifiers for the organizational layers.
 * Fully dynamic to support 2, 3, 4, 5 or more layers seamlessly.
 */
export type LayerKey = "l1" | "l2" | "l3" | "l4" | "l5" | string;

/**
 * Structural images for any entity card or profile banner.
 */
export interface EntityImages {
  profileCard: string;    // Square/vertical image for overview grids
  heroBanner: string;     // Wide layout background banner for profiles
  [themeKey: string]: string | string[] | undefined;
}

/**
 * Connection Metadata represents the timeline relationship between two entities.
 */
export interface ConnectionMetadata {
  role?: string;             // e.g., "driver", "soloist", "main-vocalist", "midfielder"
  status: "active" | "former" | "inactive" | string;
  startDate?: string;        // e.g., "2008" or "2023-04-12"
  endDate?: string;          // null/undefined means ongoing active connection
  hideFromGrid?: boolean;    // Manual override to hide an entry from group layouts
  [key: string]: unknown;
}

/**
 * The fundamental data unit for any entity in the system.
 */
export interface BaseEntity {
  id: string;
  themeId: string;
  name: string;
  type: LayerKey;
  status?: "active" | "disbanded" | "inactive" | "retired" | string;
  isStandalone: boolean;
  image: EntityImages;
  metadata: Record<string, string | number | boolean | string[] | undefined>;
}

/**
 * Extended entity interface including hydrated relational graph data from Prisma.
 */
export interface HydratedEntity extends BaseEntity {
  connections?: HydratedEntityConnection[];       // Outgoing connections (e.g., Driver -> Team)
  targetConnections?: HydratedEntityConnection[]; // Incoming connections (e.g., Team -> Drivers)
}

/**
 * Connection data populated with populated entity references.
 */
export interface HydratedEntityConnection {
  id: number;
  themeId: string;
  sourceEntityId: string;
  targetEntityId: string;
  metadata: ConnectionMetadata;
  sourceEntity?: BaseEntity;
  targetEntity?: BaseEntity; // Heavily used to track what group/label this link connects to
}

/**
 * Configuration for how metadata is mapped to the UI components.
 */
export interface MetaDataStandard {
  badgeKey: string;      // Metadata key to show as a badge (e.g., "Position")
  subtitleKey: string;   // Metadata key to show as a subtitle (e.g., "Nationality")
  gridKeys: string[];    // List of metadata keys to display in the data grid 

  statusTriggers?: {
    former?: { key: string; value: string };
    alert?: { key: string; value: string };
    warning?: { key: string; value: string }; 
    info?: { key: string; value: string };
  };
}

/**
 * The master configuration for a Portal Theme.
 */
export interface Theme {
  id: string;
  title: string;
  description: string;

  layerMetadata: Record<LayerKey, MetaDataStandard | undefined>;
  labels: Record<LayerKey, string | undefined>;

  orgLayer: LayerKey;
  miniViewLayers: LayerKey[];

  /* --- Visual Branding (Light Mode) --- */
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  navbarColor: string;
  textColor: string;

  /* --- Visual Branding (Dark Mode) --- */
  darkPrimaryColor?: string;
  darkSecondaryColor?: string;
  darkBackgroundColor?: string;
  darkTextColor?: string;
  darkNavbarColor?: string;

  games: GameID[];
  gameSettings?: ThemeGameSettings;
  navbarItems: string[];

  /** The complete dataset containing all hydrated nodes for this theme graph */
  entities?: HydratedEntity[];
}