import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import Provider from "../../../models/Provider";

export async function GET() {
  try {
    await connectToDatabase();

    const providers = await Provider.aggregate([
      {
        $lookup: {
          from: "leadassignments",
          localField: "_id",
          foreignField: "providerId",
          as: "assignments",
        },
      },
      {
        $lookup: {
          from: "leads",
          localField: "assignments.leadId",
          foreignField: "_id",
          as: "leads",
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "leads.serviceId",
          foreignField: "_id",
          as: "services",
        },
      },
      {
        $addFields: {
          remainingQuota: { $subtract: ["$monthlyQuota", "$leadsReceived"] },
          assignedLeads: {
            $map: {
              input: "$leads",
              as: "lead",
              in: {
                customerName: "$$lead.name",
                phone: "$$lead.phone",
                city: "$$lead.city",
                description: "$$lead.description",
                createdAt: "$$lead.createdAt",
                serviceName: {
                  $let: {
                    vars: {
                      matchedService: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$services",
                              as: "service",
                              cond: { $eq: ["$$service._id", "$$lead.serviceId"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: "$$matchedService.name",
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          assignments: 0,
          leads: 0,
          services: 0,
          __v: 0,
        },
      },
      {
        $sort: { name: 1 },
      },
    ]);

    return NextResponse.json({
      success: true,
      providers,
    });
  } catch (error) {
    console.error("Get dashboard error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
