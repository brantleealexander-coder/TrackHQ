import { unstable_noStore as noStore } from "next/cache";
import { listDocuments } from "@/lib/document-queries";
import DocumentUploader from "@/components/documents/document-uploader";
import DocumentRowActions from "@/components/documents/document-row-actions";

export const dynamic = "force-dynamic";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function mimeLabel(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("word")) return "DOCX";
  if (mime === "image/png") return "PNG";
  if (mime === "image/jpeg") return "JPG";
  return mime.split("/")[1]?.toUpperCase() ?? "FILE";
}

export default async function DocumentsPage() {
  noStore();
  const documents = await listDocuments();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Templates your team uses on every rental — agreements, waivers,
          and operating docs. Attach any of these to an order from the order page.
        </p>
      </div>

      {/* Uploader */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Upload a document
        </h2>
        <DocumentUploader />
      </section>

      {/* Library */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Library</h2>
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600">
            {documents.length}
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <p className="text-base font-medium text-gray-700">No documents yet.</p>
            <p className="mt-1 text-sm text-gray-500">
              Upload a rental agreement or waiver template to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50/80">
                <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5 text-right">Size</th>
                  <th className="px-4 py-2.5">Uploaded</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-gray-50/60">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{d.name}</p>
                      {d.description && (
                        <p className="mt-0.5 text-[11px] text-gray-500">{d.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                        {mimeLabel(d.mime_type)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                      {fmtBytes(d.size_bytes)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-500">
                      {fmtDate(d.uploaded_at)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <DocumentRowActions documentId={d.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
