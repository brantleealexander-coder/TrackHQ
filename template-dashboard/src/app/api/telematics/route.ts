import { NextResponse } from "next/server";
import { fetchFleetTelematics, isVisionLinkConfigured } from "@/lib/visionlink";

export async function GET() {
  if (!isVisionLinkConfigured()) {
    return NextResponse.json({ configured: false, assets: [] });
  }

  try {
    const data = await fetchFleetTelematics();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message, configured: true, assets: [] }, { status: 500 });
  }
}
