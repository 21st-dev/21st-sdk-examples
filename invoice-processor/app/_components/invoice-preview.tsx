import type { Invoice } from "@/lib/sample-data"

export function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: invoice.currency,
  }).format(invoice.amount)

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">Invoice</p>
          <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{invoice.id}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{invoice.vendor}</p>
          <p className="text-xs text-neutral-500">{invoice.vendorAddress}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Invoice date</p>
          <p className="font-mono text-neutral-800 dark:text-neutral-200">{invoice.invoiceDate}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Due</p>
          <p className="font-mono text-neutral-800 dark:text-neutral-200">{invoice.dueDate}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">PO #</p>
          <p className="font-mono text-neutral-800 dark:text-neutral-200">
            {invoice.poNumber ?? <span className="text-neutral-400">—</span>}
          </p>
        </div>
      </div>

      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="py-1.5 text-left font-medium text-neutral-500">Description</th>
            <th className="py-1.5 text-right font-medium text-neutral-500">Qty</th>
            <th className="py-1.5 text-right font-medium text-neutral-500">Unit</th>
            <th className="py-1.5 text-right font-medium text-neutral-500">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((li, i) => (
            <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="py-1.5 text-neutral-800 dark:text-neutral-200">{li.description}</td>
              <td className="py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">{li.qty}</td>
              <td className="py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                {li.unitPrice.toFixed(2)}
              </td>
              <td className="py-1.5 text-right font-mono text-neutral-900 dark:text-neutral-100">
                {li.total.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Total</span>
        <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{formattedAmount}</span>
      </div>
    </div>
  )
}
