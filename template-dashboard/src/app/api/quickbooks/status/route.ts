import { NextResponse } from "next/server";
import { isQBConnected, fetchCompanyInfo } from "@/lib/quickbooks";

export async function GET() {
  const connected = await isQBConnected();

  if (!connected) {
    return NextResponse.json({ connected: false });
  }

  try {
    const companyName = await fetchCompanyInfo();
    return NextResponse.json({ connected: true, companyName });
  } catch {
    return NextResponse.json({ connected: true, companyName: "Connected" });
  }
}
