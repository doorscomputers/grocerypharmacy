/**
 * Receipt PDF Generation and Sharing Service
 * Generates a PDF receipt from ReceiptData and opens the device share dialog
 * (email, messaging apps, etc.)
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system/legacy';
import { ReceiptData } from '../components/ReceiptPreview';

/**
 * Format a number as Philippine Peso currency
 */
function formatPeso(amount: number): string {
  const safe = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return `₱${safe.toFixed(2)}`;
}

/**
 * Format date for Philippine locale
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Format time for Philippine locale
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Build HTML string for the receipt PDF
 */
function buildReceiptHtml(data: ReceiptData): string {
  // Build items rows
  const itemsHtml = (data.items || []).map(item => `
    <tr>
      <td style="text-align:left; padding:4px 8px;">${item.name || 'Item'}</td>
      <td style="text-align:center; padding:4px 8px;">${item.quantity || 0}</td>
      <td style="text-align:right; padding:4px 8px;">${formatPeso(item.unitPrice)}</td>
      <td style="text-align:right; padding:4px 8px;">${formatPeso(item.totalPrice)}</td>
    </tr>
  `).join('');

  // VAT breakdown or legacy totals
  let vatHtml = '';
  if (data.vatableSales !== undefined || data.vatExemptSales !== undefined || data.zeroRatedSales !== undefined) {
    vatHtml = `
      <tr><td>VATable Sales:</td><td style="text-align:right;">${formatPeso(data.vatableSales || 0)}</td></tr>
      <tr><td>VAT-Exempt Sales:</td><td style="text-align:right;">${formatPeso(data.vatExemptSales || 0)}</td></tr>
      <tr><td>Zero-Rated Sales:</td><td style="text-align:right;">${formatPeso(data.zeroRatedSales || 0)}</td></tr>
      <tr><td>VAT Amount (12%):</td><td style="text-align:right;">${formatPeso(data.vatAmount || 0)}</td></tr>
    `;
  } else {
    vatHtml = `
      <tr><td>Subtotal:</td><td style="text-align:right;">${formatPeso(data.subtotal)}</td></tr>
      <tr><td>VAT (12%):</td><td style="text-align:right;">${formatPeso(data.taxAmount)}</td></tr>
    `;
  }

  // Discount row
  const discountHtml = (data.discountAmount && data.discountAmount > 0)
    ? `<tr><td>${data.discountLabel || 'Discount'}:</td><td style="text-align:right;">-${formatPeso(data.discountAmount)}</td></tr>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          color: #000;
          margin: 0;
          padding: 20px;
          max-width: 320px;
          margin: 0 auto;
        }
        .header { text-align: center; margin-bottom: 8px; }
        .business-name { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
        .header-text { font-size: 11px; color: #333; }
        .separator { text-align: center; color: #666; margin: 6px 0; letter-spacing: 2px; }
        .invoice-title { text-align: center; font-weight: bold; font-size: 14px; margin: 8px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 2px 0; }
        .detail-label { }
        .detail-value { text-align: right; }
        .items-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
        .items-table th {
          font-weight: bold;
          padding: 4px 8px;
          border-bottom: 1px dashed #999;
          font-size: 11px;
        }
        .items-table td { font-size: 11px; }
        .totals-table { width: 100%; margin: 4px 0; }
        .totals-table td { padding: 2px 0; font-size: 12px; }
        .grand-total {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          font-size: 16px;
          margin: 8px 0;
        }
        .payment-section { margin: 4px 0; }
        .footer { text-align: center; margin-top: 12px; font-size: 11px; }
        .official { font-weight: bold; font-size: 10px; margin-top: 8px; }
        .double-sep { border-top: 2px double #000; margin: 6px 0; }
        .single-sep { border-top: 1px dashed #999; margin: 6px 0; }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div class="business-name">${data.businessName || 'Store'}</div>
        ${data.businessAddress ? `<div class="header-text">${data.businessAddress}</div>` : ''}
        ${data.businessPhone ? `<div class="header-text">Tel: ${data.businessPhone}</div>` : ''}
        ${data.tin ? `<div class="header-text">TIN: ${data.tin}</div>` : ''}
        ${data.permitNumber ? `<div class="header-text">Permit No: ${data.permitNumber}</div>` : ''}
      </div>

      <div class="double-sep"></div>

      <div class="invoice-title">SALES INVOICE</div>

      <div class="single-sep"></div>

      <!-- Transaction Details -->
      <div class="detail-row"><span>Invoice #:</span><span>${data.invoiceNumber || ''}</span></div>
      <div class="detail-row"><span>Date:</span><span>${formatDate(data.transactionDate)}</span></div>
      <div class="detail-row"><span>Time:</span><span>${formatTime(data.transactionDate)}</span></div>
      <div class="detail-row"><span>Cashier:</span><span>${data.cashierName || ''}</span></div>
      ${data.customerName ? `<div class="detail-row"><span>Customer:</span><span>${data.customerName}</span></div>` : ''}

      <div class="single-sep"></div>

      <!-- Items -->
      <table class="items-table">
        <thead>
          <tr>
            <th style="text-align:left;">Item</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Price</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="single-sep"></div>

      <!-- VAT / Totals -->
      <table class="totals-table">
        ${vatHtml}
        ${discountHtml}
      </table>

      <div class="double-sep"></div>

      <!-- Grand Total -->
      <div class="grand-total">
        <span>TOTAL:</span>
        <span>${formatPeso(data.total)}</span>
      </div>

      <div class="single-sep"></div>

      <!-- Payment -->
      <div class="payment-section">
        <div class="detail-row"><span>Payment:</span><span>${data.paymentMethod || 'CASH'}</span></div>
        <div class="detail-row"><span>Tendered:</span><span>${formatPeso(data.amountTendered || 0)}</span></div>
        <div class="detail-row"><span>Change:</span><span>${formatPeso(data.changeAmount || 0)}</span></div>
      </div>

      <div class="single-sep"></div>

      <!-- Footer -->
      <div class="footer">
        <div>Thank you for your purchase!</div>
        <div>Please come again</div>
        ${data.footerText ? `<div>${data.footerText}</div>` : ''}
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate a PDF receipt and open the device share dialog
 * (allows user to email, share via messaging apps, save to files, etc.)
 */
// === Purchase Order PDF ===

export interface PurchaseOrderPdfData {
  purchaseNumber: string;
  supplierName: string;
  purchaseDate: string;
  referenceNumber?: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  notes?: string;
  status: string;
  items: {
    productName: string;
    productCode: string;
    quantityOrdered: number;
    quantityReceived?: number;
    unitCost: number;
    totalAmount: number;
  }[];
  totalAmount: number;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  tin?: string;
}

function buildPurchaseOrderHtml(data: PurchaseOrderPdfData): string {
  const itemsHtml = data.items.map((item, i) => `
    <tr>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${i + 1}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">
        <strong>${item.productName}</strong><br/>
        <span style="font-size:10px; color:#888;">${item.productCode}</span>
      </td>
      <td style="text-align:center; padding:6px 8px; border-bottom:1px solid #eee;">${item.quantityOrdered}</td>
      ${item.quantityReceived !== undefined ? `<td style="text-align:center; padding:6px 8px; border-bottom:1px solid #eee;">${item.quantityReceived}</td>` : ''}
      <td style="text-align:right; padding:6px 8px; border-bottom:1px solid #eee;">${formatPesoCurrency(item.unitCost)}</td>
      <td style="text-align:right; padding:6px 8px; border-bottom:1px solid #eee;">${formatPesoCurrency(item.totalAmount)}</td>
    </tr>
  `).join('');

  const hasReceived = data.items.some(i => i.quantityReceived !== undefined);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 24px; }
        .header { text-align: center; margin-bottom: 16px; }
        .business-name { font-size: 20px; font-weight: bold; color: #1976D2; }
        .header-text { font-size: 11px; color: #666; }
        .po-title { text-align: center; font-size: 18px; font-weight: bold; margin: 16px 0 8px 0; color: #212121; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 12px; color: white; font-weight: bold; font-size: 11px; }
        .detail-table { width: 100%; margin: 8px 0; }
        .detail-table td { padding: 3px 0; font-size: 12px; }
        .detail-label { font-weight: bold; width: 140px; color: #555; }
        .items-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .items-table th { background: #1976D2; color: white; padding: 8px; font-size: 11px; text-align: left; }
        .items-table th:first-child { border-radius: 4px 0 0 0; }
        .items-table th:last-child { border-radius: 0 4px 0 0; }
        .total-row { text-align: right; font-size: 16px; font-weight: bold; margin: 12px 0; }
        .notes { background: #f5f5f5; padding: 10px; border-radius: 6px; margin: 12px 0; font-size: 11px; }
        .footer { text-align: center; margin-top: 24px; font-size: 10px; color: #999; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="business-name">${data.businessName || 'Business'}</div>
        ${data.businessAddress ? `<div class="header-text">${data.businessAddress}</div>` : ''}
        ${data.businessPhone ? `<div class="header-text">Tel: ${data.businessPhone}</div>` : ''}
        ${data.tin ? `<div class="header-text">TIN: ${data.tin}</div>` : ''}
      </div>

      <div class="po-title">PURCHASE ORDER</div>

      <table class="detail-table">
        <tr><td class="detail-label">PO Number:</td><td>${data.purchaseNumber}</td></tr>
        <tr><td class="detail-label">Supplier:</td><td><strong>${data.supplierName}</strong></td></tr>
        <tr><td class="detail-label">Date:</td><td>${data.purchaseDate}</td></tr>
        <tr><td class="detail-label">Status:</td><td><span class="status" style="background:${data.status === 'RECEIVED' ? '#4CAF50' : data.status === 'DRAFT' ? '#9E9E9E' : '#2196F3'}">${data.status}</span></td></tr>
        ${data.referenceNumber ? `<tr><td class="detail-label">Reference #:</td><td>${data.referenceNumber}</td></tr>` : ''}
        ${data.expectedDeliveryDate ? `<tr><td class="detail-label">Expected Delivery:</td><td>${data.expectedDeliveryDate}</td></tr>` : ''}
        ${data.paymentTerms ? `<tr><td class="detail-label">Payment Terms:</td><td>${data.paymentTerms}</td></tr>` : ''}
      </table>

      <table class="items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th style="text-align:center;">Qty Ordered</th>
            ${hasReceived ? '<th style="text-align:center;">Qty Received</th>' : ''}
            <th style="text-align:right;">Unit Cost</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="total-row">TOTAL: ${formatPesoCurrency(data.totalAmount)}</div>

      ${data.notes ? `<div class="notes"><strong>Notes:</strong> ${data.notes}</div>` : ''}

      <div class="footer">
        Generated on ${new Date().toLocaleString('en-PH')} | ${data.businessName || ''}
      </div>
    </body>
    </html>
  `;
}

export async function generatePurchaseOrderPdf(data: PurchaseOrderPdfData): Promise<void> {
  const html = buildPurchaseOrderHtml(data);

  const { uri } = await Print.printToFileAsync({
    html,
    width: 595, // A4 width in points
    height: 842, // A4 height in points
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Purchase Order ${data.purchaseNumber}`,
    UTI: 'com.adobe.pdf',
  });
}

