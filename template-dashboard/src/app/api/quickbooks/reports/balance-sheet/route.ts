import { NextRequest, NextResponse } from "next/server";
import { isQBConnected, fetchBalanceSheet } from "@/lib/quickbooks";

export async function GET(request: NextRequest) {
  if (!(await isQBConnected())) {
    return NextResponse.json({ error: "QuickBooks not connected" }, { status: 400 });
  }

  const asOf = request.nextUrl.searchParams.get("as_of") ?? undefined;

  try {
    const data = await fetchBalanceSheet(asOf);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
