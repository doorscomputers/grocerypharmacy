/**
 * ESC/POS Command Utilities for Thermal Printers
 *
 * Supports common 58mm (32 chars) and 80mm (48 chars) thermal printers.
 * These commands follow the ESC/POS standard used by most POS printers.
 */

// Printer width constants
export const PRINTER_WIDTH = {
  MM_58: 32,  // 58mm printer - 32 characters per line
  MM_80: 48,  // 80mm printer - 48 characters per line
};

// ESC/POS Command Constants
export const ESC = 0x1B;  // Escape
export const GS = 0x1D;   // Group Separator
export const LF = 0x0A;   // Line Feed
export const CR = 0x0D;   // Carriage Return
export const HT = 0x09;   // Horizontal Tab
export const FF = 0x0C;   // Form Feed

// Command builders
export const COMMANDS = {
  // Initialize printer
  INIT: [ESC, 0x40],

  // Text alignment
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],

  // Text style
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  UNDERLINE_ON: [ESC, 0x2D, 0x01],
  UNDERLINE_OFF: [ESC, 0x2D, 0x00],
  DOUBLE_HEIGHT_ON: [GS, 0x21, 0x11],
  DOUBLE_WIDTH_ON: [GS, 0x21, 0x10],
  DOUBLE_SIZE_ON: [GS, 0x21, 0x11],
  NORMAL_SIZE: [GS, 0x21, 0x00],

  // Font size (alternative method)
  FONT_A: [ESC, 0x4D, 0x00],  // Standard font
  FONT_B: [ESC, 0x4D, 0x01],  // Smaller font

  // Line spacing
  LINE_SPACING_DEFAULT: [ESC, 0x32],
  LINE_SPACING: (n: number) => [ESC, 0x33, n],  // n/180 inch

  // Paper feed and cut
  FEED_LINE: [LF],
  FEED_LINES: (n: number) => [ESC, 0x64, n],
  CUT_PAPER: [GS, 0x56, 0x00],      // Full cut
  CUT_PAPER_PARTIAL: [GS, 0x56, 0x01],  // Partial cut

  // Cash drawer
  OPEN_CASH_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xFA],

  // Barcode printing
  BARCODE_HEIGHT: (n: number) => [GS, 0x68, n],
  BARCODE_WIDTH: (n: number) => [GS, 0x77, n],
  BARCODE_TEXT_BELOW: [GS, 0x48, 0x02],
  BARCODE_TEXT_NONE: [GS, 0x48, 0x00],
};

// Barcode types
export const BARCODE_TYPE = {
  UPC_A: 0x00,
  UPC_E: 0x01,
  EAN13: 0x02,
  EAN8: 0x03,
  CODE39: 0x04,
  ITF: 0x05,
  CODABAR: 0x06,
  CODE93: 0x43,
  CODE128: 0x49,
};

/**
 * ESC/POS Printer Command Builder
 */
export class ESCPOSBuilder {
  private buffer: number[] = [];
  private printerWidth: number;

  constructor(printerWidth: number = PRINTER_WIDTH.MM_58) {
    this.printerWidth = printerWidth;
    this.initialize();
  }

  /**
   * Initialize the printer
   */
  initialize(): this {
    this.buffer.push(...COMMANDS.INIT);
    return this;
  }

  /**
   * Add raw bytes to buffer
   */
  raw(bytes: number[]): this {
    this.buffer.push(...bytes);
    return this;
  }

  /**
   * Add text to the buffer
   */
  text(content: string): this {
    const encoder = new TextEncoder();
    const bytes = Array.from(encoder.encode(content));
    this.buffer.push(...bytes);
    return this;
  }

  /**
   * Add text with a newline
   */
  println(content: string = ''): this {
    this.text(content);
    this.buffer.push(LF);
    return this;
  }

  /**
   * Set text alignment
   */
  align(alignment: 'left' | 'center' | 'right'): this {
    switch (alignment) {
      case 'left':
        this.buffer.push(...COMMANDS.ALIGN_LEFT);
        break;
      case 'center':
        this.buffer.push(...COMMANDS.ALIGN_CENTER);
        break;
      case 'right':
        this.buffer.push(...COMMANDS.ALIGN_RIGHT);
        break;
    }
    return this;
  }

