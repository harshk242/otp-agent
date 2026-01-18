#!/usr/bin/env node

/**
 * CLI Runner for ClinPGx URL Migration
 * 
 * This script invokes the Convex migration action to fix ClinPGx URLs
 * in all existing target reports.
 * 
 * Usage:
 *   node scripts/migrate-clinpgx-urls.js [--dry-run] [--batch-size=50]
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ Error: VITE_CONVEX_URL not found in .env.local");
  console.error("   Please make sure your .env.local file contains the Convex URL");
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const batchSizeArg = args.find(arg => arg.startsWith("--batch-size="));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split("=")[1]) : 50;

async function runMigration() {
  console.log("🔧 ClinPGx URL Migration Script");
  console.log("================================\n");

  const client = new ConvexHttpClient(CONVEX_URL);

  try {
    console.log("🌐 Connecting to Convex...");
    console.log(`   URL: ${CONVEX_URL}\n`);

    const result = await client.action(api.migrations.fixClinpgxUrls.migrateClinpgxUrls, {
      dryRun,
      batchSize,
    });

    console.log("\n================================");
    console.log("✅ Migration script completed!");
    console.log("================================\n");

    return result;
  } catch (error) {
    console.error("\n================================");
    console.error("❌ Migration failed!");
    console.error("================================\n");
    console.error("Error:", error);
    process.exit(1);
  }
}

// Show help
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
ClinPGx URL Migration Script

Usage:
  node scripts/migrate-clinpgx-urls.js [options]

Options:
  --dry-run           Run migration without making changes (preview mode)
  --batch-size=N      Process N reports at a time (default: 50)
  --help, -h          Show this help message

Examples:
  # Preview what will be changed (dry run)
  node scripts/migrate-clinpgx-urls.js --dry-run

  # Run the migration
  node scripts/migrate-clinpgx-urls.js

  # Run with custom batch size
  node scripts/migrate-clinpgx-urls.js --batch-size=100

  # Dry run with custom batch size
  node scripts/migrate-clinpgx-urls.js --dry-run --batch-size=25
  `);
  process.exit(0);
}

// Run the migration
runMigration()
  .then((result) => {
    if (result.dryRun) {
      console.log("💡 Tip: Run without --dry-run to apply these changes");
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
