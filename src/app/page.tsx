'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Calendar, LayoutDashboard, Receipt, Users, ChevronDown, ChevronLeft, ChevronRight, Plus, Pencil, X, FileUp, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase'

// ============================================
// TYPES
// ============================================
type TeamMember = {
  id: string
  name: string
  role: string
  baseSalary: number
  compensation: Record<string, { variable: number; note: string }>
}

type Transaction = {
  id: string
  date: string
  description: string
  reference: string
  bank: string
  account: string
  type: 'income' | 'expense' | 'internal'
  category: string
  amount: number
  currency: string
  period?: string
}

// ============================================
// MONTHS CONFIG (sem dados fake)
// ============================================
const monthsConfig = [
  { month: 'January', short: 'Jan' },
  { month: 'February', short: 'Feb' },
  { month: 'March', short: 'Mar' },
  { month: 'April', short: 'Apr' },
  { month: 'May', short: 'May' },
  { month: 'June', short: 'Jun' },
  { month: 'July', short: 'Jul' },
  { month: 'August', short: 'Aug' },
  { month: 'September', short: 'Sep' },
  { month: 'October', short: 'Oct' },
  { month: 'November', short: 'Nov' },
  { month: 'December', short: 'Dec' },
]

// Current month index (0-11)
const currentMonthIndex = new Date().getMonth()
const currentYear = new Date().getFullYear()

// ============================================
// UTILITIES
// ============================================
const formatCurrency = (value: number, currency = 'USD') => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(value))

const roleColors: Record<string, string> = {
  'Developer': '#3b82f6',
  'Media Buyer': '#f59e0b',
  'Customer Support': '#10b981',
  'Video Editor': '#8b5cf6',
  'Designer': '#ec4899',
  'Operations': '#06b6d4',
}