  /**
   * Set bold text
   */
  bold(on: boolean = true): this {
    this.buffer.push(...(on ? COMMANDS.BOLD_ON : COMMANDS.BOLD_OFF));
    return this;
  }

  /**
   * Set underline
   */
  underline(on: boolean = true): this {
    this.buffer.push(...(on ? COMMANDS.UNDERLINE_ON : COMMANDS.UNDERLINE_OFF));
    return this;
  }

  /**
   * Set double height
   */
  doubleHeight(): this {
    this.buffer.push(...COMMANDS.DOUBLE_HEIGHT_ON);
    return this;
  }

  /**
   * Set double width
   */
  doubleWidth(): this {
    this.buffer.push(...COMMANDS.DOUBLE_WIDTH_ON);
    return this;
  }

  /**
   * Set double size (height and width)
   */
  doubleSize(): this {
    this.buffer.push(...COMMANDS.DOUBLE_SIZE_ON);
    return this;
  }

  /**
   * Reset to normal size
   */
  normalSize(): this {
    this.buffer.push(...COMMANDS.NORMAL_SIZE);
    return this;
  }

  /**
   * Feed specified number of lines
   */
  feed(lines: number = 1): this {
    if (lines === 1) {
      this.buffer.push(...COMMANDS.FEED_LINE);
    } else {
      this.buffer.push(...COMMANDS.FEED_LINES(lines));
    }
    return this;
  }

  /**
   * Print a separator line
   */
  separator(char: string = '-'): this {
    this.println(char.repeat(this.printerWidth));
    return this;
  }

  /**
   * Print a double separator line
   */
  doubleSeparator(): this {
    this.println('='.repeat(this.printerWidth));
    return this;
  }

  /**
   * Print a row with left and right aligned text
   */
  leftRight(left: string, right: string, fillChar: string = ' '): this {
    const maxLeftWidth = this.printerWidth - right.length - 1;
    const truncatedLeft = left.length > maxLeftWidth
      ? left.substring(0, maxLeftWidth)
      : left;
    const padding = this.printerWidth - truncatedLeft.length - right.length;
    this.println(truncatedLeft + fillChar.repeat(Math.max(1, padding)) + right);
    return this;
  }

  /**
   * Print a row with three columns
   */
  columns(col1: string, col2: string, col3: string): this {
    const col1Width = Math.floor(this.printerWidth * 0.4);
    const col2Width = Math.floor(this.printerWidth * 0.2);
    const col3Width = this.printerWidth - col1Width - col2Width;

    const paddedCol1 = col1.substring(0, col1Width).padEnd(col1Width);
    const paddedCol2 = col2.substring(0, col2Width).padStart(col2Width);
    const paddedCol3 = col3.substring(0, col3Width).padStart(col3Width);

    this.println(paddedCol1 + paddedCol2 + paddedCol3);
    return this;
  }

  /**
   * Print a table row for receipt items
   * Format: Item Name | Qty x Price | Total
   */
  itemRow(name: string, qty: number, price: number, total: number): this {
    // First line: Item name
    const truncatedName = name.length > this.printerWidth - 2
      ? name.substring(0, this.printerWidth - 2) + '..'
      : name;
    this.println(truncatedName);

    // Second line: Qty x Price = Total (right aligned)
    const qtyPriceStr = `  ${qty} x ${price.toFixed(2)}`;
    const totalStr = total.toFixed(2);
    this.leftRight(qtyPriceStr, totalStr);

    return this;
  }

  /**
   * Cut the paper
   */
  cut(partial: boolean = false): this {
    this.feed(3); // Feed before cut
    this.buffer.push(...(partial ? COMMANDS.CUT_PAPER_PARTIAL : COMMANDS.CUT_PAPER));
    return this;
  }

