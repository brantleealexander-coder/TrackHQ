import { NextResponse } from "next/server";
import { isQBConnected, fetchBills } from "@/lib/quickbooks";

export async function GET() {
  if (!(await isQBConnected())) {
    return NextResponse.json({ error: "QuickBooks not connected" }, { status: 400 });
  }

  try {
    const data = await fetchBills();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