// ============================================
// PERIOD SELECTOR COMPONENT
// ============================================
function PeriodSelector({ 
  selectedYear, 
  setSelectedYear, 
  selectedMonths, 
  setSelectedMonths 
}: {
  selectedYear: number
  setSelectedYear: (y: number) => void
  selectedMonths: number[]
  setSelectedMonths: (m: number[]) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isAllSelected = selectedMonths.length === 0

  const getDisplayText = () => {
    if (isAllSelected) return `${selectedYear} — All Year`
    if (selectedMonths.length === 1) return `${monthsConfig[selectedMonths[0]].month} ${selectedYear}`
    return `${selectedMonths.length} months`
  }

  const toggleMonth = (index: number) => {
    // Disable future months
    if (selectedYear === currentYear && index > currentMonthIndex) return
    if (selectedMonths.includes(index)) {
      setSelectedMonths(selectedMonths.filter(m => m !== index))
    } else {
      setSelectedMonths([...selectedMonths, index].sort((a, b) => a - b))
    }
  }

  const isMonthDisabled = (index: number) => {
    return selectedYear === currentYear && index > currentMonthIndex
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl px-4 py-2.5 transition-colors"
      >
        <Calendar className="w-5 h-5 text-zinc-400" />
        <span className="font-medium">{getDisplayText()}</span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Year</span>
              <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
                <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-1.5 hover:bg-zinc-700 rounded-md">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 font-semibold">{selectedYear}</span>
                <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-1.5 hover:bg-zinc-700 rounded-md">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-3 border-b border-zinc-800 flex flex-wrap gap-2">
              <button onClick={() => setSelectedMonths([])} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${isAllSelected ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>All Year</button>
              <button onClick={() => setSelectedMonths([0,1,2])} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700">Q1</button>
              <button onClick={() => setSelectedMonths([3,4,5])} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700">Q2</button>
              <button onClick={() => setSelectedMonths([6,7,8])} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700">Q3</button>
              <button onClick={() => setSelectedMonths([9,10,11])} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700">Q4</button>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2">
              {monthsConfig.map((month, index) => (
                <button
                  key={month.month}
                  onClick={() => toggleMonth(index)}
                  disabled={isMonthDisabled(index)}
                  className={`relative p-3 rounded-xl text-sm font-medium text-left transition-all ${
                    isMonthDisabled(index) ? 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed' :
                    selectedMonths.includes(index) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' :
                    'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-transparent'
                  }`}
                >
                  {index === currentMonthIndex && selectedYear === currentYear && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                  <span className="block">{month.short}</span>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-zinc-800">
              <button onClick={() => setIsOpen(false)} className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg">Apply</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================
// EMPTY STATE COMPONENT
// ============================================
function EmptyState({ icon: Icon, title, description, action, actionLabel }: { icon: React.ElementType; title: string; description: string; action?: () => void; actionLabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-zinc-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-zinc-500 text-center max-w-sm mb-6">{description}</p>
      {action && actionLabel && (
        <button onClick={action} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-6 py-2.5 rounded-xl transition-colors">
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// ============================================
// OVERVIEW TAB
// ============================================
function OverviewTab({ data, transactions, onUpload }: { data: { income: number; expenses: number; profit: number }; transactions: Transaction[]; onUpload: () => void }) {
  const margin = data.income > 0 ? ((data.profit / data.income) * 100).toFixed(1) : '0'
  const hasData = data.income > 0 || data.expenses > 0

  if (!hasData) {
    return (
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl">
        <EmptyState
          icon={FileUp}
          title="No financial data yet"
          description="Upload your first bank statement to start tracking your profits and expenses."
          action={onUpload}
          actionLabel="Upload Statement"
        />
      </div>
    )
  }

  // Group transactions by category for breakdown
  const expensesByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const cat = t.category || 'Other'
      acc[cat] = (acc[cat] || 0) + Math.abs(t.amount)
      return acc
    }, {} as Record<string, number>)

  const incomeByBank = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => {
      const bank = t.bank || 'Other'
      acc[bank] = (acc[bank] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {/* Main Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-2 bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/30 rounded-2xl p-6">
          <p className="text-emerald-400/80 text-sm font-medium mb-1">Total Profit</p>
          <p className="text-4xl font-bold">{formatCurrency(data.profit)}</p>
          <p className="text-emerald-400 text-sm mt-2">{margin}% margin</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-5">
          <p className="text-zinc-400 text-sm mb-2">Income</p>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(data.income)}</p>
          <p className="text-zinc-500 text-xs mt-1">{transactions.filter(t => t.type === 'income').length} transactions</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-5">
          <p className="text-zinc-400 text-sm mb-2">Expenses</p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(data.expenses)}</p>
          <p className="text-zinc-500 text-xs mt-1">{transactions.filter(t => t.type === 'expense').length} transactions</p>
        </div>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income by Bank */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Income by Source</h3>
          <div className="space-y-3">
            {Object.entries(incomeByBank)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([bank, amount]) => (
                <div key={bank} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-zinc-300">{bank}</span>
                  </div>
                  <span className="font-semibold text-emerald-400">{formatCurrency(amount)}</span>
                </div>
              ))}
            {Object.keys(incomeByBank).length === 0 && (
              <p className="text-zinc-500 text-sm">No income data</p>
            )}
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Expenses by Category</h3>
          <div className="space-y-3">
            {Object.entries(expensesByCategory)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-zinc-300">{category}</span>
                  </div>
                  <span className="font-semibold text-red-400">{formatCurrency(amount)}</span>
                </div>
              ))}
            {Object.keys(expensesByCategory).length === 0 && (
              <p className="text-zinc-500 text-sm">No expense data</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6">
        <h3 className="font-semibold mb-4">Recent Transactions</h3>
        <div className="space-y-2">
          {transactions.slice(0, 5).map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
              <div>
                <p className="font-medium">{tx.description}</p>
                <p className="text-zinc-500 text-xs">{tx.bank} • {tx.date}</p>
              </div>
              <span className={`font-semibold ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                {tx.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), tx.currency)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================
// TRANSACTIONS TAB
// ============================================
function TransactionsTab({ transactions, onUpload }: { transactions: Transaction[]; onUpload: () => void }) {
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0)

  if (transactions.length === 0) {
    return (
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl">
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Upload a bank statement to import your transactions and start tracking income and expenses."
          action={onUpload}
          actionLabel="Upload Statement"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <p className="text-emerald-400/70 text-sm">Income</p>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400/70 text-sm">Expenses</p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-sm">Net</p>
          <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(totalIncome - totalExpenses)}
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-400/70 text-sm">Transactions</p>
          <p className="text-2xl font-bold text-blue-400">{filtered.length}</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-zinc-600"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 focus:outline-none cursor-pointer"
        >
          <option value="all">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expenses</option>
          <option value="internal">Internal</option>
        </select>
      </div>
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left p-4 text-zinc-400 text-sm font-medium">Date</th>
                <th className="text-left p-4 text-zinc-400 text-sm font-medium">Description</th>
                <th className="text-left p-4 text-zinc-400 text-sm font-medium">Category</th>
                <th className="text-right p-4 text-zinc-400 text-sm font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-zinc-800/50">
                  <td className="p-4 text-sm">{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  <td className="p-4">
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-zinc-500 text-xs">{tx.bank} • {tx.account}</p>
                  </td>
                  <td className="p-4"><span className="text-zinc-400 text-sm">{tx.category}</span></td>
                  <td className={`p-4 text-right font-semibold ${tx.type === 'income' ? 'text-emerald-400' : tx.type === 'expense' ? 'text-red-400' : 'text-blue-400'}`}>
                    {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount, tx.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ============================================
// PAYROLL TAB
// ============================================
function PayrollTab({ teamMembers, currentMonth, onUpdateVariable, onAddMember }: { teamMembers: TeamMember[]; currentMonth: string; onUpdateVariable: (id: string, variable: number, note: string) => void; onAddMember: () => void }) {
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)

  const totals = teamMembers.reduce((acc, m) => {
    const comp = m.compensation[currentMonth] || { variable: 0 }
    return { base: acc.base + m.baseSalary, variable: acc.variable + comp.variable, total: acc.total + m.baseSalary + comp.variable }
  }, { base: 0, variable: 0, total: 0 })

  if (teamMembers.length === 0) {
    return (
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl">
        <EmptyState
          icon={UserPlus}
          title="No team members yet"
          description="Add your first team member to start tracking payroll and variable compensation."
          action={onAddMember}
          actionLabel="Add Team Member"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-purple-500/20 border border-purple-500/30 rounded-2xl p-5">
          <p className="text-purple-400/80 text-sm mb-1">Total Payroll</p>
          <p className="text-3xl font-bold">{formatCurrency(totals.total)}</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-5">
          <p className="text-zinc-400 text-sm mb-1">Base</p>
          <p className="text-2xl font-bold">{formatCurrency(totals.base)}</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
          <p className="text-amber-400/80 text-sm mb-1">Variable</p>
          <p className="text-2xl font-bold text-amber-400">{formatCurrency(totals.variable)}</p>
        </div>
      </div>
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
          <h3 className="font-semibold">Team — {currentMonth}</h3>
          <button onClick={onAddMember} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-3 py-1.5 rounded-lg text-sm transition-colors">
            <UserPlus className="w-4 h-4" />
            Add Member
          </button>
        </div>
        <div className="divide-y divide-zinc-800">
          {teamMembers.map((member) => {
            const comp = member.compensation[currentMonth] || { variable: 0, note: '' }
            const total = member.baseSalary + comp.variable
            return (
              <div key={member.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center font-medium text-sm">
                    {member.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                  </div>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: `${roleColors[member.role] || '#6b7280'}20`, color: roleColors[member.role] || '#6b7280' }}>{member.role}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right"><p className="text-zinc-500 text-xs">Base</p><p className="font-medium">{formatCurrency(member.baseSalary)}</p></div>
                  <div className="text-right min-w-[140px]">
                    <p className="text-zinc-500 text-xs mb-1">Variable</p>
                    <button
                      onClick={() => setEditingMember(member)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all ${comp.variable > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'}`}
                    >
                      {comp.variable > 0 ? <><span>+{formatCurrency(comp.variable)}</span><Pencil className="w-3.5 h-3.5 opacity-60" /></> : <><Plus className="w-4 h-4" /><span>Add</span></>}
                    </button>
                  </div>
                  <div className="text-right min-w-[80px]"><p className="text-zinc-500 text-xs">Total</p><p className="font-bold text-lg">{formatCurrency(total)}</p></div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="p-4 border-t border-zinc-700 bg-zinc-800/30 flex justify-between items-center">
          <span className="text-zinc-500">{teamMembers.length} members</span>
          <div className="flex items-center gap-6">
            <span className="text-zinc-400">{formatCurrency(totals.base)}</span>
            <span className="text-amber-400">{formatCurrency(totals.variable)}</span>
            <span className="font-bold text-xl pl-4 border-l border-zinc-700">{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </div>
      {editingMember && (
        <EditVariableModal
          member={editingMember}
          month={currentMonth}
          currentValue={editingMember.compensation[currentMonth]?.variable || 0}
          currentNote={editingMember.compensation[currentMonth]?.note || ''}
          onSave={(variable, note) => { onUpdateVariable(editingMember.id, variable, note); setEditingMember(null) }}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  )
}

// ============================================
// EDIT VARIABLE MODAL
// ============================================
function EditVariableModal({ member, month, currentValue, currentNote, onSave, onClose }: { member: TeamMember; month: string; currentValue: number; currentNote: string; onSave: (variable: number, note: string) => void; onClose: () => void }) {
  const [amount, setAmount] = useState(currentValue.toString())
  const [note, setNote] = useState(currentNote)
  const total = member.baseSalary + (parseFloat(amount) || 0)

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div><p className="font-semibold">{member.name}</p><p className="text-zinc-500 text-sm">{month}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5 text-zinc-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex justify-between py-3 border-b border-zinc-800"><span className="text-zinc-400">Base (fixo)</span><span className="font-semibold">{formatCurrency(member.baseSalary)}</span></div>
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Variável do mês</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-3 text-xl font-bold focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Observação</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: Comissão, bônus..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-zinc-600" />
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex justify-between items-center">
            <span className="text-emerald-400">Total</span>
            <span className="text-emerald-400 font-bold text-2xl">{formatCurrency(total)}</span>
          </div>
        </div>
        <div className="p-5 border-t border-zinc-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium">Cancelar</button>
          <button onClick={() => onSave(parseFloat(amount) || 0, note)} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl">Salvar</button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN DASHBOARD
// ============================================
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'payroll'>('overview')
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonths, setSelectedMonths] = useState<number[]>([currentMonthIndex])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)

  // Month names
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const currentMonthStr = `${monthNamesShort[currentMonthIndex]} ${currentYear}`

  // Filter transactions by selected period
  const filteredTransactions = transactions.filter(tx => {
    if (!tx.period) return true
    
    if (selectedMonths.length === 0) {
      // All year - show all from selected year
      return tx.period.includes(String(selectedYear))
    }
    
    // Filter by selected months
    return selectedMonths.some(monthIdx => {
      const periodStr = `${monthNamesShort[monthIdx]} ${selectedYear}`
      return tx.period === periodStr
    })
  })

  // Calculate aggregated data from FILTERED transactions
  const aggregatedData = filteredTransactions.reduce((acc, t) => {
    if (t.type === 'income') {
      return { ...acc, income: acc.income + t.amount }
    } else if (t.type === 'expense') {
      return { ...acc, expenses: acc.expenses + Math.abs(t.amount) }
    }
    return acc
  }, { income: 0, expenses: 0, profit: 0 })
  aggregatedData.profit = aggregatedData.income - aggregatedData.expenses

  const getPeriodLabel = () => {
    if (selectedMonths.length === 0) return `${selectedYear} Overview`
    if (selectedMonths.length === 1) return `${monthsConfig[selectedMonths[0]].month} ${selectedYear}`
    return `${selectedMonths.length} Months Selected`
  }

  // Payroll month based on selection
  const getPayrollMonth = () => {
    if (selectedMonths.length === 1) {
      return `${monthNamesShort[selectedMonths[0]]} ${selectedYear}`
    }
    return currentMonthStr
  }

  const handleUpdateVariable = (id: string, variable: number, note: string) => {
    const month = getPayrollMonth()
    setTeamMembers(prev => prev.map(m => m.id !== id ? m : { ...m, compensation: { ...m.compensation, [month]: { variable, note } } }))
  }

  const handleAddMember = (name: string, role: string, baseSalary: number) => {
    const newMember: TeamMember = {
      id: crypto.randomUUID(),
      name,
      role,
      baseSalary,
      compensation: {}
    }
    setTeamMembers(prev => [...prev, newMember])
    setShowAddMemberModal(false)
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions' as const, label: 'Transactions', icon: Receipt },
    { id: 'payroll' as const, label: 'Payroll', icon: Users },
  ]

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />
      <div className="relative z-10">
        <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center font-bold text-xl">Z</div>
              <span className="text-xl font-bold">Zoop Finance</span>
            </div>
            <div className="flex items-center gap-3">
              <PeriodSelector selectedYear={selectedYear} setSelectedYear={setSelectedYear} selectedMonths={selectedMonths} setSelectedMonths={setSelectedMonths} />
              <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-4 py-2.5 rounded-xl transition-colors">
                <Upload className="w-5 h-5" />Upload
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{getPeriodLabel()}</h1>
              <p className="text-zinc-500 mt-1">
                {filteredTransactions.length > 0 
                  ? `${filteredTransactions.length} transactions • ${formatCurrency(aggregatedData.profit)} profit`
                  : 'No data for this period'
                }
              </p>
            </div>
            <div className="flex items-center bg-zinc-800 rounded-xl p-1">
              {tabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-white'}`}>
                  <tab.icon className="w-4 h-4" />{tab.label}
                </button>
              ))}
            </div>
          </div>
          {activeTab === 'overview' && <OverviewTab data={aggregatedData} transactions={filteredTransactions} onUpload={() => setShowUploadModal(true)} />}
          {activeTab === 'transactions' && <TransactionsTab transactions={filteredTransactions} onUpload={() => setShowUploadModal(true)} />}
          {activeTab === 'payroll' && <PayrollTab teamMembers={teamMembers} currentMonth={getPayrollMonth()} onUpdateVariable={handleUpdateVariable} onAddMember={() => setShowAddMemberModal(true)} />}
        </main>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal onClose={() => setShowUploadModal(false)} onUploadComplete={(txs, period) => { 
          // Add period to each transaction
          const txsWithPeriod = txs.map(tx => ({ ...tx, period }))
          setTransactions(prev => [...prev, ...txsWithPeriod])
          setShowUploadModal(false) 
        }} />
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <AddMemberModal onSave={handleAddMember} onClose={() => setShowAddMemberModal(false)} />
      )}
    </div>
  )
}

// ============================================
// UPLOAD MODAL
// ============================================
function UploadModal({ onClose, onUploadComplete }: { onClose: () => void; onUploadComplete: (transactions: Transaction[], period: string) => void }) {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Period selection
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIndex)
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'))
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles])
      setError(null)
    } else {
      setError('Please upload CSV files')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles])
      setError(null)
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const parseCSVContent = (text: string, fileName: string): Transaction[] => {
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length < 2) return []
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const transactions: Transaction[] = []
    
    // Detect bank from headers
    const isRevolut = headers.includes('type') && (headers.includes('completed date') || headers.includes('started date'))
    const isRelay = headers.includes('date') && headers.includes('amount') && headers.includes('description')

    for (let i = 1; i < lines.length; i++) {
      // Handle CSV with quoted values containing commas
      const values: string[] = []
      let current = ''
      let inQuotes = false
      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/"/g, ''))
          current = ''
        } else {
          current += char
        }
      }
      values.push(current.trim().replace(/"/g, ''))
      
      if (values.length < 3) continue

      let tx: Transaction | null = null

      if (isRevolut) {
        const dateIdx = headers.indexOf('completed date') !== -1 ? headers.indexOf('completed date') : headers.indexOf('started date')
        const descIdx = headers.indexOf('description')
        const amountIdx = headers.indexOf('amount')
        const currencyIdx = headers.indexOf('currency')
        
        const amount = parseFloat(values[amountIdx]) || 0
        if (amount === 0) continue
        
        tx = {
          id: crypto.randomUUID(),
          date: values[dateIdx]?.split(' ')[0] || new Date().toISOString().split('T')[0],
          description: values[descIdx] || 'Unknown',
          reference: '',
          bank: 'Revolut',
          account: values[currencyIdx] || 'USD',
          type: amount > 0 ? 'income' : 'expense',
          category: 'Uncategorized',
          amount: amount,
          currency: values[currencyIdx] || 'USD'
        }
      } else if (isRelay) {
        const dateIdx = headers.indexOf('date')
        const descIdx = headers.indexOf('description')
        const amountIdx = headers.indexOf('amount')
        
        const amount = parseFloat(values[amountIdx]?.replace(/[^0-9.-]/g, '')) || 0
        if (amount === 0) continue
        
        tx = {
          id: crypto.randomUUID(),
          date: values[dateIdx] || new Date().toISOString().split('T')[0],
          description: values[descIdx] || 'Unknown',
          reference: '',
          bank: 'Relay',
          account: 'Main',
          type: amount > 0 ? 'income' : 'expense',
          category: 'Uncategorized',
          amount: amount,
          currency: 'USD'
        }
      } else {
        // Generic format
        const dateIdx = headers.findIndex(h => h.includes('date'))
        const descIdx = headers.findIndex(h => h.includes('description') || h.includes('memo') || h.includes('name'))
        const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('value'))
        
        const amount = parseFloat(values[amountIdx >= 0 ? amountIdx : 1]?.replace(/[^0-9.-]/g, '')) || 0
        if (amount === 0) continue
        
        tx = {
          id: crypto.randomUUID(),
          date: values[dateIdx >= 0 ? dateIdx : 0] || new Date().toISOString().split('T')[0],
          description: values[descIdx >= 0 ? descIdx : 1] || 'Unknown',
          reference: '',
          bank: fileName.toLowerCase().includes('revolut') ? 'Revolut' : fileName.toLowerCase().includes('relay') ? 'Relay' : 'Imported',
          account: 'Main',
          type: amount > 0 ? 'income' : 'expense',
          category: 'Uncategorized',
          amount: amount,
          currency: 'USD'
        }
      }

      if (tx) {
        transactions.push(tx)
      }
    }

    return transactions
  }

  const processFiles = async () => {
    if (files.length === 0) return
    setParsing(true)
    setError(null)
    
    const allTransactions: Transaction[] = []
    const period = `${monthNames[selectedMonth].slice(0, 3)} ${selectedYear}`

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setProgress(`Processing ${i + 1}/${files.length}: ${file.name}`)

        if (file.name.endsWith('.csv')) {
          const text = await file.text()
          const txs = parseCSVContent(text, file.name)
          allTransactions.push(...txs)
        }
      }

      if (allTransactions.length === 0) {
        setError('No valid transactions found in the uploaded files')
        setParsing(false)
        setProgress('')
        return
      }

      setProgress(`Imported ${allTransactions.length} transactions for ${period}!`)
      setTimeout(() => {
        onUploadComplete(allTransactions, period)
      }, 500)
    } catch (err) {
      console.error(err)
      setError('Error processing files. Please check the format.')
      setParsing(false)
      setProgress('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Upload Statements</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5 text-zinc-400" /></button>
        </div>
        
        <div className="p-5 space-y-4">
          {/* Period Selector */}
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Statement Period</label>
            <div className="flex gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {monthNames.map((month, idx) => (
                  <option key={month} value={idx}>{month}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-24 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {[2023, 2024, 2025, 2026].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
              isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-700 hover:border-zinc-600'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <FileUp className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <p className="text-zinc-400 mb-1">Drag & drop your bank statements</p>
            <p className="text-zinc-600 text-sm mb-3">CSV files • Multiple files supported</p>
            <button 
              type="button"
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Browse Files
            </button>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((file, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-zinc-800 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <FileUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-zinc-500 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={() => removeFile(index)} className="p-1.5 hover:bg-zinc-700 rounded-lg flex-shrink-0">
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Progress */}
          {progress && !error && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
              {progress}
            </div>
          )}

          {/* Import Button */}
          {files.length > 0 && (
            <button
              onClick={processFiles}
              disabled={parsing}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 text-black font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {parsing ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                `Import to ${monthNames[selectedMonth].slice(0, 3)} ${selectedYear}`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// ADD MEMBER MODAL
// ============================================
function AddMemberModal({ onSave, onClose }: { onSave: (name: string, role: string, baseSalary: number) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [baseSalary, setBaseSalary] = useState('')

  const handleSave = () => {
    if (!name || !role || !baseSalary) return
    onSave(name, role, parseFloat(baseSalary))
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold">Add Team Member</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5 text-zinc-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Role</label>
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Developer, Media Buyer..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Base Salary (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
              <input type="number" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} placeholder="0" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-zinc-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium">Cancel</button>
          <button onClick={handleSave} disabled={!name || !role || !baseSalary} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-semibold rounded-xl transition-colors">Add Member</button>
        </div>
      </div>
    </div>
  )
}
