import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import connectToDatabase from "../lib/mongodb";
import AllocationState from "../models/AllocationState";
import Provider from "../models/Provider";
import Service from "../models/Service";

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
    const service = await Service.findOneAndUpdate(
      { name },
      { $setOnInsert: { name } },
      { new: true, upsert: true }
    );

    serviceDocs.push(service);
  }

  return serviceDocs;
}

async function seedProviders() {
  for (const provider of providers) {
    await Provider.findOneAndUpdate(
      { name: provider.name },
      {
        $set: {
          email: provider.email,
          monthlyQuota: 10,
        },
        $setOnInsert: {
          name: provider.name,
          leadsReceived: 0,
        },
      },
      { new: true, upsert: true }
    );
  }
}

async function seedAllocationStates(serviceDocs: any[]) {
  for (const service of serviceDocs) {
    await AllocationState.findOneAndUpdate(
      { serviceId: service._id },
      {
        $setOnInsert: {
          serviceId: service._id,
          currentIndex: 0,
        },
      },
      { new: true, upsert: true }
    );
  }
}

async function seedDatabase() {
  try {
    await connectToDatabase();

    console.log("Connected to MongoDB for seeding");

    const serviceDocs = await seedServices();
    await seedProviders();
    await seedAllocationStates(serviceDocs);

    console.log("Seed completed successfully");
    console.log("Services seeded:", serviceDocs.map((service) => service.name));
    console.log("Total providers seeded:", providers.length);
  } catch (error) {
    console.error("Seed failed:", error);
  } finally {
    await mongoose.connection.close();
  }
}

seedDatabase();
