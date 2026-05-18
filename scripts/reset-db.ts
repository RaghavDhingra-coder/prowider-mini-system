import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import connectToDatabase from "../lib/mongodb";
import AllocationState from "../models/AllocationState";
import Lead from "../models/Lead";
import LeadAssignment from "../models/LeadAssignment";
import Provider from "../models/Provider";
import Service from "../models/Service";
import WebhookEvent from "../models/WebhookEvent";

loadEnvConfig(process.cwd());

const services = ["Service 1", "Service 2", "Service 3"];

const providers = [
  { name: "Provider 1", email: "provider1@example.com" },
  { name: "Provider 2", email: "provider2@example.com" },
  { name: "Provider 3", email: "provider3@example.com" },
  { name: "Provider 4", email: "provider4@example.com" },
  { name: "Provider 5", email: "provider5@example.com" },
  { name: "Provider 6", email: "provider6@example.com" },
  { name: "Provider 7", email: "provider7@example.com" },
  { name: "Provider 8", email: "provider8@example.com" },
];

async function seedServices() {
  const serviceDocs = [];

  for (const name of services) {
    const service = await Service.create({ name });
    serviceDocs.push(service);
  }

  return serviceDocs;
}

async function seedProviders() {
  for (const provider of providers) {
    await Provider.create({
      name: provider.name,
      email: provider.email,
      monthlyQuota: 10,
      leadsReceived: 0,
    });
  }
}

async function seedAllocationStates(serviceDocs: any[]) {
  for (const service of serviceDocs) {
    await AllocationState.create({
      serviceId: service._id,
      currentIndex: 0,
    });
  }
}

async function resetDatabase() {
  try {
    await connectToDatabase();
    console.log("Connected to MongoDB for reset");

    await LeadAssignment.deleteMany({});
    await Lead.deleteMany({});
    await AllocationState.deleteMany({});
    await WebhookEvent.deleteMany({});
    await Service.deleteMany({});
    await Provider.deleteMany({});

    console.log("Cleared app collections");

    const serviceDocs = await seedServices();
    await seedProviders();
    await seedAllocationStates(serviceDocs);

    console.log("Reset completed successfully");
  } catch (error) {
    console.error("Reset failed:", error);
  } finally {
    await mongoose.connection.close();
  }
}

resetDatabase();
