import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface PhpMyAdminTheme {
  id: string;
  title: string;
  description: string;
  orgLayer: string;
  miniViewLayers: string;
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
  games: string;
  navbarItems: string;
  labels: string;
  layerMetadata: string;
}

interface PhpMyAdminEntity {
  id: string;
  themeId: string;
  name: string;
  type: string;
  isStandalone: string;
  image: string;
  metadata: string;
  status: string;
}

interface PhpMyAdminConnection {
  id: string;
  themeId: string;
  sourceEntityId: string;
  targetEntityId: string;
  metadata: string;
}

interface TableItem {
  type: string;
  name: string;
  data?: Record<string, unknown>[];
}

async function main() {
  console.log('🧼 Database opschonen...');
  await prisma.entityConnection.deleteMany({});
  await prisma.entity.deleteMany({});
  await prisma.theme.deleteMany({});
  
  const jsonPath = path.join(__dirname, 'seedData.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const databaseExport = JSON.parse(rawData) as TableItem[];

  const themeData = (databaseExport.find(x => x.type === 'table' && x.name === 'theme')?.data || []) as unknown as PhpMyAdminTheme[];
  const entityData = (databaseExport.find(x => x.type === 'table' && x.name === 'entity')?.data || []) as unknown as PhpMyAdminEntity[];
  const connectionData = (databaseExport.find(x => x.type === 'table' && x.name === 'entityconnection')?.data || []) as unknown as PhpMyAdminConnection[];

  // 1. Seed Themes
  console.log(`🎨 ${themeData.length} themes invoeren...`);
  for (const theme of themeData) {
    await prisma.theme.create({
      data: {
        id: theme.id,
        title: theme.title,
        description: theme.description,
        orgLayer: theme.orgLayer,
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        backgroundColor: theme.backgroundColor,
        navbarColor: theme.navbarColor,
        textColor: theme.textColor,
        darkPrimaryColor: theme.darkPrimaryColor || null,
        darkSecondaryColor: theme.darkSecondaryColor || null,
        darkBackgroundColor: theme.darkBackgroundColor || null,
        darkTextColor: theme.darkTextColor || null,
        darkNavbarColor: theme.darkNavbarColor || null,
        miniViewLayers: JSON.parse(theme.miniViewLayers),
        games: JSON.parse(theme.games),
        navbarItems: JSON.parse(theme.navbarItems),
        labels: JSON.parse(theme.labels),
        layerMetadata: JSON.parse(theme.layerMetadata),
      },
    });
  }

  // 2. Seed Entities
  console.log(`📦 ${entityData.length} entities invoeren...`);
  for (const entity of entityData) {
    await prisma.entity.create({
      data: {
        id: entity.id,
        themeId: entity.themeId,
        name: entity.name,
        type: entity.type,
        status: entity.status,
        isStandalone: entity.isStandalone === "1", 
        image: JSON.parse(entity.image),
        metadata: JSON.parse(entity.metadata),
      },
    });
  }

  // 3. Seed Connections
  console.log(`🔗 ${connectionData.length} connecties invoeren...`);
  for (const conn of connectionData) {
    await prisma.entityConnection.create({
      data: {
        id: conn.id,
        themeId: conn.themeId,
        sourceEntityId: conn.sourceEntityId,
        targetEntityId: conn.targetEntityId,
        metadata: JSON.parse(conn.metadata),
      },
    });
  }

  console.log('✅ Starter set succesvol en correct ingeladen!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e: unknown) => {
    console.error('❌ Fout tijdens het seeden:', e);
    await prisma.$disconnect();
    process.exit(1);
  });