export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-6">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: April 7, 2026</p>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <p>
            This application is a private, internal-use dashboard built for CrossMar Equipment Rental.
            It connects to QuickBooks Online solely to display financial data to authorized CrossMar personnel.
          </p>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Data Collection</h2>
            <p>
              This application accesses QuickBooks Online accounting data (invoices, reports,
              customer/vendor records) through Intuit&apos;s API. No data is sold, shared with third
              parties, or used for any purpose other than displaying it within this private dashboard.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Data Storage</h2>
            <p>
              QuickBooks API access tokens are stored securely in a database accessible only to
              authorized personnel. Cached financial data is stored temporarily (15 minutes) to
              improve performance and is automatically refreshed.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Access</h2>
            <p>
              This application is password-protected and accessible only to authorized CrossMar
              leadership and staff.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Contact</h2>
            <p>
              For questions regarding this privacy policy, contact CrossMar Equipment Rental.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
