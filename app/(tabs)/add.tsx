import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types/database';
import { Wallet, Banknote, TrendingDown, TrendingUp, X } from 'lucide-react-native';

export default function AddTransactionScreen() {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'account'>('account');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => { loadCategories(); }, [type]);

  const loadCategories = async () => {
    const { data } = await supabase.from('categories').select('*').eq('type', type).order('name');
    if (data) {
      setCategories(data);
      if (data.length > 0 && !category) setCategory(data[0].name);
    }
  };

  const handleAddTransaction = async () => {
    if (!amount || !category) { setError('Please fill required fields'); return; }
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) { setError('Please enter valid amount'); return; }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: balanceData } = await supabase.from('user_balances').select('*').eq('user_id', user?.id).maybeSingle();
      let newAccountBalance = balanceData?.account_balance || 0;
      let newCashBalance = balanceData?.cash_balance || 0;

      if (type === 'expense') {
        if (paymentMethod === 'account') newAccountBalance -= amountValue;
        else newCashBalance -= amountValue;
      } else {
        if (paymentMethod === 'account') newAccountBalance += amountValue;
        else newCashBalance += amountValue;
      }

      const [transRes, balRes] = await Promise.all([
        supabase.from('transactions').insert({ user_id: user?.id, amount: amountValue, type, category, payment_method: paymentMethod, description, transaction_date: transactionDate }),
        supabase.from('user_balances').update({ account_balance: newAccountBalance, cash_balance: newCashBalance }).eq('user_id', user?.id),
      ]);

      if (transRes.error) throw transRes.error;
      if (balRes.error) throw balRes.error;

      setSuccess('Transaction added successfully!');
      setAmount('');
      setDescription('');
      setTransactionDate(new Date().toISOString().split('T')[0]);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = categories.find((c) => c.name === category);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.innerContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Transaction</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {success ? <Text style={styles.successText}>{success}</Text> : null}

      <View style={styles.typeSelector}>
        <TouchableOpacity style={[styles.typeButton, type === 'expense' && styles.typeButtonActive]}
          onPress={() => { setType('expense'); setCategory(''); }}>
          <TrendingDown size={24} color={type === 'expense' ? '#FFFFFF' : '#EF4444'} />
          <Text style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}>Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.typeButton, type === 'income' && styles.typeButtonActive]}
          onPress={() => { setType('income'); setCategory(''); }}>
          <TrendingUp size={24} color={type === 'income' ? '#FFFFFF' : '#10B981'} />
          <Text style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}>Income</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.amountInput} placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!loading} />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Category</Text>
          <TouchableOpacity style={styles.categoryButton} onPress={() => setShowCategoryModal(true)}>
            {selectedCategory && <View style={[styles.categoryColor, { backgroundColor: selectedCategory.color }]} />}
            <Text style={styles.categoryButtonText}>{category || 'Select category'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Payment Method</Text>
          <View style={styles.paymentSelector}>
            <TouchableOpacity style={[styles.paymentButton, paymentMethod === 'account' && styles.paymentButtonActive]} onPress={() => setPaymentMethod('account')}>
              <Wallet size={20} color={paymentMethod === 'account' ? '#FFFFFF' : '#3B82F6'} />
              <Text style={[styles.paymentButtonText, paymentMethod === 'account' && styles.paymentButtonTextActive]}>Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.paymentButton, paymentMethod === 'cash' && styles.paymentButtonActive]} onPress={() => setPaymentMethod('cash')}>
              <Banknote size={20} color={paymentMethod === 'cash' ? '#FFFFFF' : '#10B981'} />
              <Text style={[styles.paymentButtonText, paymentMethod === 'cash' && styles.paymentButtonTextActive]}>Cash</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Date</Text>
          <TextInput style={styles.input} value={transactionDate} onChangeText={setTransactionDate} placeholder="YYYY-MM-DD" editable={!loading} />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Add a note..." value={description} onChangeText={setDescription} multiline numberOfLines={3} editable={!loading} />
        </View>

        <TouchableOpacity style={[styles.submitButton, loading && styles.submitButtonDisabled]} onPress={handleAddTransaction} disabled={loading}>
          <Text style={styles.submitButtonText}>{loading ? 'Adding...' : 'Add Transaction'}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showCategoryModal} animationType="slide" transparent={true} onRequestClose={() => setShowCategoryModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.categoriesList}>
              {categories.map((cat) => (
                <TouchableOpacity key={cat.id} style={[styles.categoryItem, category === cat.name && styles.categoryItemActive]}
                  onPress={() => { setCategory(cat.name); setShowCategoryModal(false); }}>
                  <View style={[styles.categoryColor, { backgroundColor: cat.color }]} />
                  <Text style={styles.categoryItemText}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  innerContainer: { flex: 1 },
  header: { padding: 24, paddingTop: 60 },
  title: { fontSize: 32, fontWeight: '700', color: '#111827' },
  typeSelector: { flexDirection: 'row', marginHorizontal: 24, marginBottom: 24, gap: 12 },
  typeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, gap: 8 },
  typeButtonActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  typeButtonText: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  typeButtonTextActive: { color: '#FFFFFF' },
  form: { paddingHorizontal: 24 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 16, color: '#111827' },
  amountInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 32, fontWeight: '700', color: '#111827' },
  textArea: { height: 80, textAlignVertical: 'top' },
  categoryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' },
  categoryButtonText: { fontSize: 16, color: '#111827', fontWeight: '600' },
  categoryColor: { width: 24, height: 24, borderRadius: 12, marginRight: 12 },
  paymentSelector: { flexDirection: 'row', gap: 12 },
  paymentButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, gap: 8 },
  paymentButtonActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  paymentButtonText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  paymentButtonTextActive: { color: '#FFFFFF' },
  submitButton: { backgroundColor: '#3B82F6', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  errorText: { color: '#EF4444', fontSize: 14, marginHorizontal: 24, marginBottom: 16, textAlign: 'center', backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8 },
  successText: { color: '#10B981', fontSize: 14, marginHorizontal: 24, marginBottom: 16, textAlign: 'center', backgroundColor: '#D1FAE5', padding: 12, borderRadius: 8 },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  categoriesList: { paddingHorizontal: 24 },
  categoryItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8, backgroundColor: '#F9FAFB' },
  categoryItemActive: { backgroundColor: '#DBEAFE' },
  categoryItemText: { fontSize: 16, fontWeight: '600', color: '#111827' },
});
