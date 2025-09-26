# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a BIR-compliant Mobile Point of Sale (POS) system built with React Native and Expo, specifically designed for Philippine businesses. The app follows Philippine BIR regulations including Revenue Regulations No. 7-2024 and 11-2024.

## Common Commands

### Development
- `npm start` or `npx expo start` - Start development server
- `npx expo start --clear` - Start with cleared cache (recommended when troubleshooting)
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator (macOS only)
- `npm run web` - Run in web browser

### Type Checking & Quality
- `npx tsc --noEmit` - Run TypeScript type checking
- TypeScript is configured with `strict: false` in tsconfig.json for development flexibility

### Build & Deploy
- `npx expo build:android` - Build Android APK
- `npx expo build:ios` - Build iOS app (macOS only)

## Architecture Overview

### Database Layer
- **SQLite Database**: Local storage using expo-sqlite
- **DatabaseService**: Singleton pattern service class (`database/DatabaseService.ts`)
- **Schema Definition**: Centralized schema and types in `database/schema.ts`
- **Type Exports**: All database types are exported from schema (Product, Transaction, User, etc.)
- **BIR Compliance**: Built-in eJournal, Z-Reading, and X-Reading support

### App Structure
- **Navigation**: React Navigation with Stack Navigator
- **State Management**: Local React state (no external state management)
- **UI Library**: React Native Paper with Material Design theme
- **Screen-based Architecture**: Each major function has its own screen component

### Key Screens
- **LoginScreen**: User authentication (demo mode with any password)
- **DashboardScreen**: Main overview with sales statistics
- **SalesScreen**: POS terminal for processing transactions
- **ProductsScreen**: Product catalog management
- **ReportsScreen**: BIR-compliant Z-Reading and X-Reading reports
- **SettingsScreen**: System configuration including BIR details

### BIR Compliance Features
- **Invoice Numbering**: Sequential BIR-compliant invoice numbers (replacing Official Receipts)
- **VAT Calculations**: 12% VAT handling (inclusive/exclusive)
- **Z-Reading**: End-of-day cumulative sales reports
- **X-Reading**: Mid-day inquiry reports (non-resetting)
- **eJournal**: Complete audit trail for all transactions
- **TIN Support**: Tax Identification Number fields for customers and business

### Database Schema Key Points
- **Transactions Table**: BIR-compliant with invoice_number and transaction_number
- **Products Table**: Includes VAT settings (tax_rate, is_vat_inclusive)
- **Users Table**: Role-based access (ADMIN, CASHIER, MANAGER)
- **Settings Table**: Key-value configuration store for BIR details
- **Z/X Readings**: Separate tables for compliance reporting
- **eJournal**: Audit trail table for all system activities

## Development Guidelines

### Database Operations
- Always use DatabaseService.getInstance() for database operations
- Import types from `database/schema` (e.g., `import { Product, Transaction } from '../database/schema'`)
- All database queries should handle SQLite's type safety requirements
- Use proper type casting for database results to avoid `unknown` types

### TypeScript Usage
- Import database types from schema.ts for type safety
- Handle database query results properly to avoid type errors
- Use proper type annotations for component props and state

### BIR Compliance
- All financial calculations must follow Philippine VAT rules (12%)
- Invoice numbers must be sequential and BIR-compliant
- eJournal entries are required for audit trails
- Z-Reading data must be cumulative and never reset
- X-Reading data is for inquiry only and doesn't affect counters

### Mobile Optimization
- All screens are optimized for mobile and tablet use
- Material Design components provide consistent touch interfaces
- Proper contrast ratios maintained for professional appearance
- Responsive layouts for different screen sizes

## Sample Data
The app includes Philippine business sample data:
- Default admin user (username: "admin", any password in demo mode)
- Sample products (Coca Cola, Rice, Cooking Oil, etc.)
- Pre-configured BIR settings for testing

## Demo Credentials
- **Username**: admin
- **Password**: Any password (demo mode)

## Troubleshooting
- Use `npx expo start --clear` if experiencing cache issues
- Check TypeScript errors with `npx tsc --noEmit`
- Ensure Android emulator is running before `npm run android`
- Port conflicts: Expo may suggest alternative ports (accept when prompted)