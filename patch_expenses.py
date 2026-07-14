import re

with open('app/tabs/expenses.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Fix zIndex
code = code.replace(
    "<View style={{ marginBottom: 12, position: 'relative' }}>\n          <Ionicons name=\"search-outline\"", 
    "<View style={{ marginBottom: 12, position: 'relative', zIndex: 50, elevation: 10 }}>\n          <Ionicons name=\"search-outline\""
)

# 2. Update StorePurchasesForm handleAddItem
old_store_add = '''    setItems((prev) => [...prev, added]);

    // Reset active fields
    setActiveItem({ id: 'active', name: '', quantity: '', price: '', paymentStatus: 'Paid' });'''

new_store_add = '''    setItems((prev) => [...prev, added]);

    // Auto-save to master list if new
    if (!storeItems.find(i => i.toLowerCase() === name.toLowerCase())) {
       try { await addItem(name, 'store_purchases'); } catch(e) {}
    }

    // Reset active fields
    setActiveItem({ id: 'active', name: '', quantity: '', price: '', paymentStatus: 'Paid' });'''

code = code.replace(old_store_add, new_store_add)
code = code.replace('const handleAddItem = useCallback(() => {', 'const handleAddItem = useCallback(async () => {', 1)

# 3. Update MarketPurchasesForm handleAddItem
old_market_add = '''    setItems((prev) => [...prev, added]);

    // Reset active fields
    setActiveItem({ id: 'active', name: '', quantity: '', price: '' });'''

new_market_add = '''    setItems((prev) => [...prev, added]);

    // Auto-save to master list if new
    if (!marketItems.find(i => i.toLowerCase() === name.toLowerCase())) {
       try { await addItem(name, 'market_purchases'); } catch(e) {}
    }

    // Reset active fields
    setActiveItem({ id: 'active', name: '', quantity: '', price: '' });'''

code = code.replace(old_market_add, new_market_add)
code = code.replace('const handleAddItem = useCallback(() => {', 'const handleAddItem = useCallback(async () => {', 1)

with open('app/tabs/expenses.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('Patched successfully.')
