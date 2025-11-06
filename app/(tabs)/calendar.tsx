import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Transaction } from '@/types/database';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, X, Trash2, Edit } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';

export default function CalendarScreen() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useFocusEffect(React.useCallback(() => { loadTransactions(); }, [currentDate]));

  const loadTransactions = async () => {
    if (!user) return;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
    const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id)
      .gte('transaction_date', firstDay).lte('transaction_date', lastDay).order('transaction_date', { ascending: false });
    if (data) setTransactions(data);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const getTransactionsForDate = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return transactions.filter((t) => t.transaction_date === dateStr);
  };

  const getDaySummary = (dateStr: string) => {
    const dayTrans = transactions.filter((t) => t.transaction_date === dateStr);
    const totalExpense = dayTrans.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = dayTrans.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    return { totalExpense, totalIncome };
  };

  const handleDeleteTransaction = async (transaction: Transaction) => {
    setLoading(true);
    try {
      const { data: balanceData } = await supabase.from('user_balances').select('*').eq('user_id', user?.id).maybeSingle();
      let newAccountBalance = balanceData?.account_balance || 0;
      let newCashBalance = balanceData?.cash_balance || 0;

      if (transaction.type === 'expense') {
        if (transaction.payment_method === 'account') newAccountBalance += transaction.amount;
        else newCashBalance += transaction.amount;
      } else {
        if (transaction.payment_method === 'account') newAccountBalance -= transaction.amount;
        else newCashBalance -= transaction.amount;
      }

      await Promise.all([
        supabase.from('transactions').delete().eq('id', transaction.id),
        supabase.from('user_balances').update({ account_balance: newAccountBalance, cash_balance: newCashBalance }).eq('user_id', user?.id),
      ]);
      loadTransactions();
      setSelectedDate(null);
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;
    const amountValue = parseFloat(editAmount);
    if (isNaN(amountValue) || amountValue <= 0) return;
    setLoading(true);
    try {
      const { data: balanceData } = await supabase.from('user_balances').select('*').eq('user_id', user?.id).maybeSingle();
      let newAccountBalance = balanceData?.account_balance || 0;
      let newCashBalance = balanceData?.cash_balance || 0;
      const amountDiff = amountValue - editingTransaction.amount;

      if (editingTransaction.type === 'expense') {
        if (editingTransaction.payment_method === 'account') newAccountBalance -= amountDiff;
        else newCashBalance -= amountDiff;
      } else {
        if (editingTransaction.payment_method === 'account') newAccountBalance += amountDiff;
        else newCashBalance += amountDiff;
      }

      await Promise.all([
        supabase.from('transactions').update({ amount: amountValue, description: editDescription }).eq('id', editingTransaction.id),
        supabase.from('user_balances').update({ account_balance: newAccountBalance, cash_balance: newCashBalance }).eq('user_id', user?.id),
      ]);
      setShowEditModal(false);
      loadTransactions();
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  const days = getDaysInMonth();
  const monthYear = currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const selectedDateTransactions = selectedDate ? transactions.filter((t) => t.transaction_date === selectedDate) : [];
  const formatCurrency = (n: number) => `₹${n.toFixed(2)}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
      </View>

      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}>
          <ChevronLeft size={24} color="#3B82F6" />
        </TouchableOpacity>
        <Text style={styles.monthYear}>{monthYear}</Text>
        <TouchableOpacity onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}>
          <ChevronRight size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <View style={styles.weekDays}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <Text key={day} style={styles.weekDay}>{day}</Text>
        ))}
      </View>

      <View style={styles.calendar}>
        {days.map((day, idx) => {
          if (day === null) return <View key={`e-${idx}`} style={styles.dayCell} />;
          const dayTrans = getTransactionsForDate(day);
          const hasTrans = dayTrans.length > 0;
          return (
            <TouchableOpacity key={idx} style={[styles.dayCell, hasTrans && styles.dayCellActive]}
              onPress={() => { const year = currentDate.getFullYear(); const month = currentDate.getMonth(); const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; setSelectedDate(dateStr); }}>
              <Text style={styles.dayNumber}>{day}</Text>
              {hasTrans && (
                <View style={styles.transactionDots}>
                  {dayTrans.some(t => t.type === 'expense') && <View style={styles.expenseDot} />}
                  {dayTrans.some(t => t.type === 'income') && <View style={styles.incomeDot} />}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedDate && (
        <ScrollView style={styles.transactionsList}>
          <Text style={styles.transactionsTitle}>
            Transactions for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          {selectedDateTransactions.length === 0 ? (
            <Text style={styles.noTransactions}>No transactions</Text>
          ) : (
            <>
              <View style={styles.summaryContainer}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Total Expenses</Text>
                  <Text style={styles.expenseTotal}>{formatCurrency(getDaySummary(selectedDate).totalExpense)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Total Income</Text>
                  <Text style={styles.incomeTotal}>{formatCurrency(getDaySummary(selectedDate).totalIncome)}</Text>
                </View>
              </View>
              {selectedDateTransactions.map((t) => (
              <View key={t.id} style={styles.transactionCard}>
                <View style={styles.transactionLeft}>
                  <View style={[styles.transactionIcon, t.type === 'expense' ? styles.expenseIcon : styles.incomeIcon]}>
                    {t.type === 'expense' ? <TrendingDown size={20} color="#FFFFFF" /> : <TrendingUp size={20} color="#FFFFFF" />}
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionCategory}>{t.category}</Text>
                    <Text style={styles.transactionPayment}>{t.payment_method === 'cash' ? 'Cash' : 'Account'}</Text>
                    {t.description ? <Text style={styles.transactionDescription}>{t.description}</Text> : null}
                  </View>
                </View>
                <View style={styles.transactionRight}>
                  <Text style={[styles.transactionAmount, t.type === 'expense' ? styles.expenseAmount : styles.incomeAmount]}>
                    {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}
                  </Text>
                  <View style={styles.transactionActions}>
                    <TouchableOpacity onPress={() => { setEditingTransaction(t); setEditAmount(t.amount.toString()); setEditDescription(t.description); setShowEditModal(true); }}>
                      <Edit size={16} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteTransaction(t)}>
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={showEditModal} animationType="slide" transparent={true} onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Transaction</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Amount</Text>
                <TextInput style={styles.input} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" editable={!loading} />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Description</Text>
                <TextInput style={[styles.input, styles.textArea]} value={editDescription} onChangeText={setEditDescription} multiline numberOfLines={3} editable={!loading} />
              </View>
              <TouchableOpacity style={[styles.submitButton, loading && styles.submitButtonDisabled]} onPress={handleUpdateTransaction} disabled={loading}>
                <Text style={styles.submitButtonText}>{loading ? 'Updating...' : 'Update'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 24, paddingTop: 60, paddingBottom: 16 },
  title: { fontSize: 32, fontWeight: '700', color: '#111827' },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  monthYear: { fontSize: 18, fontWeight: '600', color: '#111827' },
  weekDays: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 8 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#6B7280' },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 24 },
  dayCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', padding: 4 },
  dayCellActive: { backgroundColor: '#DBEAFE', borderRadius: 8 },
  dayNumber: { fontSize: 14, fontWeight: '600', color: '#111827' },
  transactionDots: { flexDirection: 'row', marginTop: 2, gap: 2 },
  expenseDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#EF4444' },
  incomeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#10B981' },
  transactionsList: { flex: 1, paddingHorizontal: 24, marginTop: 16 },
  transactionsTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 16 },
  summaryContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center' },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
  expenseTotal: { fontSize: 20, fontWeight: '700', color: '#EF4444' },
  incomeTotal: { fontSize: 20, fontWeight: '700', color: '#10B981' },
  noTransactions: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, marginTop: 20 },
  transactionCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  transactionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  transactionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  expenseIcon: { backgroundColor: '#EF4444' },
  incomeIcon: { backgroundColor: '#10B981' },
  transactionInfo: { marginLeft: 12, flex: 1 },
  transactionCategory: { fontSize: 16, fontWeight: '600', color: '#111827' },
  transactionPayment: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  transactionDescription: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  transactionRight: { alignItems: 'flex-end' },
  transactionAmount: { fontSize: 16, fontWeight: '700' },
  expenseAmount: { color: '#EF4444' },
  incomeAmount: { color: '#10B981' },
  transactionActions: { flexDirection: 'row', marginTop: 8, gap: 12 },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  modalForm: { paddingHorizontal: 24, paddingBottom: 32 },
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 16, color: '#111827' },
  textArea: { height: 80, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#3B82F6', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
