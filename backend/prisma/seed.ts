import { execSync } from 'child_process';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from the .env file
dotenv.config();

async function main() {
  console.log('🚀 Starting database seeding via SQL backup...');

  // ==========================================
  // ⚙️ CONFIGURATION SECTION
  // Edit these settings or configure them in your .env file
  // ==========================================

  // 1. Path to your .sql backup file
  const sqlFilePath = path.join(__dirname, 'ggportal.sql'); 

  // 2. Database settings (reads from process.env or uses default fallbacks)
  const containerName = process.env.DB_CONTAINER_NAME || 'gg_database';
  const dbName = process.env.DB_NAME || 'ggportal';
  const dbUser = process.env.DB_USER || 'root';
  const dbPassword = process.env.DB_PASSWORD || '';

  // Automatically format the password flag for the MySQL command
  const dbPasswordFlag = dbPassword ? `-p${dbPassword}` : '';

  // ==========================================

  // Build the Windows/Docker execution command
  const command = `cmd /c "docker exec -i ${containerName} mysql -u ${dbUser} ${dbPasswordFlag} ${dbName} < "${sqlFilePath}""`;

  console.log(`📥 Importing ${path.basename(sqlFilePath)} into Docker container '${containerName}' (database: ${dbName})...`);

  try {
    // Execute the backup import command
    execSync(command, { stdio: 'inherit' });
    console.log('✅ Database successfully seeded via SQL backup!');
  } catch (error) {
    console.error('❌ Error occurred while importing the SQL backup:', error);
    process.exit(1);
  }
}

main();