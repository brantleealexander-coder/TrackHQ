import { NextRequest, NextResponse } from "next/server";
import { isQBConnected, fetchProfitAndLoss } from "@/lib/quickbooks";

export async function GET(request: NextRequest) {
  if (!(await isQBConnected())) {
    return NextResponse.json({ error: "QuickBooks not connected" }, { status: 400 });
  }

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("start_date") ?? undefined;
  const endDate = searchParams.get("end_date") ?? undefined;

  try {
    const data = await fetchProfitAndLoss(startDate, endDate);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