export async function generateReceiptPdf(data: ReceiptData): Promise<void> {
  const html = buildReceiptHtml(data);

  // Generate PDF file using expo-print
  const { uri } = await Print.printToFileAsync({
    html,
    width: 380,
    height: 680,
  });

  // Check if sharing is available on this device
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  // Open the native share dialog (email, messaging, save to files, etc.)
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Receipt ${data.invoiceNumber || ''}`,
    UTI: 'com.adobe.pdf',
  });
}

// === X-Reading PDF ===

export interface XReadingPdfData {
  businessName: string;
  businessAddress?: string;
  tin?: string;
  date: string;
  time: string;
  cashierName?: string;
  // Sales Summary
  transaction_count: number;
  gross_sales: number;
  discount_amount: number;
  refund_amount: number;
  refund_count?: number;
  net_sales: number;
  // VAT Breakdown
  vat_sales: number;
  vat_amount: number;
  vat_exempt_sales: number;
  zero_rated_sales: number;
  // Payment Methods
  cash_sales: number;
  card_sales: number;
  check_sales: number;
  online_sales: number;
  credit_sales: number;
  // Voids
  void_count: number;
  void_amount: number;
  // Exchanges
  exchange_count?: number;
  exchange_amount?: number;
  // Cash Drawer
  beginning_cash: number;
  opening_fund: number;
  cash_in: number;
  cash_out: number;
  cash_fund: number;  // For backward compatibility (opening_fund + cash_in)
  petty_cash: number;
  cash_refunds: number;
  // AR Collections (Customer Payments)
  customer_payments_cash?: number;
  customer_payments_check?: number;
  customer_payments_card?: number;
  customer_payments_online?: number;
  customer_payments_bank_transfer?: number;
  customer_payments_total?: number;
  expected_cash: number;
}

function buildXReadingHtml(data: XReadingPdfData, paperWidth: '58mm' | '80mm' = '58mm'): string {
  const pageWidth = paperWidth === '58mm' ? 220 : 300;
  const fontSize = paperWidth === '58mm' ? 10 : 12;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: ${fontSize}px;
          color: #000;
          margin: 0;
          padding: 16px;
          max-width: ${pageWidth}px;
          margin: 0 auto;
        }
        .header { text-align: center; margin-bottom: 12px; }
        .business-name { font-size: ${fontSize + 4}px; font-weight: bold; margin-bottom: 4px; }
        .header-text { font-size: ${fontSize - 1}px; color: #333; }
        .report-title {
          text-align: center;
          font-weight: bold;
          font-size: ${fontSize + 2}px;
          margin: 12px 0;
          padding: 8px;
          background: #6200EE;
          color: white;
          border-radius: 4px;
        }
        .date-box {
          text-align: center;
          background: #F3E5F5;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 12px;
        }
        .date-text { font-weight: bold; color: #6200EE; }
        .time-text { font-size: ${fontSize - 1}px; color: #7C4DFF; }
        .section {
          margin-bottom: 12px;
          background: #FAFAFA;
          padding: 10px;
          border-radius: 6px;
        }
        .section-highlight {
          margin-bottom: 12px;
          background: #E8F5E9;
          padding: 10px;
          border-radius: 6px;
          border: 1px solid #C8E6C9;
        }
        .section-title {
          font-size: ${fontSize - 1}px;
          font-weight: bold;
          color: #757575;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }
        .row { display: flex; justify-content: space-between; padding: 3px 0; }
        .row-label { color: #616161; }
        .row-value { font-weight: 500; }
        .row-value-red { font-weight: 500; color: #D32F2F; }
        .row-value-green { font-weight: bold; color: #2E7D32; }
        .row-total {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          margin-top: 6px;
          border-top: 1px solid #E0E0E0;
          font-weight: bold;
        }
        .separator { border-top: 1px dashed #999; margin: 8px 0; }
        .double-sep { border-top: 2px double #000; margin: 8px 0; }
        .footer-note {
          text-align: center;
          font-size: ${fontSize - 2}px;
          color: #1565C0;
          background: #E3F2FD;
          padding: 8px;
          border-radius: 4px;
          margin-top: 12px;
        }
        .timestamp {
          text-align: center;
          font-size: ${fontSize - 2}px;
          color: #999;
          margin-top: 12px;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div class="business-name">${data.businessName || 'Store'}</div>
        ${data.businessAddress ? `<div class="header-text">${data.businessAddress}</div>` : ''}
        ${data.tin ? `<div class="header-text">TIN: ${data.tin}</div>` : ''}
      </div>

      <div class="report-title">X-READING</div>
      <div style="text-align: center; font-size: ${fontSize - 1}px; color: #666; margin-bottom: 12px;">Mid-Day Inquiry Report</div>

      <!-- Date/Time -->
      <div class="date-box">
        <div class="date-text">${data.date}</div>
        <div class="time-text">As of ${data.time}</div>
        ${data.cashierName ? `<div class="time-text">Cashier: ${data.cashierName}</div>` : ''}
      </div>

      <!-- Sales Summary -->
      <div class="section">
        <div class="section-title">SALES SUMMARY</div>
        <div class="row"><span class="row-label">Transaction Count</span><span class="row-value">${data.transaction_count}</span></div>
        <div class="row"><span class="row-label">Gross Sales</span><span class="row-value">${formatPeso(data.gross_sales)}</span></div>
        <div class="row"><span class="row-label">Less: Discounts</span><span class="row-value-red">(${formatPeso(data.discount_amount)})</span></div>
        <div class="row"><span class="row-label">Less: Refunds</span><span class="row-value-red">(${formatPeso(data.refund_amount)})</span></div>
        <div class="row-total"><span>Net Sales</span><span>${formatPeso(data.net_sales)}</span></div>
      </div>

      <!-- VAT Breakdown -->
      <div class="section">
        <div class="section-title">VAT BREAKDOWN</div>
        <div class="row"><span class="row-label">VATable Sales</span><span class="row-value">${formatPeso(data.vat_sales)}</span></div>
        <div class="row"><span class="row-label">VAT Amount (12%)</span><span class="row-value">${formatPeso(data.vat_amount)}</span></div>
        <div class="row"><span class="row-label">VAT Exempt Sales</span><span class="row-value">${formatPeso(data.vat_exempt_sales)}</span></div>
        <div class="row"><span class="row-label">Zero-Rated Sales</span><span class="row-value">${formatPeso(data.zero_rated_sales)}</span></div>
      </div>

      <!-- Payment Methods -->
      <div class="section">
        <div class="section-title">BY PAYMENT METHOD</div>
        <div class="row"><span class="row-label">Cash Sales</span><span class="row-value">${formatPeso(data.cash_sales)}</span></div>
        <div class="row"><span class="row-label">Card Sales</span><span class="row-value">${formatPeso(data.card_sales)}</span></div>
        <div class="row"><span class="row-label">Check Sales</span><span class="row-value">${formatPeso(data.check_sales)}</span></div>
        <div class="row"><span class="row-label">GCash/Maya Sales</span><span class="row-value">${formatPeso(data.online_sales)}</span></div>
        <div class="row"><span class="row-label">Credit/Charge Sales</span><span class="row-value">${formatPeso(data.credit_sales)}</span></div>
      </div>

      <!-- Voids / Exchanges / Refunds -->
      <div class="section">
        <div class="section-title">VOIDS / EXCHANGES / REFUNDS</div>
        <div class="row"><span class="row-label">Void Count</span><span class="row-value">${data.void_count}</span></div>
        <div class="row"><span class="row-label">Void Amount</span><span class="row-value-red">${formatPeso(data.void_amount)}</span></div>
        <div class="row"><span class="row-label">Exchange Count</span><span class="row-value">${data.exchange_count || 0}</span></div>
        <div class="row"><span class="row-label">Exchange Amount</span><span class="row-value-red">${formatPeso(data.exchange_amount || 0)}</span></div>
        <div class="row"><span class="row-label">Refund Count</span><span class="row-value">${data.refund_count || 0}</span></div>
        <div class="row"><span class="row-label">Refund Amount</span><span class="row-value-red">${formatPeso(data.refund_amount)}</span></div>
      </div>

      ${(data.customer_payments_total || 0) > 0 ? `
      <!-- AR Collections -->
      <div class="section">
        <div class="section-title">AR COLLECTIONS (CUSTOMER PAYMENTS)</div>
        <div class="row"><span class="row-label">Cash</span><span class="row-value">${formatPeso(data.customer_payments_cash || 0)}</span></div>
        <div class="row"><span class="row-label">Check</span><span class="row-value">${formatPeso(data.customer_payments_check || 0)}</span></div>
        <div class="row"><span class="row-label">Card</span><span class="row-value">${formatPeso(data.customer_payments_card || 0)}</span></div>
        <div class="row"><span class="row-label">GCash/Online</span><span class="row-value">${formatPeso(data.customer_payments_online || 0)}</span></div>
        <div class="row"><span class="row-label">Bank Transfer</span><span class="row-value">${formatPeso(data.customer_payments_bank_transfer || 0)}</span></div>
        <div class="row-total"><span>Total Collections</span><span class="row-value">${formatPeso(data.customer_payments_total || 0)}</span></div>
      </div>
      ` : ''}

      <!-- Cash Drawer -->
      <div class="section-highlight">
        <div class="section-title">CASH DRAWER</div>
        <div class="row"><span class="row-label">Beginning Cash</span><span class="row-value">${formatPeso(data.beginning_cash)}</span></div>
        <div class="row"><span class="row-label">Add: Opening Fund</span><span class="row-value">${formatPeso(data.opening_fund || 0)}</span></div>
        <div class="row"><span class="row-label">Add: Cash In</span><span class="row-value">${formatPeso(data.cash_in || 0)}</span></div>
        <div class="row"><span class="row-label">Add: Cash Sales</span><span class="row-value">${formatPeso(data.cash_sales)}</span></div>
        ${(data.customer_payments_cash || 0) > 0 ? `<div class="row"><span class="row-label">Add: AR Collections (Cash)</span><span class="row-value">${formatPeso(data.customer_payments_cash || 0)}</span></div>` : ''}
        <div class="row"><span class="row-label">Less: Cash Out</span><span class="row-value-red">(${formatPeso(data.cash_out || 0)})</span></div>
        <div class="row"><span class="row-label">Less: Petty Cash</span><span class="row-value-red">(${formatPeso(data.petty_cash)})</span></div>
        <div class="row"><span class="row-label">Less: Cash Refunds</span><span class="row-value-red">(${formatPeso(data.cash_refunds || 0)})</span></div>
        <div class="row-total"><span>Expected Cash</span><span class="row-value-green">${formatPeso(data.expected_cash)}</span></div>
      </div>

      <!-- Footer Note -->
      <div class="footer-note">
        X-Reading is a mid-day inquiry and does NOT reset any counters.<br/>
        Use Z-Reading for end-of-day closing.
      </div>

      <!-- Timestamp -->
      <div class="timestamp">
        Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate X-Reading PDF and open share dialog
 */
export async function generateXReadingPdf(
  data: XReadingPdfData,
  paperWidth: '58mm' | '80mm' = '58mm'
): Promise<string> {
  const html = buildXReadingHtml(data, paperWidth);

  const pageWidth = paperWidth === '58mm' ? 240 : 320;
  const pageHeight = paperWidth === '58mm' ? 600 : 700;

  const { uri } = await Print.printToFileAsync({
    html,
    width: pageWidth,
    height: pageHeight,
  });

  return uri;
}

/**
 * Print X-Reading using system print dialog (PDF fallback when no Bluetooth printer)
 */
export async function printXReadingPdf(
  data: XReadingPdfData,
  paperWidth: '58mm' | '80mm' = '58mm'
): Promise<void> {
  const html = buildXReadingHtml(data, paperWidth);
  await Print.printAsync({ html });
}

/**
 * Generate X-Reading PDF and open share dialog
 */
export async function shareXReadingPdf(
  data: XReadingPdfData,
  paperWidth: '58mm' | '80mm' = '58mm'
): Promise<void> {
  const uri = await generateXReadingPdf(data, paperWidth);

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `X-Reading ${data.date}`,
    UTI: 'com.adobe.pdf',
  });
}

/**
 * Generate X-Reading PDF and send via email
 */
export async function emailXReadingPdf(
  data: XReadingPdfData,
  paperWidth: '58mm' | '80mm' = '58mm',
  recipientEmail?: string
): Promise<void> {
  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Email is not available on this device.');
  }

  const uri = await generateXReadingPdf(data, paperWidth);

  // Copy to a proper location with .pdf extension for email attachment
  const fileName = `XReading_${data.date.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const newUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.copyAsync({ from: uri, to: newUri });

  await MailComposer.composeAsync({
    recipients: recipientEmail ? [recipientEmail] : [],
    subject: `X-Reading Report - ${data.date}`,
    body: `Please find attached the X-Reading report for ${data.date} as of ${data.time}.\n\nNet Sales: ${formatPeso(data.net_sales)}\nTransaction Count: ${data.transaction_count}\nExpected Cash: ${formatPeso(data.expected_cash)}\n\n---\nGenerated by IgoroTech POS`,
    attachments: [newUri],
  });
}

// =============================================
// Z-READING (END OF DAY) PDF GENERATION
// =============================================

export interface ZReadingPdfData {
  businessName: string;
  businessAddress?: string;
  tin?: string;
  date: string;
  zReadingNumber: string;
  cashierName?: string;
  // Sales Summary
  transaction_count: number;
  gross_sales: number;
  discount_amount: number;
  sales_returns: number;
  refund_count?: number;
  net_sales: number;
  // VAT Breakdown
  vat_sales: number;
  vat_amount: number;
  vat_exempt_sales: number;
  zero_rated_sales: number;
  // Payment Methods
  cash_sales: number;
  card_sales: number;
  check_sales: number;
  online_sales: number;
  credit_sales: number;
  // Voids
  void_count: number;
  void_amount: number;
  // Exchanges
  exchange_count?: number;
  exchange_amount?: number;
  // AR Collections (Customer Payments)
  customer_payments_cash?: number;
  customer_payments_check?: number;
  customer_payments_card?: number;
  customer_payments_online?: number;
  customer_payments_bank_transfer?: number;
  customer_payments_total?: number;
  // Supplier Payments
  supplier_payments_made?: number;
  // Cash Drawer
  beginning_cash: number;
  opening_fund: number;
  cash_in: number;
  cash_out: number;
  cash_fund: number;  // For backward compatibility (opening_fund + cash_in)
  petty_cash: number;
  cash_refunds: number;
  expected_cash: number;
  actual_cash: number;
  cash_variance: number;
}

function buildZReadingHtml(data: ZReadingPdfData, paperWidth: '58mm' | '80mm' = '58mm'): string {
  const pageWidth = paperWidth === '58mm' ? 220 : 300;
  const fontSize = paperWidth === '58mm' ? 10 : 12;

  const varianceClass = data.cash_variance === 0 ? 'balanced' : data.cash_variance < 0 ? 'short' : 'over';
  const varianceText = data.cash_variance === 0
    ? 'BALANCED'
    : data.cash_variance < 0
      ? `SHORT ${formatPeso(Math.abs(data.cash_variance))}`
      : `OVER ${formatPeso(data.cash_variance)}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: ${fontSize}px;
          color: #000;
          margin: 0;
          padding: 16px;
          max-width: ${pageWidth}px;
          margin: 0 auto;
        }
        .header { text-align: center; margin-bottom: 12px; }
        .business-name { font-size: ${fontSize + 4}px; font-weight: bold; margin-bottom: 4px; }
        .header-text { font-size: ${fontSize - 1}px; color: #333; }
        .report-title {
          text-align: center;
          font-weight: bold;
          font-size: ${fontSize + 2}px;
          margin: 12px 0;
          padding: 8px;
          background: #D32F2F;
          color: white;
          border-radius: 4px;
        }
        .date-box {
          text-align: center;
          background: #FFEBEE;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 12px;
        }
        .date-text { font-weight: bold; color: #C62828; }
        .z-number { font-size: ${fontSize + 2}px; font-weight: bold; color: #D32F2F; }
        .section {
          margin-bottom: 12px;
          background: #FAFAFA;
          padding: 10px;
          border-radius: 6px;
        }
        .section-highlight {
          margin-bottom: 12px;
          background: #E8F5E9;
          padding: 10px;
          border-radius: 6px;
          border: 1px solid #C8E6C9;
        }
        .section-cash {
          margin-bottom: 12px;
          background: #FFF3E0;
          padding: 10px;
          border-radius: 6px;
          border: 1px solid #FFE0B2;
        }
        .section-title {
          font-size: ${fontSize - 1}px;
          font-weight: bold;
          color: #757575;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }
        .row { display: flex; justify-content: space-between; padding: 3px 0; }
        .row-label { color: #616161; }
        .row-value { font-weight: 500; }
        .row-value-red { font-weight: 500; color: #D32F2F; }
        .row-value-green { font-weight: bold; color: #2E7D32; }
        .row-total {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          margin-top: 6px;
          border-top: 1px solid #E0E0E0;
          font-weight: bold;
        }
        .variance-box {
          text-align: center;
          padding: 12px;
          border-radius: 6px;
          margin-top: 12px;
          font-weight: bold;
          font-size: ${fontSize + 2}px;
        }
        .balanced { background: #C8E6C9; color: #2E7D32; }
        .short { background: #FFCDD2; color: #C62828; }
        .over { background: #FFE0B2; color: #E65100; }
        .footer-note {
          text-align: center;
          font-size: ${fontSize - 2}px;
          color: #C62828;
          background: #FFEBEE;
          padding: 8px;
          border-radius: 4px;
          margin-top: 12px;
          font-weight: bold;
        }
        .timestamp {
          text-align: center;
          font-size: ${fontSize - 2}px;
          color: #999;
          margin-top: 12px;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div class="business-name">${data.businessName || 'Store'}</div>
        ${data.businessAddress ? `<div class="header-text">${data.businessAddress}</div>` : ''}
        ${data.tin ? `<div class="header-text">TIN: ${data.tin}</div>` : ''}
      </div>

      <div class="report-title">Z-READING</div>
      <div style="text-align: center; font-size: ${fontSize - 1}px; color: #666; margin-bottom: 12px;">End of Day Report</div>

      <!-- Date/Z-Number -->
      <div class="date-box">
        <div class="z-number">Z-Reading #${data.zReadingNumber}</div>
        <div class="date-text">${data.date}</div>
        ${data.cashierName ? `<div style="font-size: ${fontSize - 1}px; color: #666;">Cashier: ${data.cashierName}</div>` : ''}
      </div>

      <!-- Sales Summary -->
      <div class="section">
        <div class="section-title">SALES SUMMARY</div>
        <div class="row"><span class="row-label">Transaction Count</span><span class="row-value">${data.transaction_count}</span></div>
        <div class="row"><span class="row-label">Gross Sales</span><span class="row-value">${formatPeso(data.gross_sales)}</span></div>
        <div class="row"><span class="row-label">Less: Discounts</span><span class="row-value-red">(${formatPeso(data.discount_amount)})</span></div>
        <div class="row"><span class="row-label">Less: Sales Returns</span><span class="row-value-red">(${formatPeso(data.sales_returns)})</span></div>
        <div class="row-total"><span>Net Sales</span><span>${formatPeso(data.net_sales)}</span></div>
      </div>

      <!-- VAT Breakdown -->
      <div class="section">
        <div class="section-title">VAT BREAKDOWN</div>
        <div class="row"><span class="row-label">VATable Sales</span><span class="row-value">${formatPeso(data.vat_sales)}</span></div>
        <div class="row"><span class="row-label">VAT Amount (12%)</span><span class="row-value">${formatPeso(data.vat_amount)}</span></div>
        <div class="row"><span class="row-label">VAT Exempt Sales</span><span class="row-value">${formatPeso(data.vat_exempt_sales)}</span></div>
        <div class="row"><span class="row-label">Zero-Rated Sales</span><span class="row-value">${formatPeso(data.zero_rated_sales)}</span></div>
      </div>

      <!-- Payment Methods -->
      <div class="section">
        <div class="section-title">BY PAYMENT METHOD</div>
        <div class="row"><span class="row-label">Cash Sales</span><span class="row-value">${formatPeso(data.cash_sales)}</span></div>
        <div class="row"><span class="row-label">Card Sales</span><span class="row-value">${formatPeso(data.card_sales)}</span></div>
        <div class="row"><span class="row-label">Check Sales</span><span class="row-value">${formatPeso(data.check_sales)}</span></div>
        <div class="row"><span class="row-label">GCash/Maya Sales</span><span class="row-value">${formatPeso(data.online_sales)}</span></div>
        <div class="row"><span class="row-label">Charge Invoice (AR)</span><span class="row-value">${formatPeso(data.credit_sales)}</span></div>
      </div>

      <!-- Voids / Exchanges / Refunds -->
      <div class="section">
        <div class="section-title">VOIDS / EXCHANGES / REFUNDS</div>
        <div class="row"><span class="row-label">Void Count</span><span class="row-value">${data.void_count}</span></div>
        <div class="row"><span class="row-label">Void Amount</span><span class="row-value-red">${formatPeso(data.void_amount)}</span></div>
        <div class="row"><span class="row-label">Exchange Count</span><span class="row-value">${data.exchange_count || 0}</span></div>
        <div class="row"><span class="row-label">Exchange Amount</span><span class="row-value-red">${formatPeso(data.exchange_amount || 0)}</span></div>
        <div class="row"><span class="row-label">Refund Count</span><span class="row-value">${data.refund_count || 0}</span></div>
        <div class="row"><span class="row-label">Refund Amount</span><span class="row-value-red">${formatPeso(data.sales_returns)}</span></div>
      </div>

      ${(data.customer_payments_total || 0) > 0 ? `
      <!-- AR Collections -->
      <div class="section">
        <div class="section-title">AR COLLECTIONS (CUSTOMER PAYMENTS)</div>
        <div class="row"><span class="row-label">Cash</span><span class="row-value">${formatPeso(data.customer_payments_cash || 0)}</span></div>
        <div class="row"><span class="row-label">Check</span><span class="row-value">${formatPeso(data.customer_payments_check || 0)}</span></div>
        <div class="row"><span class="row-label">Card</span><span class="row-value">${formatPeso(data.customer_payments_card || 0)}</span></div>
        <div class="row"><span class="row-label">GCash/Online</span><span class="row-value">${formatPeso(data.customer_payments_online || 0)}</span></div>
        <div class="row"><span class="row-label">Bank Transfer</span><span class="row-value">${formatPeso(data.customer_payments_bank_transfer || 0)}</span></div>
        <div class="row-total"><span>Total Collections</span><span class="row-value">${formatPeso(data.customer_payments_total || 0)}</span></div>
      </div>
      ` : ''}

      ${(data.supplier_payments_made || 0) > 0 ? `
      <!-- Supplier Payments -->
      <div class="section">
        <div class="section-title">SUPPLIER PAYMENTS</div>
        <div class="row-total"><span>Total Payments Made</span><span class="row-value-red">${formatPeso(data.supplier_payments_made || 0)}</span></div>
      </div>
      ` : ''}

      <!-- Cash Drawer Accountability -->
      <div class="section-cash">
        <div class="section-title">💵 CASH DRAWER ACCOUNTABILITY</div>
        <div class="row"><span class="row-label">Beginning Cash</span><span class="row-value">${formatPeso(data.beginning_cash)}</span></div>
        ${(data.opening_fund || 0) > 0 ? `<div class="row"><span class="row-label">Add: Opening Fund</span><span class="row-value">${formatPeso(data.opening_fund)}</span></div>` : ''}
        ${(data.cash_in || 0) > 0 ? `<div class="row"><span class="row-label">Add: Cash In</span><span class="row-value">${formatPeso(data.cash_in)}</span></div>` : ''}
        <div class="row"><span class="row-label">Add: Cash Sales</span><span class="row-value">${formatPeso(data.cash_sales)}</span></div>
        ${(data.customer_payments_cash || 0) > 0 ? `<div class="row"><span class="row-label">Add: AR Collections (Cash)</span><span class="row-value">${formatPeso(data.customer_payments_cash || 0)}</span></div>` : ''}
        ${data.cash_refunds > 0 ? `<div class="row"><span class="row-label">Less: Cash Refunds</span><span class="row-value-red">(${formatPeso(data.cash_refunds)})</span></div>` : ''}
        ${(data.cash_out || 0) > 0 ? `<div class="row"><span class="row-label">Less: Cash Out</span><span class="row-value-red">(${formatPeso(data.cash_out)})</span></div>` : ''}
        ${data.petty_cash > 0 ? `<div class="row"><span class="row-label">Less: Petty Cash</span><span class="row-value-red">(${formatPeso(data.petty_cash)})</span></div>` : ''}
        <div class="row-total"><span>Expected Cash</span><span>${formatPeso(data.expected_cash)}</span></div>
        <div class="row"><span class="row-label">Actual Cash (Counted)</span><span class="row-value">${formatPeso(data.actual_cash)}</span></div>
      </div>

      <!-- Variance -->
      <div class="variance-box ${varianceClass}">
        ${varianceText}
      </div>

      <!-- Footer Note -->
      <div class="footer-note">
        Z-Reading closes the day. This report is BIR-compliant.
      </div>

      <!-- Timestamp -->
      <div class="timestamp">
        Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate Z-Reading PDF
 */
export async function generateZReadingPdf(
  data: ZReadingPdfData,
  paperWidth: '58mm' | '80mm' = '58mm'
): Promise<string> {
  const html = buildZReadingHtml(data, paperWidth);

  const pageWidth = paperWidth === '58mm' ? 240 : 320;
  const pageHeight = paperWidth === '58mm' ? 800 : 900;

  const { uri } = await Print.printToFileAsync({
    html,
    width: pageWidth,
    height: pageHeight,
  });

  return uri;
}

/**
 * Print Z-Reading using system print dialog (PDF fallback when no Bluetooth printer)
 */
export async function printZReadingPdf(
  data: ZReadingPdfData,
  paperWidth: '58mm' | '80mm' = '58mm'
): Promise<void> {
  const html = buildZReadingHtml(data, paperWidth);
  await Print.printAsync({ html });
}

/**
 * Generate Z-Reading PDF and open share dialog
 */
export async function shareZReadingPdf(
  data: ZReadingPdfData,
  paperWidth: '58mm' | '80mm' = '58mm'
): Promise<void> {
  const uri = await generateZReadingPdf(data, paperWidth);

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Z-Reading ${data.date}`,
    UTI: 'com.adobe.pdf',
  });
}

