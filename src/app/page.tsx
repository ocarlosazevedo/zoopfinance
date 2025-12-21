'use client'

import { useState, useEffect } from 'react'
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
function OverviewTab({ data, onUpload }: { data: { income: number; expenses: number; profit: number }; onUpload: () => void }) {
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-2 bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/30 rounded-2xl p-6">
          <p className="text-emerald-400/80 text-sm font-medium mb-1">Total Profit</p>
          <p className="text-4xl font-bold">{formatCurrency(data.profit)}</p>
          <p className="text-emerald-400 text-sm mt-2">+{margin}% margin</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-5">
          <p className="text-zinc-400 text-sm mb-2">Income</p>
          <p className="text-2xl font-bold">{formatCurrency(data.income)}</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-5">
          <p className="text-zinc-400 text-sm mb-2">Expenses</p>
          <p className="text-2xl font-bold">{formatCurrency(data.expenses)}</p>
        </div>
      </div>
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6">
        <h3 className="font-semibold mb-4">Financial Trend</h3>
        <div className="h-64 flex items-center justify-center text-zinc-500">
          Chart will be rendered here with Recharts
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
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)

  // Format current month string
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const currentMonthStr = `${monthNames[currentMonthIndex]} ${currentYear}`

  // Calculate aggregated data from transactions
  const aggregatedData = transactions.reduce((acc, t) => {
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

  const handleUpdateVariable = (id: string, variable: number, note: string) => {
    setTeamMembers(prev => prev.map(m => m.id !== id ? m : { ...m, compensation: { ...m.compensation, [currentMonthStr]: { variable, note } } }))
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
            <div><h1 className="text-2xl font-bold">{getPeriodLabel()}</h1><p className="text-zinc-500 mt-1">Financial summary</p></div>
            <div className="flex items-center bg-zinc-800 rounded-xl p-1">
              {tabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-white'}`}>
                  <tab.icon className="w-4 h-4" />{tab.label}
                </button>
              ))}
            </div>
          </div>
          {activeTab === 'overview' && <OverviewTab data={aggregatedData} onUpload={() => setShowUploadModal(true)} />}
          {activeTab === 'transactions' && <TransactionsTab transactions={transactions} onUpload={() => setShowUploadModal(true)} />}
          {activeTab === 'payroll' && <PayrollTab teamMembers={teamMembers} currentMonth={currentMonthStr} onUpdateVariable={handleUpdateVariable} onAddMember={() => setShowAddMemberModal(true)} />}
        </main>
      </div>

      {/* Upload Modal Placeholder */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Upload Statement</h3>
              <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5 text-zinc-400" /></button>
            </div>
            <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center">
              <FileUp className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
              <p className="text-zinc-400 mb-2">Drag & drop your bank statement</p>
              <p className="text-zinc-600 text-sm mb-4">Supports: CSV from Revolut, Relay</p>
              <button className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium px-4 py-2 rounded-lg">Browse Files</button>
            </div>
            <p className="text-zinc-600 text-xs text-center mt-4">Coming soon: automatic parsing</p>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <AddMemberModal onSave={handleAddMember} onClose={() => setShowAddMemberModal(false)} />
      )}
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
