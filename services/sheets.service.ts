import { Expense, Sale } from '@/types';
import { markSyncedToSheets } from './supabase.service';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const SPREADSHEET_ID = process.env.EXPO_PUBLIC_SHEETS_SPREADSHEET_ID ?? '';
const SHEETS_API_KEY = process.env.EXPO_PUBLIC_SHEETS_API_KEY ?? '';

// ── Types ─────────────────────────────────────────────────────────────
export interface SyncResult {
  success: boolean;
  updatedRange?: string;
  error?: string;
}

export interface VerifyResult {
  connected: boolean;
  salesLastRow?: string[];
  expensesLastRow?: string[];
  error?: string;
}

// ── Headers Setup (called once on login) ─────────────────────────────
export async function initializeSheetsHeaders(): Promise<void> {
  if (!SPREADSHEET_ID || !SHEETS_API_KEY) return;

  const salesHeaders = [['ID', 'Date', 'Category', 'Amount', 'Payment Method', 'Description', 'Synced At']];
  const expensesHeaders = [['ID', 'Date', 'Category', 'Amount', 'Description', 'Chicken KG', 'Price/KG', 'Synced At']];

  // Only write headers if row 1 is empty
  try {
    const [salesRow1, expRow1] = await Promise.all([
      readSheetRange('Sales!A1:G1'),
      readSheetRange('Expenses!A1:H1'),
    ]);
    if (!salesRow1?.values?.length) await appendRows('Sales', salesHeaders);
    if (!expRow1?.values?.length) await appendRows('Expenses', expensesHeaders);
  } catch {
    // Best-effort — don't block login
  }
}

// ── Core Fetch Helpers ────────────────────────────────────────────────
async function appendRows(sheetName: string, values: (string | number)[][]): Promise<{ updatedRange?: string }> {
  const url = `${SHEETS_API_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&key=${SHEETS_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${body}`);
  }
  const json = await res.json() as { updates?: { updatedRange?: string } };
  return { updatedRange: json.updates?.updatedRange };
}

async function readSheetRange(range: string): Promise<{ values?: string[][] } | null> {
  const url = `${SHEETS_API_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${SHEETS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json() as Promise<{ values?: string[][] }>;
}

// ── Row Builders ──────────────────────────────────────────────────────
function buildSaleRow(sale: Sale): (string | number)[] {
  return [
    sale.id,
    sale.date,
    sale.category,
    sale.amount,
    sale.payment_method,
    sale.description ?? '',
    new Date().toISOString(),
  ];
}

function buildExpenseRow(expense: Expense): (string | number)[] {
  return [
    expense.id,
    expense.date,
    expense.category,
    expense.amount,
    expense.description ?? '',
    expense.chicken_kg ?? '',
    expense.chicken_price_per_kg ?? '',
    new Date().toISOString(),
  ];
}

// ── Direct Sync Functions ─────────────────────────────────────────────
export async function syncSaleToSheets(sale: Sale): Promise<SyncResult> {
  if (!SPREADSHEET_ID || !SHEETS_API_KEY) {
    return { success: false, error: 'Google Sheets not configured. Set EXPO_PUBLIC_SHEETS_SPREADSHEET_ID and EXPO_PUBLIC_SHEETS_API_KEY.' };
  }
  try {
    const { updatedRange } = await appendRows('Sales', [buildSaleRow(sale)]);
    await markSyncedToSheets('sales', sale.id);
    return { success: true, updatedRange };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function syncExpenseToSheets(expense: Expense): Promise<SyncResult> {
  if (!SPREADSHEET_ID || !SHEETS_API_KEY) {
    return { success: false, error: 'Google Sheets not configured. Set EXPO_PUBLIC_SHEETS_SPREADSHEET_ID and EXPO_PUBLIC_SHEETS_API_KEY.' };
  }
  try {
    const { updatedRange } = await appendRows('Expenses', [buildExpenseRow(expense)]);
    await markSyncedToSheets('expenses', expense.id);
    return { success: true, updatedRange };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ── Read Last N Rows ──────────────────────────────────────────────────
export async function readLastRows(
  sheetName: string,
  count: number = 1
): Promise<{ success: boolean; rows?: string[][]; error?: string }> {
  try {
    // Get the last `count` rows — we use a large A:Z range and take the tail
    const data = await readSheetRange(`${sheetName}!A1:Z1000`);
    if (!data?.values || data.values.length === 0) {
      return { success: true, rows: [] };
    }
    const rows = data.values.slice(-count);
    return { success: true, rows };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ── Verify Connection ─────────────────────────────────────────────────
export async function verifySheetsConnection(): Promise<VerifyResult> {
  if (!SPREADSHEET_ID || !SHEETS_API_KEY) {
    return {
      connected: false,
      error: 'Not configured. Set EXPO_PUBLIC_SHEETS_SPREADSHEET_ID and EXPO_PUBLIC_SHEETS_API_KEY in .env',
    };
  }

  try {
    const [salesResult, expResult] = await Promise.all([
      readLastRows('Sales', 1),
      readLastRows('Expenses', 1),
    ]);

    return {
      connected: salesResult.success,
      salesLastRow: salesResult.rows?.[0],
      expensesLastRow: expResult.rows?.[0],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { connected: false, error: msg };
  }
}
