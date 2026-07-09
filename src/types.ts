import type { ThemeGameSettings } from './core/gamesConfig';

export type GameID = "guesswho" | "sorter" | "blindranking";

export type LayerKey = "l1" | "l2" | "l3" | "l4" | "l5" | string;

/**
 * Defines the structured image assets required for entity visualization,
 * supporting both standard overview grids and wide profile banners.
 */
export interface EntityImages {
  profileCard: string;
  heroBanner: string;
  [themeKey: string]: string | string[] | undefined;
}

/**
 * Represents the historical and relational timeline metadata linking two distinct entities.
 */
export interface ConnectionMetadata {
  role?: string;
  status: "active" | "former" | "inactive" | string;
  startDate?: string;
  endDate?: string;
  excludedPeriods?: string;
  hideFromGrid?: boolean;
  [key: string]: unknown;
}

/**
 * The foundational data structure representing a core node within the relational graph database.
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
 * An extended entity model that encapsulates fully populated incoming and outgoing graph relationships.
 */
export interface HydratedEntity extends BaseEntity {
  connections?: HydratedEntityConnection[];
  targetConnections?: HydratedEntityConnection[];
}

/**
 * Represents a fully resolved structural bridge between a source entity and a target entity.
 */
export interface HydratedEntityConnection {
  id: number;
  themeId: string;
  sourceEntityId: string;
  targetEntityId: string;
  metadata: ConnectionMetadata;
  sourceEntity?: BaseEntity;
  targetEntity?: BaseEntity;
}

/**
 * Configuration schema dictating how dynamic entity metadata properties map to UI components and alert statuses.
 */
export interface MetaDataStandard {
  badgeKey: string;
  subtitleKey: string;
  gridKeys: string[];
  mediaKeys: string[];

  statusTriggers?: {
    former?: { key: string; value: string };
    alert?: { key: string; value: string };
    warning?: { key: string; value: string }; 
    info?: { key: string; value: string };
  };
}

/**
 * The master configuration schema encompassing visual branding configurations, 
 * layer setups, game settings, and associated graph datasets for a portal theme.
 */
export interface Theme {
  id: string;
  title: string;
  description: string;

  layerMetadata: Record<LayerKey, MetaDataStandard | undefined>;
  labels: Record<LayerKey, string | undefined>;

  orgLayer: LayerKey;
  miniViewLayers: LayerKey[];

  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  navbarColor: string;
  textColor: string;

  darkPrimaryColor?: string;
  darkSecondaryColor?: string;
  darkBackgroundColor?: string;
  darkTextColor?: string;
  darkNavbarColor?: string;

  games: GameID[];
  gameSettings?: ThemeGameSettings;
  navbarItems: string[];

  entities?: HydratedEntity[];
}