/**
 * Generate Z-Reading PDF and send via email
 */
export async function emailZReadingPdf(
  data: ZReadingPdfData,
  paperWidth: '58mm' | '80mm' = '58mm',
  recipientEmail?: string
): Promise<void> {
  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Email is not available on this device.');
  }

  const uri = await generateZReadingPdf(data, paperWidth);

  // Copy to a proper location with .pdf extension for email attachment
  const fileName = `ZReading_${data.date.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const newUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.copyAsync({ from: uri, to: newUri });

  const varianceText = data.cash_variance === 0
    ? 'BALANCED'
    : data.cash_variance < 0
      ? `SHORT ${formatPeso(Math.abs(data.cash_variance))}`
      : `OVER ${formatPeso(data.cash_variance)}`;

  await MailComposer.composeAsync({
    recipients: recipientEmail ? [recipientEmail] : [],
    subject: `Z-Reading Report #${data.zReadingNumber} - ${data.date}`,
    body: `Please find attached the Z-Reading (End of Day) report for ${data.date}.\n\nZ-Reading #: ${data.zReadingNumber}\nNet Sales: ${formatPeso(data.net_sales)}\nTransaction Count: ${data.transaction_count}\nExpected Cash: ${formatPeso(data.expected_cash)}\nActual Cash: ${formatPeso(data.actual_cash)}\nVariance: ${varianceText}\n\n---\nGenerated by IgoroTech POS`,
    attachments: [newUri],
  });
}

