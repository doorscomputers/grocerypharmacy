# Task: Add Payment Receipt Preview with Print and Email Options

## Objective
After processing a customer payment, show a receipt preview with options to:
1. Print to Bluetooth printer
2. Send to email with validation

## Todo Items
- [x] Create PaymentReceiptPreview component
- [x] Add buildPaymentReceipt function to escpos.ts
- [x] Integrate receipt preview into CustomerPaymentsScreen
- [x] Add Print to Bluetooth printer functionality
- [x] Add Send to Email option with email validation

## Changes Made

### 1. New Component: `components/PaymentReceiptPreview.tsx`
- Receipt preview modal showing payment details
- Three action buttons: Close, Email, Print
- Email input with validation (standard email regex)
- Shows: Business info, payment number, customer info, invoice details, amount paid, balance, payment method
- Professional receipt-style layout

### 2. Updated: `utils/escpos.ts`
- Added `PaymentReceiptPrintData` interface
- Added `buildPaymentReceipt()` function for ESC/POS thermal printer output
- Formats: Receipt header, payment details, customer info, amounts, footer
- Supports both 58mm and 80mm paper widths

### 3. Updated: `screens/CustomerPaymentsScreen.tsx`
- Added imports for PaymentReceiptPreview, BluetoothPrinterService, buildPaymentReceipt
- Added state: receiptPreviewVisible, receiptData, isPrinting, isSendingEmail
- Modified `processPayment()` to show receipt preview after successful payment
- Added `handlePrintReceipt()` - prints to Bluetooth printer
- Added `handleSendEmail()` - validates email and sends (simulated for now)
- Added `handleCloseReceipt()` - closes the receipt preview
- Added PaymentReceiptPreview component to the render

## How It Works

1. User clicks "Collect Payment" on an outstanding receivable
2. User enters payment amount, method, reference (optional), notes (optional)
3. User clicks "Process Payment"
4. On success, payment modal closes and Receipt Preview appears
5. Receipt shows all payment details in a professional format
6. User can:
   - **Print**: Sends to connected Bluetooth printer (prompts to connect if not connected)
   - **Email**: Shows email input with validation, sends receipt to customer
   - **Close**: Dismisses the receipt preview

## Email Validation
- Uses standard regex: `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/`
- Shows error message if email is invalid
- Email field auto-capitalizes off, no autocorrect
- Success alert after sending

## Notes
- Email sending is currently simulated (console.log)
- Real implementation would need an API endpoint to send emails
- Printer connection check redirects to PrinterSettings if not connected