  /**
   * Open cash drawer
   */
  openCashDrawer(): this {
    this.buffer.push(...COMMANDS.OPEN_CASH_DRAWER);
    return this;
  }

  /**
   * Print barcode
   */
  barcode(data: string, type: number = BARCODE_TYPE.CODE128, height: number = 50, width: number = 2): this {
    // Set barcode height
    this.buffer.push(...COMMANDS.BARCODE_HEIGHT(height));
    // Set barcode width
    this.buffer.push(...COMMANDS.BARCODE_WIDTH(width));
    // Show text below barcode
    this.buffer.push(...COMMANDS.BARCODE_TEXT_BELOW);
    // Print barcode
    this.buffer.push(GS, 0x6B, type, data.length);
    this.text(data);
    this.feed();
    return this;
  }

  /**
   * Get the buffer as Uint8Array
   */
  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  /**
   * Get the buffer as base64 string (for BLE transmission)
   */
  toBase64(): string {
    const bytes = this.build();
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  /**
   * Get buffer length
   */
  get length(): number {
    return this.buffer.length;
  }

  /**
   * Clear the buffer
   */
  clear(): this {
    this.buffer = [];
    return this;
  }
}

/**
 * Receipt Template Builder
 * Creates formatted receipts for the POS system
 */
export interface ReceiptData {
  // Business info
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  tin?: string;
  permitNumber?: string;

  // Transaction info
  invoiceNumber: string;
  transactionDate: Date;
  cashierName: string;

  // Items
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;

  // Totals
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  discountLabel?: string;
  total: number;

  // BIR VAT Breakdown
  vatableSales?: number;
  vatExemptSales?: number;
  zeroRatedSales?: number;
  vatAmount?: number;

  // Payment
  paymentMethod: string;
  amountTendered: number;
  changeAmount: number;

  // Customer
  customerName?: string;

