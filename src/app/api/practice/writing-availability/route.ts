import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getWritingAvailability } from "@/lib/practice/writing-availability";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const availability = await getWritingAvailability();
  return NextResponse.json(availability);
}
