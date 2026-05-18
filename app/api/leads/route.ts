import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { assignLead } from "../../../lib/assignLead";
import connectToDatabase from "../../../lib/mongodb";
import { emitLeadAssigned } from "../../../lib/socket-server";

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const name = body.name?.trim();
    const phone = body.phone?.trim();
    const city = body.city?.trim();
    const serviceId = body.serviceId?.trim();
    const description = body.description?.trim();

    // Validate required fields
    if (!name || !phone || !city || !serviceId || !description) {
      return NextResponse.json(
        { success: false, message: "All fields are required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return NextResponse.json(
        { success: false, message: "Invalid service selected" },
        { status: 400 }
      );
    }

    // Lead creation, provider assignment, provider quota updates, and
    // round robin state updates all happen inside one transaction.
    // Automatic retry handles concurrent request conflicts.
    const result = await assignLead({
      name,
      phone,
      city,
      serviceId,
      description,
    });

    emitLeadAssigned();

    // Success response with retry information
    const message = result.retried
      ? `Lead created and assigned successfully after ${result.retryCount} ${
          result.retryCount === 1 ? "retry" : "retries"
        } (transaction conflict resolved, waited ${Math.round(result.totalWaitTime)}ms)`
      : "Lead created and assigned successfully";

    return NextResponse.json(
      {
        success: true,
        message,
        retried: result.retried,
        retryCount: result.retryCount,
        totalWaitTime: Math.round(result.totalWaitTime),
        totalTime: Math.round(result.totalTime),
        lead: result.lead,
        assignedProviders: result.assignedProviders,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create lead error:", error);

    // Duplicate lead (phone + service combination already exists)
    if (error?.code === "DUPLICATE_LEAD") {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          message: error.message,
          retried: false,
          retryCount: 0,
        },
        { status: 409 }
      );
    }

    // Quota exhausted (provider at monthly limit)
    if (error?.code === "QUOTA_EXHAUSTED") {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          message: error.message,
          retried: false,
          retryCount: 0,
        },
        { status: 409 }
      );
    }

    // Insufficient providers (not enough providers with available quota)
    if (error?.code === "NOT_ENOUGH_PROVIDERS") {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          message: error.message,
          retried: false,
          retryCount: 0,
        },
        { status: 409 }
      );
    }

    // Transaction conflict (failed after all retries)
    if (error?.code === "TRANSACTION_CONFLICT") {
      const message = error.retried
        ? `Allocation failed after ${error.retryCount} ${
            error.retryCount === 1 ? "retry" : "retries"
          } (waited ${Math.round(error.totalWaitTime || 0)}ms total). High concurrent load detected. Please try again.`
        : "Transaction conflict occurred. Please try again.";

      return NextResponse.json(
        {
          success: false,
          code: error.code,
          message,
          retried: error.retried || false,
          retryCount: error.retryCount || 0,
          totalWaitTime: Math.round(error.totalWaitTime || 0),
          totalTime: Math.round(error.totalTime || 0),
        },
        { status: 409 }
      );
    }

    // Duplicate provider assignment (should not happen with proper logic)
    if (error?.code === "DUPLICATE_ASSIGNMENT") {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          message: error.message,
          retried: false,
          retryCount: 0,
        },
        { status: 409 }
      );
    }

    // Configuration errors (missing services, providers, or rules)
    if (
      error?.code === "SERVICE_NOT_FOUND" ||
      error?.code === "RULE_NOT_FOUND" ||
      error?.code === "MANDATORY_PROVIDERS_MISSING" ||
      error?.code === "POOL_PROVIDERS_MISSING" ||
      error?.code === "ALLOCATION_STATE_NOT_FOUND"
    ) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: 404 }
      );
    }

    // Invalid rule configuration
    if (error?.code === "INVALID_RULE") {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: 400 }
      );
    }

    // Invalid JSON in request body
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Unexpected errors
    return NextResponse.json(
      { success: false, message: "Failed to create lead" },
      { status: 500 }
    );
  }
}
