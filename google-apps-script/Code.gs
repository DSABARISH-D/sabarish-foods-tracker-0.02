// ============================================================
// SABARISH FOODS — Google Apps Script (Web App)
// ============================================================
// Architecture:
//   React Native App → Supabase (primary DB) → Google Apps Script → Google Sheets
//
// Deploy as Web App:
//   Execute As: Me
//   Access:     Anyone with the link
// ============================================================

var COL = {
  SERIAL:          1,   // A
  DATE:            2,   // B
  CASH_IN_HAND:    3,   // C
  UPI:             4,   // D
  CREDIT:          5,   // E
  TOTAL_SALES:     6,   // F
  CHICKEN_KG:      7,   // G
  CHICKEN_COST:    8,   // H
  GROCERY:         9,   // I
  INDIAN_MARKET:  10,   // J
  STORE_PURCHASE: 11,   // K
  STAFF_SALARY:   12,   // L
  GAS:            13,   // M
  ELECTRICITY:    14,   // N
  WATER_SUPPLY:   15,   // O
  TRANSPORT:      16,   // P
  OTHER_EXPENSES: 17,   // Q
  TOTAL_EXPENSES: 18,   // R
  PROFIT:         19,   // S
  RICE_STATUS:    20,   // T
  GAS_STATUS:     21,   // U
  NOTES:          22,   // V
  CASH_EXPENSES:  23    // W
};

var HEADERS = [
  'S.No', 'Date', 'Cash in Hand', 'UPI / Paytm', 'Credit (Kadan)',
  'Total Sales', 'Chicken (Kg)', 'Chicken Cost', 'Grocery (Maligai)',
  'Indian Market', 'Store Purchase', 'Staff Salary', 'Gas',
  'Electricity', 'Water Supply', 'Transport', 'Other Expenses',
  'Total Expenses', 'Profit', 'Rice Status', 'Gas Status', 'Notes', 'Cash Expenses'
];

var MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// ============================================================
// doPost — Main entry point for write operations
// ============================================================
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action; // 'CREATE', 'UPDATE', 'DELETE'
    var date   = payload.date || getTodayDateString(); 
    var totals = payload.totals; 

    var sheet = getCurrentMonthSheet(date);
    var sheetName = sheet.getName();
    
    // findRowByDate ensures 1 unique row per date.
    var rowInfo = findRowByDate(sheet, date);
    var row = rowInfo.row;

    if (!rowInfo.found) {
      row = createRecord(sheet, date, totals);
    } else {
      if (action === 'DELETE') {
        deleteRecord(sheet, row, totals);
      } else {
        updateRecord(sheet, row, totals);
      }
    }

    recalculateTotals(sheet, row);

    return jsonResponse(true, 'Google Sheet Updated', sheetName, row);
  } catch (err) {
    return jsonResponse(false, err.toString(), null, null);
  }
}

// ============================================================
// doGet — Health check
// ============================================================
function doGet(e) {
  return jsonResponse(true, 'Google Apps Script is running', null, null);
}

// ============================================================
// createRecord — Create a new row for the date
// ============================================================
function createRecord(sheet, dateStr, totals) {
  var lastRow = sheet.getLastRow();
  var newRow = lastRow + 1;
  var serialNumber = lastRow <= 1 ? 1 : lastRow - 1;
  var formattedDate = formatDateForSheet(dateStr);

  sheet.getRange(newRow, COL.SERIAL).setValue(serialNumber);
  sheet.getRange(newRow, COL.DATE).setValue(formattedDate);

  // Initialize numeric columns to 0
  var numericCols = [
    COL.CASH_IN_HAND, COL.UPI, COL.CREDIT,
    COL.CHICKEN_KG, COL.CHICKEN_COST, COL.GROCERY,
    COL.INDIAN_MARKET, COL.STORE_PURCHASE, COL.STAFF_SALARY,
    COL.GAS, COL.ELECTRICITY, COL.WATER_SUPPLY,
    COL.TRANSPORT, COL.OTHER_EXPENSES, COL.CASH_EXPENSES
  ];
  numericCols.forEach(function(col) {
    sheet.getRange(newRow, col).setValue(0);
  });

  sheet.getRange(newRow, COL.RICE_STATUS).setValue('');
  sheet.getRange(newRow, COL.GAS_STATUS).setValue('');
  sheet.getRange(newRow, COL.NOTES).setValue('');

  styleDataRow(sheet, newRow);

  // Apply absolute totals
  if (totals) {
    updateRecord(sheet, newRow, totals);
  }

  return newRow;
}