// ========================================
// EJOURNAL PDF GENERATION (BIR Audit Trail)
// ========================================

export interface EJournalPdfData {
  companyName: string;
  companyAddress?: string;
  companyTin?: string;
  minNumber?: string;
  startDate: string;
  endDate: string;
  entries: Array<{
    id: number;
    transaction_id: number | null;
    entry_type: string;
    reference_number: string;
    description: string;
    amount: number | null;
    cashier_id: number;
    cashier_name: string;
    timestamp: string;
    created_at: string;
  }>;
  summary: {
    totalEntries: number;
    totalSales: number;
    totalVoids: number;
    totalRefunds: number;
    totalReturns: number;
    totalPayments: number;
    byType: Array<{ entry_type: string; count: number; total_amount: number }>;
  };
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  SALE: 'Sale',
  VOID: 'Void',
  REFUND: 'Refund',
  RETURN: 'Sales Return',
  PURCHASE_RETURN: 'Purchase Return',
  PAYMENT: 'Payment',
  Z_READING: 'Z-Reading',
  X_READING: 'X-Reading',
  SYSTEM: 'System',
};

const ENTRY_TYPE_COLORS: Record<string, string> = {
  SALE: '#4CAF50',
  VOID: '#F44336',
  REFUND: '#FF9800',
  RETURN: '#FF5722',
  PURCHASE_RETURN: '#E91E63',
  PAYMENT: '#2196F3',
  Z_READING: '#9C27B0',
  X_READING: '#673AB7',
  SYSTEM: '#607D8B',
};

