import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import Service from "../../../models/Service";

export async function GET() {
  try {
    await connectToDatabase();

    const services = await Service.find().sort({ name: 1 }).lean();

    console.log("GET /api/services count:", services.length);
    console.log("GET /api/services names:", services.map((service) => service.name));

    return NextResponse.json({ success: true, services });
  } catch (error) {
    console.error("Get services error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch services" },
      { status: 500 }
    );
  }
}