// ============================================================
// updateRecord — Overwrite specific columns with exact totals
// ============================================================
function updateRecord(sheet, row, totals) {
  if (!totals) return;
  var updates = buildUpdateMap(totals);
  var keys = Object.keys(updates);
  for (var i = 0; i < keys.length; i++) {
    var col = parseInt(keys[i]);
    var value = updates[keys[i]];
    // Direct overwrite ensures exactly matching Supabase
    sheet.getRange(row, col).setValue(value);
  }
}

// ============================================================
// deleteRecord — Apply absolute totals after deletion
// ============================================================
function deleteRecord(sheet, row, totals) {
  // Since we pass absolute totals from Supabase, deletion just overwrites 
  // with the new (lower) totals, setting to 0 if no expenses remain.
  updateRecord(sheet, row, totals);
}

// ============================================================
// findRowByDate — Find the exact row for a date
// ============================================================
function findRowByDate(sheet, dateStr) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { found: false, row: -1 };

  var formattedDate = formatDateForSheet(dateStr);
  var dateRange = sheet.getRange(2, COL.DATE, lastRow - 1, 1);
  var dateValues = dateRange.getValues();

  for (var i = 0; i < dateValues.length; i++) {
    var cellValue = dateValues[i][0];
    if (cellValue === '') continue;

    var cellStr = (cellValue instanceof Date) 
      ? Utilities.formatDate(cellValue, Session.getScriptTimeZone(), 'dd-MM-yyyy')
      : cellValue.toString().trim();

    if (cellStr === formattedDate || cellStr === dateStr) {
      return { found: true, row: i + 2 };
    }
  }
  return { found: false, row: -1 };
}

// ============================================================
// recalculateTotals — Exact formulas requested by user
// ============================================================
function recalculateTotals(sheet, row) {
  // Total Sales = Cash + UPI + Credit (Kadan)
  var cash    = getNumericValue(sheet, row, COL.CASH_IN_HAND);
  var upi     = getNumericValue(sheet, row, COL.UPI);
  var credit  = getNumericValue(sheet, row, COL.CREDIT);
  var totalSales = cash + upi + credit;
  sheet.getRange(row, COL.TOTAL_SALES).setValue(totalSales);

  // Total Expenses = sum of all 11 categories
  var chickenCost   = getNumericValue(sheet, row, COL.CHICKEN_COST);
  var grocery       = getNumericValue(sheet, row, COL.GROCERY);
  var indianMarket  = getNumericValue(sheet, row, COL.INDIAN_MARKET);
  var storePurchase = getNumericValue(sheet, row, COL.STORE_PURCHASE);
  var staffSalary   = getNumericValue(sheet, row, COL.STAFF_SALARY);
  var gas           = getNumericValue(sheet, row, COL.GAS);
  var electricity   = getNumericValue(sheet, row, COL.ELECTRICITY);
  var waterSupply   = getNumericValue(sheet, row, COL.WATER_SUPPLY);
  var transport     = getNumericValue(sheet, row, COL.TRANSPORT);
  var otherExpenses = getNumericValue(sheet, row, COL.OTHER_EXPENSES);
  var cashExp       = getNumericValue(sheet, row, COL.CASH_EXPENSES);

  var totalExpenses = chickenCost + grocery + indianMarket + storePurchase +
                      staffSalary + gas + electricity + waterSupply +
                      transport + otherExpenses + cashExp;
  sheet.getRange(row, COL.TOTAL_EXPENSES).setValue(totalExpenses);

  // Profit = Total Sales - Total Expenses
  var profit = totalSales - totalExpenses;
  
  var profitCell = sheet.getRange(row, COL.PROFIT);
  profitCell.setValue(profit);
  if (profit >= 0) {
    profitCell.setFontColor('#15803D').setBackground('#F0FDF4');
  } else {
    profitCell.setFontColor('#B91C1C').setBackground('#FEF2F2');
  }
}

