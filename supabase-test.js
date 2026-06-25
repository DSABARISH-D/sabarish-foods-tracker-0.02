const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aknwolfrkqispsxxhclp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrbndvbGZya3Fpc3BzeHhoY2xwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDgyNDAsImV4cCI6MjA5Nzg4NDI0MH0.MiyD8rwGhh6afRDvHJPLszOUKLDnoHrYjZh1-G7Lnbg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabase() {
  console.log("Starting Supabase connection test...");
  
  const tables = ['users', 'sales', 'expenses', 'inventory', 'cash_balance', 'kadan'];
  const results = {};
  let totalErrors = 0;

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        results[table] = { status: 'Error', message: error.message, code: error.code };
        totalErrors++;
      } else {
        results[table] = { status: 'Success', rowCount: count };
      }
    } catch (err) {
      results[table] = { status: 'Exception', message: err.message };
      totalErrors++;
    }
  }

  console.log(JSON.stringify({
    connected: true,
    tables: results,
    totalErrors,
  }, null, 2));
}

testSupabase().catch(e => {
  console.error("Fatal error:", e);
});
