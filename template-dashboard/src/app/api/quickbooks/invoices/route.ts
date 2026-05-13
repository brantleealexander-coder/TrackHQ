import { NextRequest, NextResponse } from "next/server";
import { isQBConnected, fetchInvoices } from "@/lib/quickbooks";

export async function GET(request: NextRequest) {
  if (!(await isQBConnected())) {
    return NextResponse.json({ error: "QuickBooks not connected" }, { status: 400 });
  }

  const status = request.nextUrl.searchParams.get("status") ?? undefined;

  try {
    const data = await fetchInvoices(status);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