export function buildEJournalHtml(data: EJournalPdfData, paperWidth: '58mm' | '80mm' = '80mm'): string {
  const maxWidth = paperWidth === '58mm' ? '280px' : '380px';
  const fontSize = paperWidth === '58mm' ? '10px' : '11px';
  const headerFontSize = paperWidth === '58mm' ? '14px' : '16px';

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-PH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Build summary by type rows
  const byTypeRows = data.summary.byType.map(item => `
    <tr>
      <td style="padding:4px 8px;">${ENTRY_TYPE_LABELS[item.entry_type] || item.entry_type}</td>
      <td style="padding:4px 8px; text-align:center;">${item.count}</td>
      <td style="padding:4px 8px; text-align:right;">${formatPeso(item.total_amount)}</td>
    </tr>
  `).join('');

  // Build entries rows
  const entriesRows = data.entries.map(entry => `
    <tr>
      <td style="padding:4px 8px; font-size:${fontSize}; vertical-align:top;">
        <div style="font-weight:600;">${formatDateTime(entry.timestamp)}</div>
        <div style="font-size:9px; color:#666;">${entry.cashier_name}</div>
      </td>
      <td style="padding:4px 8px; font-size:${fontSize}; vertical-align:top;">
        <span style="background-color:${ENTRY_TYPE_COLORS[entry.entry_type] || '#607D8B'}; color:#fff; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:600;">
          ${ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}
        </span>
      </td>
      <td style="padding:4px 8px; font-size:${fontSize}; vertical-align:top;">
        <div style="font-weight:600;">${entry.reference_number}</div>
        <div style="font-size:9px; color:#666; max-width:200px; word-wrap:break-word;">${entry.description}</div>
      </td>
      <td style="padding:4px 8px; font-size:${fontSize}; text-align:right; vertical-align:top; font-weight:600; color:${entry.amount && entry.amount >= 0 ? '#4CAF50' : '#F44336'};">
        ${entry.amount !== null ? (entry.amount >= 0 ? '' : '-') + formatPeso(entry.amount) : '-'}
      </td>
    </tr>
  `).join('');

  const generatedDate = new Date().toLocaleString('en-PH');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body {
          font-family: Arial, sans-serif;
          font-size: ${fontSize};
          color: #000;
          margin: 0;
          padding: 20px;
        }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 16px; }
        .company-name { font-size: ${headerFontSize}; font-weight: bold; margin-bottom: 4px; }
        .header-text { font-size: ${fontSize}; color: #333; margin: 2px 0; }
        .report-title { font-size: 18px; font-weight: bold; text-align: center; margin: 16px 0; color: #1976D2; }
        .report-subtitle { font-size: 12px; text-align: center; color: #666; margin-bottom: 16px; }
        .section { margin: 16px 0; }
        .section-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; color: #333; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        th { background-color: #f5f5f5; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
        td { padding: 6px 8px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) { background-color: #fafafa; }
        .summary-grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0; }
        .summary-item { flex: 1; min-width: 120px; background: #f5f5f5; border-radius: 8px; padding: 12px; text-align: center; }
        .summary-label { font-size: 11px; color: #666; margin-bottom: 4px; }
        .summary-value { font-size: 16px; font-weight: bold; }
        .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
        @media print {
          body { padding: 10px; }
          .page-break { page-break-before: always; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="company-name">${data.companyName || 'IgoroTech POS'}</div>
          ${data.companyAddress ? `<div class="header-text">${data.companyAddress}</div>` : ''}
          ${data.companyTin ? `<div class="header-text">TIN: ${data.companyTin}</div>` : ''}
          ${data.minNumber ? `<div class="header-text">MIN: ${data.minNumber}</div>` : ''}
        </div>

        <div class="report-title">eSALES JOURNAL</div>
        <div class="report-subtitle">Electronic Sales Journal</div>
        <div class="report-subtitle">Period: ${data.startDate} to ${data.endDate}</div>

        <div class="section">
          <div class="section-title">Summary</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Total Entries</div>
              <div class="summary-value">${data.summary.totalEntries}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Sales</div>
              <div class="summary-value" style="color:#4CAF50;">${formatPeso(data.summary.totalSales)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Voids</div>
              <div class="summary-value" style="color:#F44336;">${formatPeso(data.summary.totalVoids)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Returns</div>
              <div class="summary-value" style="color:#FF5722;">${formatPeso(data.summary.totalReturns)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Payments</div>
              <div class="summary-value" style="color:#2196F3;">${formatPeso(data.summary.totalPayments)}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Breakdown by Type</div>
          <table>
            <thead>
              <tr>
                <th>Entry Type</th>
                <th style="text-align:center;">Count</th>
                <th style="text-align:right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${byTypeRows}
            </tbody>
          </table>
        </div>

        <div class="section page-break">
          <div class="section-title">Transaction Details (${data.entries.length} entries)</div>
          <table>
            <thead>
              <tr>
                <th style="width:20%;">Date/Time</th>
                <th style="width:15%;">Type</th>
                <th style="width:45%;">Reference / Description</th>
                <th style="width:20%; text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${entriesRows}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>Generated: ${generatedDate}</p>
          <p>This is a computer-generated document for BIR audit compliance purposes.</p>
          <p>IgoroTech POS - Electronic Journal System</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate eJournal PDF and return the file URI
 */
export async function generateEJournalPdf(
  data: EJournalPdfData,
  paperWidth: '58mm' | '80mm' = '80mm'
): Promise<string> {
  const html = buildEJournalHtml(data, paperWidth);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });
  return uri;
}

/**
 * Generate and share eJournal PDF via device share dialog
 */
export async function shareEJournalPdf(
  data: EJournalPdfData,
  paperWidth: '58mm' | '80mm' = '80mm'
): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  const uri = await generateEJournalPdf(data, paperWidth);

  // Copy to a proper location with .pdf extension
  const fileName = `EJournal_${data.startDate}_to_${data.endDate}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const newUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.copyAsync({ from: uri, to: newUri });

  await Sharing.shareAsync(newUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share eSales Journal',
  });
}

/**
 * Generate and send eJournal PDF via email
 */
export async function emailEJournalPdf(
  data: EJournalPdfData,
  paperWidth: '58mm' | '80mm' = '80mm',
  recipientEmail?: string
): Promise<void> {
  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Email is not available on this device.');
  }

  const uri = await generateEJournalPdf(data, paperWidth);

  // Copy to a proper location with .pdf extension for email attachment
  const fileName = `EJournal_${data.startDate}_to_${data.endDate}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const newUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.copyAsync({ from: uri, to: newUri });

  await MailComposer.composeAsync({
    recipients: recipientEmail ? [recipientEmail] : [],
    subject: `eSales Journal - ${data.startDate} to ${data.endDate}`,
    body: `Please find attached the Electronic Journal (BIR Audit Trail) report.\n\nPeriod: ${data.startDate} to ${data.endDate}\nTotal Entries: ${data.summary.totalEntries}\nTotal Sales: ${formatPeso(data.summary.totalSales)}\nTotal Voids: ${formatPeso(data.summary.totalVoids)}\nTotal Returns: ${formatPeso(data.summary.totalReturns)}\nTotal Payments: ${formatPeso(data.summary.totalPayments)}\n\n---\nGenerated by IgoroTech POS\nBIR Compliance Electronic Journal`,
    attachments: [newUri],
  });
}

// ========================================
// GENERIC REPORT PDF UTILITIES
// ========================================

/**
 * Generic Report PDF Data interface for flexible report generation
 */
export interface GenericReportPdfData {
  companyName: string;
  companyAddress?: string;
  companyTin?: string;
  reportTitle: string;
  reportSubtitle?: string;
  dateRange?: { startDate: string; endDate: string };
  generatedAt?: string;
  sections: Array<{
    title?: string;
    type: 'summary' | 'table' | 'list' | 'text';
    data: any;
  }>;
}

/**
 * Build generic report HTML for PDF generation
 */
export function buildGenericReportHtml(data: GenericReportPdfData): string {
  const generatedDate = data.generatedAt || new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

  const buildSummarySection = (section: { title?: string; data: Record<string, { label: string; value: string; color?: string }[]> }) => {
    const items = Object.values(section.data).flat();
    return `
      ${section.title ? `<div class="section-title">${section.title}</div>` : ''}
      <div class="summary-grid">
        ${items.map(item => `
          <div class="summary-item">
            <div class="summary-label">${item.label}</div>
            <div class="summary-value" style="${item.color ? `color: ${item.color};` : ''}">${item.value}</div>
          </div>
        `).join('')}
      </div>
    `;
  };

  const buildTableSection = (section: { title?: string; data: { headers: string[]; rows: string[][]; footerRow?: string[] } }) => {
    return `
      ${section.title ? `<div class="section-title">${section.title}</div>` : ''}
      <table>
        <thead>
          <tr>
            ${section.data.headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${section.data.rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell}</td>`).join('')}
            </tr>
          `).join('')}
          ${section.data.footerRow ? `
            <tr class="footer-row">
              ${section.data.footerRow.map(cell => `<td><strong>${cell}</strong></td>`).join('')}
            </tr>
          ` : ''}
        </tbody>
      </table>
    `;
  };

  const buildListSection = (section: { title?: string; data: Array<{ label: string; value: string; color?: string }> }) => {
    return `
      ${section.title ? `<div class="section-title">${section.title}</div>` : ''}
      <div class="list-section">
        ${section.data.map(item => `
          <div class="list-row">
            <span class="list-label">${item.label}</span>
            <span class="list-value" style="${item.color ? `color: ${item.color};` : ''}">${item.value}</span>
          </div>
        `).join('')}
      </div>
    `;
  };

  const buildTextSection = (section: { title?: string; data: string }) => {
    return `
      ${section.title ? `<div class="section-title">${section.title}</div>` : ''}
      <div class="text-section">${section.data}</div>
    `;
  };

  const sectionsHtml = data.sections.map(section => {
    switch (section.type) {
      case 'summary':
        return buildSummarySection(section as any);
      case 'table':
        return buildTableSection(section as any);
      case 'list':
        return buildListSection(section as any);
      case 'text':
        return buildTextSection(section as any);
      default:
        return '';
    }
  }).join('<div class="section-divider"></div>');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          color: #333;
          margin: 0;
          padding: 20px;
        }
        .container { max-width: 800px; margin: 0 auto; }
        .header {
          text-align: center;
          margin-bottom: 16px;
          border-bottom: 2px solid #333;
          padding-bottom: 16px;
        }
        .company-name { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
        .header-text { font-size: 11px; color: #666; margin: 2px 0; }
        .report-title {
          font-size: 20px;
          font-weight: bold;
          text-align: center;
          margin: 16px 0;
          color: #1976D2;
        }
        .report-subtitle {
          font-size: 13px;
          text-align: center;
          color: #666;
          margin-bottom: 8px;
        }
        .date-range {
          text-align: center;
          font-size: 12px;
          color: #666;
          margin-bottom: 16px;
          background: #f5f5f5;
          padding: 8px;
          border-radius: 4px;
        }
        .section-title {
          font-size: 14px;
          font-weight: bold;
          border-bottom: 1px solid #ddd;
          padding-bottom: 4px;
          margin-bottom: 12px;
          margin-top: 16px;
          color: #333;
        }
        .section-divider {
          height: 1px;
          background: #eee;
          margin: 16px 0;
        }
        .summary-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin: 12px 0;
        }
        .summary-item {
          flex: 1;
          min-width: 120px;
          background: #f5f5f5;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
        }
        .summary-label { font-size: 11px; color: #666; margin-bottom: 4px; }
        .summary-value { font-size: 16px; font-weight: bold; color: #333; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        th {
          background-color: #f5f5f5;
          padding: 8px;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #ddd;
          font-size: 11px;
        }
        td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
        tr:nth-child(even) { background-color: #fafafa; }
        .footer-row { background-color: #e8f5e9 !important; }
        .footer-row td { font-weight: bold; }
        .list-section { margin: 8px 0; }
        .list-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid #eee;
        }
        .list-label { color: #666; }
        .list-value { font-weight: 600; }
        .text-section {
          background: #f5f5f5;
          padding: 12px;
          border-radius: 6px;
          margin: 8px 0;
        }
        .footer {
          margin-top: 24px;
          text-align: center;
          font-size: 10px;
          color: #999;
          border-top: 1px solid #ddd;
          padding-top: 12px;
        }
        @media print {
          body { padding: 10px; }
          .page-break { page-break-before: always; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="company-name">${data.companyName || 'IgoroTech POS'}</div>
          ${data.companyAddress ? `<div class="header-text">${data.companyAddress}</div>` : ''}
          ${data.companyTin ? `<div class="header-text">TIN: ${data.companyTin}</div>` : ''}
        </div>

        <div class="report-title">${data.reportTitle}</div>
        ${data.reportSubtitle ? `<div class="report-subtitle">${data.reportSubtitle}</div>` : ''}
        ${data.dateRange ? `
          <div class="date-range">
            Period: ${data.dateRange.startDate} to ${data.dateRange.endDate}
          </div>
        ` : ''}

        ${sectionsHtml}

        <div class="footer">
          <p>Generated: ${generatedDate}</p>
          <p>IgoroTech POS - Report System</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Format number as Philippine Peso (exported for use in report screens)
 */
export function formatPesoCurrency(amount: number): string {
  const safe = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return `₱${safe.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Build HTML for Supplier Payments report
 */
export function buildSupplierPaymentsHtml(
  payments: any[],
  startDate: Date,
  endDate: Date
): string {
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const paymentsHtml = payments.map(payment => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${payment.payment_number}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date(payment.payment_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${payment.supplier_name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${payment.payment_method}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${payment.purchase_number || '-'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">₱${payment.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          max-width: 1000px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #2196F3;
          padding-bottom: 20px;
        }
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #2196F3;
          margin-bottom: 10px;
        }
        .report-title {
          font-size: 20px;
          font-weight: bold;
          margin: 20px 0 10px 0;
        }
        .date-range {
          font-size: 14px;
          color: #666;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th {
          background-color: #2196F3;
          color: white;
          padding: 12px 8px;
          text-align: left;
          font-weight: bold;
        }
        .summary-box {
          background-color: #E3F2FD;
          padding: 15px;
          border-radius: 8px;
          margin-top: 20px;
          border-left: 4px solid #2196F3;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
          font-size: 16px;
        }
        .summary-label {
          font-weight: bold;
        }
        .summary-value {
          color: #2196F3;
          font-weight: bold;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 11px;
          color: #999;
          border-top: 1px solid #ddd;
          padding-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">IgoroTech POS</div>
        <div class="report-title">SUPPLIER PAYMENTS</div>
        <div class="date-range">
          ${startDate.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })} - ${endDate.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Payment #</th>
            <th>Date</th>
            <th>Supplier</th>
            <th style="text-align: center;">Method</th>
            <th>PO #</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${paymentsHtml}
        </tbody>
      </table>

      <div class="summary-box">
        <div class="summary-row">
          <span class="summary-label">Total Payments:</span>
          <span class="summary-value">₱${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Total Count:</span>
          <span class="summary-value">${payments.length} payments</span>
        </div>
      </div>

      <div class="footer">
        <p>Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
        <p>IgoroTech POS - Supplier Payments Report</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Build HTML for Unpaid Payables report
 */
export function buildUnpaidPayablesHtml(
  payables: any[],
  unpaidOnly: boolean
): string {
  const totalOutstanding = payables.reduce((sum, p) => sum + p.balance_amount, 0);
  const totalOriginal = payables.reduce((sum, p) => sum + p.original_amount, 0);
  const totalPaid = payables.reduce((sum, p) => sum + p.paid_amount, 0);

  const payablesHtml = payables.map(payable => {
    const statusColor =
      (payable.current_status || payable.status) === 'PAID' ? '#4CAF50' :
      (payable.current_status || payable.status) === 'OVERDUE' ? '#F44336' :
      (payable.current_status || payable.status) === 'PARTIALLY_PAID' ? '#FF9800' :
      '#2196F3';

    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${payable.purchase_number}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${payable.supplier_name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${new Date(payable.due_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₱${payable.original_amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₱${payable.paid_amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #F44336;">₱${payable.balance_amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
          <span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">
            ${payable.current_status || payable.status}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #F44336;
          padding-bottom: 20px;
        }
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #F44336;
          margin-bottom: 10px;
        }
        .report-title {
          font-size: 20px;
          font-weight: bold;
          margin: 20px 0 10px 0;
        }
        .date-info {
          font-size: 14px;
          color: #666;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th {
          background-color: #F44336;
          color: white;
          padding: 12px 8px;
          text-align: left;
          font-weight: bold;
          font-size: 13px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 20px;
        }
        .summary-card {
          background-color: #FFEBEE;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #F44336;
        }
        .summary-label {
          font-size: 12px;
          color: #666;
          margin-bottom: 5px;
        }
        .summary-value {
          font-size: 20px;
          font-weight: bold;
          color: #F44336;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 11px;
          color: #999;
          border-top: 1px solid #ddd;
          padding-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">IgoroTech POS</div>
        <div class="report-title">${unpaidOnly ? 'UNPAID SUPPLIER INVOICES' : 'SUPPLIER INVOICES'}</div>
        <div class="date-info">As of: ${new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>PO #</th>
            <th>Supplier</th>
            <th style="text-align: center;">Due Date</th>
            <th style="text-align: right;">Original</th>
            <th style="text-align: right;">Paid</th>
            <th style="text-align: right;">Balance</th>
            <th style="text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${payablesHtml}
        </tbody>
      </table>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">Total Original Amount</div>
          <div class="summary-value">₱${totalOriginal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Paid Amount</div>
          <div class="summary-value">₱${totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Outstanding Balance</div>
          <div class="summary-value">₱${totalOutstanding.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div style="margin-top: 20px; padding: 10px; background: #FFF3E0; border-radius: 8px; border-left: 4px solid #FF9800;">
        <div style="font-weight: bold; margin-bottom: 5px;">Summary</div>
        <div>Total Invoices: ${payables.length}</div>
        ${unpaidOnly ? `<div style="color: #F44336; font-weight: bold;">Showing only unpaid/partially paid invoices</div>` : ''}
      </div>

      <div class="footer">
        <p>Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
        <p>IgoroTech POS - ${unpaidOnly ? 'Unpaid ' : ''}Supplier Invoices Report</p>
      </div>
    </body>
    </html>
  `;
}
