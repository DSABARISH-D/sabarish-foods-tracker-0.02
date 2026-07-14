import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useNotesStore, useAuthStore } from '@/store';
import { Note, NoteCategory } from '@/types';
import { SHADOW } from '@/constants/theme';
import { AppTextInput } from '@/components/ui/AppTextInput';

const CATEGORIES: NoteCategory[] = ['Business', 'Supplier', 'Customer', 'Staff', 'Reminder', 'Other'];

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const { notes, notesLoading, loadNotes, addNote, editNote, removeNote } = useNotesStore();
  const { activeStaff } = useAuthStore();
  const isOwner = !activeStaff;

  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<NoteCategory | null>(null);

  useEffect(() => {
    loadNotes();
  }, []);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(n => 
      n.title.toLowerCase().includes(q) || 
      n.description.toLowerCase().includes(q) ||
      (n.category && n.category.toLowerCase().includes(q))
    );
  }, [notes, searchQuery]);

  const openEditor = (note?: Note) => {
    if (note) {
      setActiveNoteId(note.id);
      setTitle(note.title);
      setDescription(note.description);
      setCategory(note.category);
    } else {
      setActiveNoteId(null);
      setTitle('');
      setDescription('');
      setCategory(null);
    }
    setModalVisible(true);
  };

  const closeEditor = () => {
    setModalVisible(false);
    setActiveNoteId(null);
    setTitle('');
    setDescription('');
    setCategory(null);
  };

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Validation', 'Description is required.');
      return;
    }

    const finalTitle = title.trim() || 'Untitled Note';

    setSaving(true);
    try {
      if (activeNoteId) {
        await editNote(activeNoteId, finalTitle, description.trim(), category);
      } else {
        await addNote(finalTitle, description.trim(), category);
      }
      closeEditor();
    } catch (e) {
      Alert.alert('Error', 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!activeNoteId) return;
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await removeNote(activeNoteId);
            closeEditor();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete note.');
          }
        }
      }
    ]);
  };

  const renderNoteCard = ({ item }: { item: Note }) => (
    <TouchableOpacity 
      style={[styles.noteCard, SHADOW.sm]} 
      onPress={() => openEditor(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        {item.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardDescription} numberOfLines={3}>{item.description}</Text>
      <View style={styles.cardFooter}>
        <Ionicons name="time-outline" size={14} color="#94A3B8" />
        <Text style={styles.dateText}>
          {new Date(item.updated_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notes</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94A3B8" />
        <AppTextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {notesLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={item => item.id}
          renderItem={renderNoteCard}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={60} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No notes found</Text>
              <Text style={styles.emptySub}>
                {isOwner ? 'Tap the + button to create your first note.' : 'No notes have been added yet.'}
              </Text>
            </View>
          }
        />
      )}

      {isOwner && (
        <TouchableOpacity 
          style={[styles.fab, { bottom: Math.max(insets.bottom + 20, 20) }, SHADOW.md]}
          onPress={() => openEditor()}
        >
          <Ionicons name="add" size={30} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Note Editor Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditor}
      >
        <KeyboardAvoidingView 
          style={{ flex: 1, backgroundColor: '#F8F9FA' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeEditor}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{activeNoteId ? (isOwner ? 'Edit Note' : 'View Note') : 'New Note'}</Text>
            {isOwner ? (
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#F97316" />
                ) : (
                  <Text style={styles.modalSave}>Save</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <AppTextInput
              style={styles.titleInput}
              placeholder="Note Title"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor="#94A3B8"
              editable={isOwner}
            />

            <View style={styles.categoriesWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                    onPress={() => isOwner && setCategory(category === cat ? null : cat)}
                    disabled={!isOwner}
                  >
                    <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <AppTextInput
              style={styles.descInput}
              placeholder="Start typing your note here..."
              value={description}
              onChangeText={setDescription}
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              editable={isOwner}
            />
          </ScrollView>

          {isOwner && activeNoteId && (
            <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={styles.deleteBtnText}>Delete Note</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 16,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 8,
    fontSize: 15,
    color: '#0F172A',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  noteCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 10,
  },
  categoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  cardDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  modalCancel: {
    fontSize: 16,
    color: '#64748B',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F97316',
  },
  modalBody: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  categoriesWrapper: {
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingBottom: 16,
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  categoryChipTextActive: {
    color: '#EA580C',
    fontWeight: '600',
  },
  descInput: {
    flex: 1,
    fontSize: 16,
    color: '#334155',
    lineHeight: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: 200,
  },
  modalFooter: {
    backgroundColor: '#FFF',
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    borderRadius: 8,
  },
  deleteBtnText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
});