// ============================================================
// buildUpdateMap — Map JSON payload directly to sheet columns
// ============================================================
function buildUpdateMap(totals) {
  var updates = {};
  
  // Mapping Exact absolute values sent by React Native
  if (totals.cash_in_hand !== undefined)   updates[COL.CASH_IN_HAND] = Math.max(0, totals.cash_in_hand);
  if (totals.upi !== undefined)            updates[COL.UPI] = Math.max(0, totals.upi);
  if (totals.credit !== undefined)         updates[COL.CREDIT] = Math.max(0, totals.credit);
  if (totals.chicken_kg !== undefined)     updates[COL.CHICKEN_KG] = Math.max(0, totals.chicken_kg);
  if (totals.chicken_cost !== undefined)   updates[COL.CHICKEN_COST] = Math.max(0, totals.chicken_cost);
  if (totals.grocery !== undefined)        updates[COL.GROCERY] = Math.max(0, totals.grocery);
  if (totals.indian_market !== undefined)  updates[COL.INDIAN_MARKET] = Math.max(0, totals.indian_market);
  if (totals.store_purchase !== undefined) updates[COL.STORE_PURCHASE] = Math.max(0, totals.store_purchase);
  if (totals.staff_salary !== undefined)   updates[COL.STAFF_SALARY] = Math.max(0, totals.staff_salary);
  if (totals.gas !== undefined)            updates[COL.GAS] = Math.max(0, totals.gas);
  if (totals.electricity !== undefined)    updates[COL.ELECTRICITY] = Math.max(0, totals.electricity);
  if (totals.water_supply !== undefined)   updates[COL.WATER_SUPPLY] = Math.max(0, totals.water_supply);
  if (totals.transport !== undefined)      updates[COL.TRANSPORT] = Math.max(0, totals.transport);
  if (totals.other_expenses !== undefined) updates[COL.OTHER_EXPENSES] = Math.max(0, totals.other_expenses);
  if (totals.cash_expenses !== undefined)  updates[COL.CASH_EXPENSES] = Math.max(0, totals.cash_expenses);
  
  if (totals.rice_status !== undefined)    updates[COL.RICE_STATUS] = totals.rice_status;
  if (totals.gas_status !== undefined)     updates[COL.GAS_STATUS] = totals.gas_status;
  if (totals.notes !== undefined)          updates[COL.NOTES] = totals.notes;

  return updates;
}

// ============================================================
// Helpers
// ============================================================
function getCurrentMonthSheet(dateStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dateParts = dateStr.split('-');
  var year  = parseInt(dateParts[0]);
  var month = parseInt(dateParts[1]) - 1; 
  var sheetName = MONTH_NAMES[month] + ' ' + year;
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) sheet = createMonthlySheet(ss, sheetName);
  else ensureColumnsAndHeaders(sheet);

  return sheet;
}

function createMonthlySheet(ss, sheetName) {
  var sheet = ss.insertSheet(sheetName);
  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setValues([HEADERS]);
  headerRange.setFontWeight('bold').setBackground('#F97316').setFontColor('#FFFFFF').setHorizontalAlignment('center').setFontSize(10);
  sheet.setFrozenRows(1);
  return sheet;
}

function ensureColumnsAndHeaders(sheet) {
  var maxCols = sheet.getMaxColumns();
  if (maxCols < HEADERS.length) sheet.insertColumnsAfter(maxCols, HEADERS.length - maxCols);
}

function styleDataRow(sheet, row) {
  var range = sheet.getRange(row, 1, 1, HEADERS.length);
  range.setHorizontalAlignment('center').setVerticalAlignment('middle').setFontSize(10);
  if (row % 2 === 0) range.setBackground('#FFF7ED');
  else range.setBackground('#FFFFFF');
}

function getNumericValue(sheet, row, col) {
  var val = sheet.getRange(row, col).getValue();
  var num = parseFloat(val);
  return isNaN(num) ? 0 : Math.max(0, num);
}

function formatDateForSheet(dateStr) {
  var p = dateStr.split('-');
  return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : dateStr;
}

function getTodayDateString() {
  var now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

function jsonResponse(success, message, sheetName, row) {
  var res = { success: success, message: message };
  if (sheetName) res.sheet = sheetName;
  if (row) res.row = row;
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

// Manually trigger this to generate all 12 months
function createAllMonthsForYear(year) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targetYear = year || new Date().getFullYear();
  for (var month = 0; month < 12; month++) {
    var sheetName = MONTH_NAMES[month] + ' ' + targetYear;
    if (!ss.getSheetByName(sheetName)) createMonthlySheet(ss, sheetName);
  }
}
