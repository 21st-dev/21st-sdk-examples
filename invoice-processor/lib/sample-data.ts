export type LineItem = {
  description: string
  qty: number
  unitPrice: number
  total: number
}

export type Invoice = {
  id: string
  vendor: string
  vendorAddress: string
  invoiceDate: string
  dueDate: string
  amount: number
  currency: string
  poNumber: string | null
  lineItems: LineItem[]
  vatAmount: number
  vatRate: number
  rawText: string
}

export type PoRecord = {
  poNumber: string
  vendor: string
  amount: number
  currency: string
  status: "open" | "closed"
}

export const PO_DB: PoRecord[] = [
  { poNumber: "PO-1234", vendor: "Northwind Supplies", amount: 2850, currency: "USD", status: "open" },
  { poNumber: "PO-5678", vendor: "Acme Logistics", amount: 12000, currency: "USD", status: "open" },
  { poNumber: "PO-9999", vendor: "Globex Hosting", amount: 4800, currency: "USD", status: "open" },
]

export const SAMPLE_INVOICES: Invoice[] = [
  {
    id: "INV-001",
    vendor: "Northwind Supplies",
    vendorAddress: "221 Elm St, Portland OR 97201",
    invoiceDate: "2025-04-03",
    dueDate: "2025-05-03",
    amount: 2850,
    currency: "USD",
    poNumber: "PO-1234",
    vatAmount: 0,
    vatRate: 0,
    lineItems: [
      { description: "Standing desk (electric)", qty: 3, unitPrice: 850, total: 2550 },
      { description: "Monitor arm", qty: 6, unitPrice: 50, total: 300 },
    ],
    rawText: `INVOICE INV-001
Northwind Supplies · 221 Elm St, Portland OR 97201
Date: 2025-04-03  Due: 2025-05-03  PO: PO-1234
3 x Standing desk (electric) @ 850.00 = 2550.00
6 x Monitor arm @ 50.00 = 300.00
TOTAL: USD 2850.00`,
  },
  {
    id: "INV-002",
    vendor: "Acme Logistics",
    vendorAddress: "88 Harbor Way, Long Beach CA 90802",
    invoiceDate: "2025-04-07",
    dueDate: "2025-05-07",
    amount: 12550,
    currency: "USD",
    poNumber: "PO-5678",
    vatAmount: 0,
    vatRate: 0,
    lineItems: [
      { description: "Freight (container)", qty: 1, unitPrice: 12000, total: 12000 },
      { description: "Fuel surcharge", qty: 1, unitPrice: 550, total: 550 },
    ],
    rawText: `INVOICE INV-002
Acme Logistics · 88 Harbor Way, Long Beach CA 90802
Date: 2025-04-07  Due: 2025-05-07  PO: PO-5678
1 x Freight (container) = 12000.00
1 x Fuel surcharge = 550.00
TOTAL: USD 12550.00
(Note: fuel surcharge was not pre-approved in the PO)`,
  },
  {
    id: "INV-003",
    vendor: "Globex Hosting",
    vendorAddress: "500 Market St, San Francisco CA 94105",
    invoiceDate: "2025-04-01",
    dueDate: "2025-04-30",
    amount: 4800,
    currency: "USD",
    poNumber: null,
    vatAmount: 0,
    vatRate: 0,
    lineItems: [
      { description: "Managed Postgres — April", qty: 1, unitPrice: 4000, total: 4000 },
      { description: "Egress bandwidth overage", qty: 1, unitPrice: 800, total: 800 },
    ],
    rawText: `INVOICE INV-003
Globex Hosting · 500 Market St, San Francisco CA 94105
Date: 2025-04-01  Due: 2025-04-30  PO: (none)
Managed Postgres — April = 4000.00
Egress bandwidth overage = 800.00
TOTAL: USD 4800.00`,
  },
]

export function getInvoice(id: string): Invoice | undefined {
  return SAMPLE_INVOICES.find((i) => i.id === id)
}
