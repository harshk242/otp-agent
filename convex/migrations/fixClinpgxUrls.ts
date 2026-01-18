/**
 * Migration Script: Fix ClinPGx URLs in Safety Signals
 * 
 * This script updates all existing target reports in the database
 * to replace broken ClinPGx URLs with working ones.
 * 
 * Run with: npm run migration:fix-clinpgx-urls
 */

import { mutation, action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { getGenePageUrlBySymbol } from "../lib/clients/clinpgxClient";

/**
 * Main migration action - orchestrates the migration
 */
export const migrateClinpgxUrls = action({
  args: {
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const batchSize = args.batchSize ?? 50;

    console.log("🚀 Starting ClinPGx URL migration...");
    console.log(`   Dry run: ${dryRun ? "YES (no changes will be made)" : "NO (will update database)"}`);
    console.log(`   Batch size: ${batchSize}`);
    console.log("");

    // Get all target reports that need fixing
    const reportsToFix = await ctx.runMutation(api.migrations.fixClinpgxUrls.getReportsWithClinpgx);
    
    console.log(`📊 Found ${reportsToFix.length} target reports to check`);
    console.log("");

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    const failedGenes: string[] = [];

    // Process in batches
    for (let i = 0; i < reportsToFix.length; i += batchSize) {
      const batch = reportsToFix.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(reportsToFix.length / batchSize)}...`);

      for (const report of batch) {
        totalProcessed++;
        
        try {
          const geneSymbol = report.targetInfo.symbol;
          
          // Get ClinPGx URL
          const clinpgxUrl = await getGenePageUrlBySymbol(geneSymbol);
          
          if (!clinpgxUrl) {
            console.log(`   ⚠️  Gene ${geneSymbol} not found in ClinPGx`);
            failedGenes.push(geneSymbol);
            totalFailed++;
            continue;
          }

          // Check if any safety signals need updating
          const needsUpdate = report.safetySignals.some((signal: any) =>
            signal.evidence.some((ev: any) => 
              ev.source === "ClinPGx" && ev.url !== clinpgxUrl
            )
          );

          if (!needsUpdate) {
            console.log(`   ✓ ${geneSymbol} - Already up to date`);
            continue;
          }

          if (!dryRun) {
            // Update the report
            await ctx.runMutation(api.migrations.fixClinpgxUrls.updateReportUrls, {
              reportId: report._id,
              clinpgxUrl,
            });
            console.log(`   ✅ ${geneSymbol} - Updated to ${clinpgxUrl}`);
          } else {
            console.log(`   🔍 ${geneSymbol} - Would update to ${clinpgxUrl}`);
          }
          
          totalUpdated++;

        } catch (error) {
          console.error(`   ❌ Error processing ${report.targetInfo.symbol}:`, error);
          failedGenes.push(report.targetInfo.symbol);
          totalFailed++;
        }
      }

      // Small delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log("");
    console.log("=" .repeat(60));
    console.log("📈 Migration Summary");
    console.log("=" .repeat(60));
    console.log(`Total reports processed: ${totalProcessed}`);
    console.log(`Successfully updated: ${totalUpdated}`);
    console.log(`Failed/Not found: ${totalFailed}`);
    console.log("");
    
    if (failedGenes.length > 0) {
      console.log(`⚠️  Genes not found in ClinPGx (${failedGenes.length}):`);
      console.log(failedGenes.join(", "));
      console.log("");
    }

    if (dryRun) {
      console.log("🔍 This was a DRY RUN - no changes were made to the database");
      console.log("   Run with dryRun: false to apply changes");
    } else {
      console.log("✅ Migration completed successfully!");
    }

    return {
      totalProcessed,
      totalUpdated,
      totalFailed,
      failedGenes,
      dryRun,
    };
  },
});

/**
 * Query to get all reports with ClinPGx safety signals
 */
export const getReportsWithClinpgx = mutation({
  args: {},
  handler: async (ctx) => {
    const allReports = await ctx.db.query("targetReports").collect();
    
    // Filter reports that have at least one ClinPGx safety signal
    const reportsWithClinpgx = allReports.filter((report: any) =>
      report.safetySignals.some((signal: any) =>
        signal.evidence.some((ev: any) => ev.source === "ClinPGx")
      )
    );

    return reportsWithClinpgx.map((report: any) => ({
      _id: report._id,
      targetInfo: report.targetInfo,
      safetySignals: report.safetySignals,
    }));
  },
});

/**
 * Mutation to update a single report's ClinPGx URLs
 */
export const updateReportUrls = mutation({
  args: {
    reportId: v.id("targetReports"),
    clinpgxUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error(`Report ${args.reportId} not found`);
    }

    // Update safety signals
    const updatedSignals = report.safetySignals.map((signal: any) => ({
      ...signal,
      evidence: signal.evidence.map((ev: any) => {
        // Only update ClinPGx evidence URLs
        if (ev.source === "ClinPGx") {
          return {
            ...ev,
            url: args.clinpgxUrl,
          };
        }
        return ev;
      }),
    }));

    // Update the report
    await ctx.db.patch(args.reportId, {
      safetySignals: updatedSignals,
    });
  },
});
