import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectToDatabase from "../../../../lib/mongodb";
import Provider from "../../../../models/Provider";
import WebhookEvent from "../../../../models/WebhookEvent";

export async function POST(request: Request) {
  let eventId = "";

  try {
    await connectToDatabase();

    const body = await request.json();
    eventId = body.eventId?.trim();

    if (!eventId) {
      return NextResponse.json(
        {
          success: false,
          message: "eventId is required",
        },
        { status: 400 }
      );
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Idempotency flow:
      // 1. Try to save the webhook event first inside the transaction.
      // 2. If the same eventId already exists, MongoDB unique index blocks it.
      // 3. Only brand new eventIds are allowed to reset quotas.
      await WebhookEvent.create(
        [
          {
            eventId,
            processed: true,
          },
        ],
        { session }
      );

      const resetResult = await Provider.updateMany(
        {},
        {
          $set: {
            monthlyQuota: 10,
            leadsReceived: 0,
          },
        },
        { session }
      );

      console.log("Quota reset: providers updated", {
        eventId,
        providersMatched: resetResult.matchedCount,
        providersUpdated: resetResult.modifiedCount,
        monthlyQuota: 10,
        leadsReceived: 0,
      });

      await session.commitTransaction();

      return NextResponse.json({
        success: true,
        duplicate: false,
        message: "Provider quotas reset successfully",
        providersUpdated: resetResult.modifiedCount,
        eventId,
      });
    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    console.error("Reset quotas webhook error:", error);

    if (error?.code === 11000 && error?.keyPattern?.eventId) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: "Duplicate webhook ignored",
        eventId: error?.keyValue?.eventId || eventId,
      });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON body",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to reset provider quotas",
      },
      { status: 500 }
    );
  }
}
