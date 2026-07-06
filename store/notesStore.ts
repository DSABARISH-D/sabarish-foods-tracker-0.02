import { create } from 'zustand';
import { Note } from '@/types';
import { fetchNotes, insertNote, updateNote, deleteNote } from '@/services/supabase.service';
import { useAuthStore } from './index';

interface NotesStore {
  notes: Note[];
  notesLoading: boolean;
  loadNotes: () => Promise<void>;
  addNote: (title: string, description: string, category: string | null) => Promise<void>;
  editNote: (id: string, title: string, description: string, category: string | null) => Promise<void>;
  removeNote: (id: string) => Promise<void>;
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  notesLoading: false,

  loadNotes: async () => {
    const user = useAuthStore.getState().user;
    const activeStaff = useAuthStore.getState().activeStaff;
    
    const restaurantId = activeStaff ? activeStaff.owner_id : user?.id;

    if (!restaurantId) return;

    set({ notesLoading: true });
    try {
      const notes = await fetchNotes(restaurantId);
      set({ notes });
    } catch (e) {
      console.error('Failed to load notes', e);
    } finally {
      set({ notesLoading: false });
    }
  },

  addNote: async (title, description, category) => {
    const user = useAuthStore.getState().user;
    const activeStaff = useAuthStore.getState().activeStaff;
    const restaurantId = activeStaff ? activeStaff.owner_id : user?.id;

    if (!restaurantId || !user) return;

    try {
      const newNote = await insertNote(restaurantId, user.id, title, description, category);
      if (newNote) {
        set((state) => ({ notes: [newNote, ...state.notes] }));
      }
    } catch (e) {
      console.error('Failed to add note', e);
      throw e;
    }
  },

  editNote: async (id, title, description, category) => {
    try {
      const updatedNote = await updateNote(id, title, description, category);
      if (updatedNote) {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? updatedNote : n)),
        }));
      }
    } catch (e) {
      console.error('Failed to edit note', e);
      throw e;
    }
  },

  removeNote: async (id) => {
    try {
      await deleteNote(id);
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
      }));
    } catch (e) {
      console.error('Failed to remove note', e);
      throw e;
    }
  },
}));
