export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-6">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Terms of Use</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: April 7, 2026</p>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <p>
            This application is a proprietary, internal-use dashboard operated by CrossMar Equipment
            Rental. Access is restricted to authorized personnel only.
          </p>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Terms of Access</h2>
            <p>By using this application, you agree that:</p>
            <ol className="list-decimal list-inside mt-2 space-y-1.5">
              <li>You are an authorized employee or contractor of CrossMar Equipment Rental.</li>
              <li>You will not share login credentials or financial data with unauthorized parties.</li>
              <li>This application is provided as-is for internal business use.</li>
              <li>All QuickBooks data displayed is read-only and subject to Intuit&apos;s terms of service.</li>
            </ol>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Licensing</h2>
            <p>
              This software is licensed exclusively to CrossMar Equipment Rental for internal use.
              Unauthorized reproduction, distribution, or modification is prohibited.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Contact</h2>
            <p>
              For questions regarding these terms, contact CrossMar Equipment Rental.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