  // Footer
  footerText?: string;
}

/**
 * Build a complete receipt for printing
 */
export function buildReceipt(data: ReceiptData, printerWidth: number = PRINTER_WIDTH.MM_58): ESCPOSBuilder {
  const builder = new ESCPOSBuilder(printerWidth);

  // Header
  builder
    .align('center')
    .bold(true)
    .doubleSize()
    .println(data.businessName)
    .normalSize()
    .bold(false);

  if (data.businessAddress) {
    builder.println(data.businessAddress);
  }

  if (data.businessPhone) {
    builder.println(`Tel: ${data.businessPhone}`);
  }

  if (data.tin) {
    builder.println(`TIN: ${data.tin}`);
  }

  if (data.permitNumber) {
    builder.println(`Permit No: ${data.permitNumber}`);
  }

  builder
    .feed()
    .doubleSeparator()
    .align('left');

  // Transaction info
  builder
    .bold(true)
    .align('center')
    .println('SALES INVOICE')
    .bold(false)
    .align('left')
    .feed();

  const dateStr = data.transactionDate.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeStr = data.transactionDate.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  builder
    .leftRight('Invoice #:', data.invoiceNumber)
    .leftRight('Date:', dateStr)
    .leftRight('Time:', timeStr)
    .leftRight('Cashier:', data.cashierName);

  if (data.customerName) {
    builder.leftRight('Customer:', data.customerName);
  }

  builder.separator();

  // Items header
  builder
    .bold(true)
    .columns('Item', 'Qty', 'Amount')
    .bold(false)
    .separator('-');

  // Items
  for (const item of data.items) {
    builder.itemRow(item.name, item.quantity, item.unitPrice, item.totalPrice);
  }

  builder.separator();

  // BIR VAT Breakdown (if available) or legacy totals
  if (data.vatableSales !== undefined || data.vatExemptSales !== undefined || data.zeroRatedSales !== undefined) {
    // BIR-compliant VAT breakdown
    builder
      .leftRight('VATable Sales:', `P${(data.vatableSales || 0).toFixed(2)}`)
      .leftRight('VAT-Exempt Sales:', `P${(data.vatExemptSales || 0).toFixed(2)}`)
      .leftRight('Zero-Rated Sales:', `P${(data.zeroRatedSales || 0).toFixed(2)}`)
      .leftRight('VAT Amount (12%):', `P${(data.vatAmount || 0).toFixed(2)}`);
  } else {
    // Legacy format
    builder
      .leftRight('Subtotal:', `P${data.subtotal.toFixed(2)}`)
      .leftRight('VAT (12%):', `P${data.taxAmount.toFixed(2)}`);
  }

  if (data.discountAmount && data.discountAmount > 0) {
    const discountLabel = data.discountLabel || 'Discount';
    builder.leftRight(`${discountLabel}:`, `-P${data.discountAmount.toFixed(2)}`);
  }

  builder
    .doubleSeparator()
    .bold(true)
    .leftRight('TOTAL:', `P${data.total.toFixed(2)}`)
    .bold(false)
    .separator();

  // Payment
  builder
    .leftRight('Payment:', data.paymentMethod)
    .leftRight('Tendered:', `P${data.amountTendered.toFixed(2)}`)
    .leftRight('Change:', `P${data.changeAmount.toFixed(2)}`);

  builder.feed();

  // Footer
  builder
    .align('center')
    .separator()
    .println('Thank you for your purchase!')
    .println('Please come again');

  if (data.footerText) {
    builder.feed().println(data.footerText);
  }

  builder
    .feed()
    .println('*** THIS SERVES AS YOUR ***')
    .println('*** OFFICIAL RECEIPT ***')
    .feed(2);

  // Cut paper
  builder.cut();

  return builder;
}

/**
 * Build a simple test print
 */
export function buildTestPrint(printerWidth: number = PRINTER_WIDTH.MM_58): ESCPOSBuilder {
  const builder = new ESCPOSBuilder(printerWidth);

  builder
    .align('center')
    .bold(true)
    .doubleSize()
    .println('PRINTER TEST')
    .normalSize()
    .bold(false)
    .feed()
    .separator()
    .align('left')
    .println('Normal text line')
    .bold(true)
    .println('Bold text line')
    .bold(false)
    .underline(true)
    .println('Underlined text')
    .underline(false)
    .feed()
    .leftRight('Left', 'Right')
    .columns('Col1', 'Col2', 'Col3')
    .separator()
    .align('center')
    .println('Printer is working!')
    .feed()
    .println(new Date().toLocaleString())
    .feed(2)
    .cut();

  return builder;
}

/**
 * Build X-Reading report
 */
export function buildXReading(
  data: {
    businessName: string;
    tin?: string;
    readingNumber: number;
    cashierName: string;
    startTime: Date;
    endTime: Date;
    transactionCount: number;
    grossSales: number;
    netSales: number;
    vatAmount: number;
    discounts: number;
    voidCount: number;
    voidAmount: number;
  },
  printerWidth: number = PRINTER_WIDTH.MM_58
): ESCPOSBuilder {
  const builder = new ESCPOSBuilder(printerWidth);

  builder
    .align('center')
    .bold(true)
    .doubleSize()
    .println('X-READING')
    .normalSize()
    .bold(false)
    .println(data.businessName)
    .println(`TIN: ${data.tin || 'N/A'}`)
    .feed()
    .doubleSeparator()
    .align('left');

  builder
    .leftRight('Reading No:', `#${data.readingNumber}`)
    .leftRight('Cashier:', data.cashierName)
    .leftRight('Start:', data.startTime.toLocaleString())
    .leftRight('End:', data.endTime.toLocaleString())
    .separator();

  builder
    .leftRight('Transactions:', data.transactionCount.toString())
    .leftRight('Gross Sales:', `P${data.grossSales.toFixed(2)}`)
    .leftRight('Discounts:', `-P${data.discounts.toFixed(2)}`)
    .leftRight('VAT:', `P${data.vatAmount.toFixed(2)}`)
    .separator()
    .bold(true)
    .leftRight('NET SALES:', `P${data.netSales.toFixed(2)}`)
    .bold(false)
    .separator();

  builder
    .leftRight('Void Count:', data.voidCount.toString())
    .leftRight('Void Amount:', `P${data.voidAmount.toFixed(2)}`);

  builder
    .feed()
    .align('center')
    .println('*** NON-FISCAL ***')
    .println('*** INQUIRY ONLY ***')
    .feed(2)
    .cut();

  return builder;
}

/**
 * Build Z-Reading report (End of Day)
 */
export function buildZReading(
  data: {
    businessName: string;
    businessAddress?: string;
    tin?: string;
    permitNumber?: string;
    machineId?: string;
    zReadingNumber: number;
    date: Date;
    resetCounter: number;
    beginningOR: string;
    endingOR: string;
    grossSales: number;
    regularDiscount: number;
    seniorDiscount: number;
    voidAmount: number;
    returnAmount: number;
    netSales: number;
    vatableSales: number;
    vatAmount: number;
    vatExemptSales: number;
    zeroRatedSales: number;
    transactionCount: number;
    cashierName: string;
  },
  printerWidth: number = PRINTER_WIDTH.MM_58
): ESCPOSBuilder {
  const builder = new ESCPOSBuilder(printerWidth);

  // Header
  builder
    .align('center')
    .bold(true)
    .doubleSize()
    .println('Z-READING')
    .normalSize()
    .bold(false)
    .println(data.businessName);

  if (data.businessAddress) {
    builder.println(data.businessAddress);
  }

  builder.println(`TIN: ${data.tin || 'N/A'}`);

  if (data.permitNumber) {
    builder.println(`Permit: ${data.permitNumber}`);
  }

  if (data.machineId) {
    builder.println(`Machine ID: ${data.machineId}`);
  }

  builder
    .feed()
    .doubleSeparator()
    .align('left');

  // Report info
  builder
    .leftRight('Z-Reading No:', `#${data.zReadingNumber}`)
    .leftRight('Date:', data.date.toLocaleDateString())
    .leftRight('Reset Counter:', data.resetCounter.toString())
    .separator();

  // OR Range
  builder
    .leftRight('Beginning OR:', data.beginningOR)
    .leftRight('Ending OR:', data.endingOR)
    .separator();

  // Sales breakdown
  builder
    .bold(true)
    .println('SALES BREAKDOWN')
    .bold(false)
    .leftRight('Gross Sales:', `P${data.grossSales.toFixed(2)}`)
    .leftRight('Regular Discount:', `-P${data.regularDiscount.toFixed(2)}`)
    .leftRight('SC/PWD Discount:', `-P${data.seniorDiscount.toFixed(2)}`)
    .leftRight('Void:', `-P${data.voidAmount.toFixed(2)}`)
    .leftRight('Returns:', `-P${data.returnAmount.toFixed(2)}`)
    .separator()
    .bold(true)
    .leftRight('NET SALES:', `P${data.netSales.toFixed(2)}`)
    .bold(false)
    .separator();

  // VAT breakdown
  builder
    .bold(true)
    .println('VAT BREAKDOWN')
    .bold(false)
    .leftRight('VATable Sales:', `P${data.vatableSales.toFixed(2)}`)
    .leftRight('VAT Amount:', `P${data.vatAmount.toFixed(2)}`)
    .leftRight('VAT Exempt:', `P${data.vatExemptSales.toFixed(2)}`)
    .leftRight('Zero Rated:', `P${data.zeroRatedSales.toFixed(2)}`)
    .separator();

  // Summary
  builder
    .leftRight('Trans Count:', data.transactionCount.toString())
    .leftRight('Cashier:', data.cashierName)
    .feed()
    .align('center')
    .doubleSeparator()
    .bold(true)
    .println('*** END OF DAY REPORT ***')
    .bold(false)
    .println(new Date().toLocaleString())
    .feed(2)
    .cut();

  return builder;
}

export default {
  ESCPOSBuilder,
  PRINTER_WIDTH,
  COMMANDS,
  BARCODE_TYPE,
  buildReceipt,
  buildTestPrint,
  buildXReading,
  buildZReading,
};
