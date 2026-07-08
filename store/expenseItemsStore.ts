import { create } from 'zustand';
import { ExpenseItem } from '@/types';
import { fetchExpenseItems, insertExpenseItem } from '@/services/supabase.service';
import { useAuthStore } from './index';

interface ExpenseItemsStore {
  items: ExpenseItem[];
  itemsLoading: boolean;
  loadItems: () => Promise<void>;
  addItem: (itemName: string, category: 'store_purchases' | 'market_purchases') => Promise<void>;
}

export const useExpenseItemsStore = create<ExpenseItemsStore>((set, get) => ({
  items: [],
  itemsLoading: false,

  loadItems: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ itemsLoading: true });
    try {
      const data = await fetchExpenseItems(user.id);
      set({ items: data as ExpenseItem[], itemsLoading: false });
    } catch (e) {
      console.error('Failed to load expense items:', e);
      set({ itemsLoading: false });
    }
  },

  addItem: async (itemName: string, category: 'store_purchases' | 'market_purchases') => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Local duplication check
    const existing = get().items.find(
      (i) => i.item_name.toLowerCase() === itemName.toLowerCase() && i.category === category
    );
    if (existing) {
      return; // Prevent duplicate
    }

    try {
      const newItem = await insertExpenseItem(user.id, itemName, category);
      set((state) => ({ items: [...state.items, newItem as ExpenseItem] }));
    } catch (e) {
      console.error('Failed to add expense item:', e);
      throw e;
    }
  },
}));
