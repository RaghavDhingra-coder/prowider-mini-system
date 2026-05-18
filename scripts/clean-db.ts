import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import connectToDatabase from "../lib/mongodb";
import AllocationState from "../models/AllocationState";
import Lead from "../models/Lead";
import LeadAssignment from "../models/LeadAssignment";
import Provider from "../models/Provider";
import WebhookEvent from "../models/WebhookEvent";

loadEnvConfig(process.cwd());

async function cleanDatabase() {
  try {
    console.log("Starting database cleanup...");
    await connectToDatabase();
    console.log("Connected to MongoDB for cleanup");

    console.log("Deleting all leads...");
    const deletedLeads = await Lead.deleteMany({});
    console.log(`Deleted leads: ${deletedLeads.deletedCount}`);

    console.log("Deleting all lead assignments...");
    const deletedAssignments = await LeadAssignment.deleteMany({});
    console.log(`Deleted lead assignments: ${deletedAssignments.deletedCount}`);

    console.log("Deleting all webhook events...");
    const deletedWebhookEvents = await WebhookEvent.deleteMany({});
    console.log(`Deleted webhook events: ${deletedWebhookEvents.deletedCount}`);

    console.log("Resetting all providers: leadsReceived -> 0...");
    const resetProviders = await Provider.updateMany(
      {},
      { $set: { leadsReceived: 0 } }
    );
    console.log(`Providers reset: ${resetProviders.modifiedCount}`);
    console.log(`Providers matched: ${resetProviders.matchedCount}`);

    console.log("Resetting all allocation states: currentIndex -> 0...");
    const resetAllocationStates = await AllocationState.updateMany(
      {},
      { $set: { currentIndex: 0 } }
    );
    console.log(`Allocation states reset: ${resetAllocationStates.modifiedCount}`);
    console.log(`Allocation states matched: ${resetAllocationStates.matchedCount}`);

    console.log("Database cleanup completed successfully");
    console.log("Services preserved");
    console.log("Providers preserved");
  } catch (error) {
    console.error("Database cleanup failed:", error);
    process.exitCode = 1;
  } finally {
    console.log("Closing MongoDB connection...");
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
}

cleanDatabase();
