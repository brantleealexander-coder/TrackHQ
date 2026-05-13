import { unstable_noStore as noStore } from "next/cache";
import { fetchFleetTelematics, isVisionLinkConfigured } from "@/lib/visionlink";
import TelematicsGrid from "@/components/telematics-grid";

export const dynamic = "force-dynamic";

export default async function TelematicsPage() {
  noStore();

  if (!isVisionLinkConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Telematics</h1>
        <div className="flex flex-col items-center justify-center py-24 px-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center max-w-md">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">VisionLink Not Configured</h2>
            <p className="text-gray-500 text-sm">
              Cat VisionLink API credentials are required to display equipment telematics data.
              Contact your administrator to configure the VisionLink integration.
            </p>
          </div>
        </div>
      </div>
    );
  }

  try {
    const data = await fetchFleetTelematics();

    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Telematics</h1>
        <TelematicsGrid assets={data.assets} fetchedAt={data.fetchedAt} />
      </div>
    );
  } catch (error: any) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Telematics</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-800 font-medium mb-2">Failed to load telematics data</p>
          <p className="text-red-600 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }
}
