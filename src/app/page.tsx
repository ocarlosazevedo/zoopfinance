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
  beneficiaryAccount?: string // Account number for auto-matching payments
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
  amount: number           // Always in USD
  currency: string         // Always USD (display currency)
  originalAmount?: number  // Original amount before conversion
  originalCurrency?: string // Original currency (EUR, GBP, BRL, etc)
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

// Exchange rates cache
let exchangeRatesCache: { rates: Record<string, number>; timestamp: number } | null = null
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

async function getExchangeRates(): Promise<Record<string, number>> {
  // Return cached rates if fresh
  if (exchangeRatesCache && Date.now() - exchangeRatesCache.timestamp < CACHE_DURATION) {
    return exchangeRatesCache.rates
  }
  
  try {
    // Free API - rates relative to USD
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    const data = await response.json()
    
    // Cache the rates
    exchangeRatesCache = {
      rates: data.rates,
      timestamp: Date.now()
    }
    
    return data.rates
  } catch (error) {
    console.error('Error fetching exchange rates:', error)
    // Fallback rates if API fails
    return {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      BRL: 6.10,
      CAD: 1.44,
      AUD: 1.60,
    }
  }
}

function convertToUSD(amount: number, fromCurrency: string, rates: Record<string, number>): number {
  if (fromCurrency === 'USD' || !fromCurrency) return amount
  
  const rate = rates[fromCurrency]
  if (!rate) {
    console.warn(`Unknown currency: ${fromCurrency}, keeping original amount`)
    return amount
  }
  
  // rates are relative to USD, so divide to convert to USD
  return amount / rate
}

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
              <div className="text-right">
                <span className={`font-semibold ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                </span>
                {tx.originalCurrency && (
                  <p className="text-zinc-500 text-xs">
                    {tx.originalAmount && tx.originalAmount < 0 ? '' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: tx.originalCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(tx.originalAmount || 0))}
                  </p>
                )}
              </div>
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
  const [statements, setStatements] = useState<{ id: string; filename: string; bank: string; period: string; transactions_count: number; created_at: string }[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [showManageDataModal, setShowManageDataModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  // Month names
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const currentMonthStr = `${monthNamesShort[currentMonthIndex]} ${currentYear}`

  // Load data from Supabase on mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load ALL transactions with pagination
      let allTransactions: any[] = []
      const pageSize = 500
      let from = 0
      let keepGoing = true
      
      while (keepGoing) {
        const to = from + pageSize - 1
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .order('date', { ascending: false })
          .range(from, to)
        
        if (txError) {
          console.error('Error loading transactions page:', txError)
          keepGoing = false
        } else if (txData && txData.length > 0) {
          allTransactions = [...allTransactions, ...txData]
          from += pageSize
          // Continue if we got a full page
          keepGoing = txData.length === pageSize
        } else {
          keepGoing = false
        }
      }
      
      console.log(`Loaded ${allTransactions.length} transactions total`)
      
      if (allTransactions.length > 0) {
        setTransactions(allTransactions.map(tx => ({
          id: tx.id,
          date: tx.date,
          description: tx.description,
          reference: tx.reference || '',
          bank: tx.bank,
          account: tx.account || '',
          type: tx.type as 'income' | 'expense' | 'internal',
          category: tx.category || 'Other',
          amount: parseFloat(tx.amount),
          currency: tx.currency || 'USD',
          originalAmount: tx.original_amount ? parseFloat(tx.original_amount) : undefined,
          originalCurrency: tx.original_currency || undefined,
          period: tx.period
        })))
      }

      // Load statements
      const { data: stmtData, error: stmtError } = await supabase
        .from('statements')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (stmtError) {
        console.error('Error loading statements:', stmtError)
      } else if (stmtData) {
        setStatements(stmtData as any[])
      }

      // Load team members
      const { data: teamData, error: teamError } = await supabase
        .from('team_members')
        .select('*')
      
      if (!teamError && teamData) {
        // Load compensation for each member
        const { data: compData } = await supabase.from('compensation').select('*')
        
        setTeamMembers((teamData as any[]).map(m => {
          const memberComp = (compData as any[] || []).filter(c => c.member_id === m.id)
          const compensation: Record<string, { variable: number; note: string }> = {}
          memberComp.forEach(c => {
            compensation[c.period] = { variable: parseFloat(c.variable_amount), note: c.note || '' }
          })
          return {
            id: m.id,
            name: m.name,
            role: m.role,
            baseSalary: parseFloat(m.base_salary),
            beneficiaryAccount: m.beneficiary_account || undefined,
            compensation
          }
        }))
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Save transactions to Supabase
  const saveTransactions = async (newTransactions: Transaction[], period: string, filename: string, bank: string) => {
    setSaving(true)
    try {
      // Insert transactions
      const txToInsert = newTransactions.map(tx => ({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        reference: tx.reference,
        bank: tx.bank,
        account: tx.account,
        type: tx.type,
        category: tx.category,
        amount: tx.amount,
        currency: tx.currency,
        original_amount: tx.originalAmount || null,
        original_currency: tx.originalCurrency || null,
        period: tx.period || period
      }))

      const { error: txError } = await supabase
        .from('transactions')
        .insert(txToInsert as any)

      if (txError) {
        console.error('Error saving transactions:', txError)
        throw txError
      }

      // Record the statement
      const { error: stmtError } = await supabase
        .from('statements')
        .insert({
          filename,
          bank,
          period,
          transactions_count: newTransactions.length
        } as any)

      if (stmtError) {
        console.error('Error saving statement:', stmtError)
      }

      // Reload data
      await loadData()
      return true
    } catch (err) {
      console.error('Error saving:', err)
      return false
    } finally {
      setSaving(false)
    }
  }

  // Delete transactions by period
  const deleteByPeriod = async (period: string) => {
    try {
      const { error: txError } = await supabase
        .from('transactions')
        .delete()
        .eq('period', period)

      if (txError) throw txError

      const { error: stmtError } = await supabase
        .from('statements')
        .delete()
        .eq('period', period)

      if (stmtError) throw stmtError

      await loadData()
      return true
    } catch (err) {
      console.error('Error deleting:', err)
      return false
    }
  }

  // Delete all data
  const deleteAllData = async () => {
    try {
      await supabase.from('transactions').delete().neq('id', '')
      await supabase.from('statements').delete().neq('id', '')
      await loadData()
      return true
    } catch (err) {
      console.error('Error deleting all:', err)
      return false
    }
  }

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

  const handleAddMember = async (name: string, role: string, baseSalary: number, beneficiaryAccount?: string) => {
    const newMember: TeamMember = {
      id: crypto.randomUUID(),
      name,
      role,
      baseSalary,
      beneficiaryAccount,
      compensation: {}
    }
    
    // Save to Supabase
    const { error } = await supabase
      .from('team_members')
      .insert({
        id: newMember.id,
        name,
        role,
        base_salary: baseSalary,
        beneficiary_account: beneficiaryAccount || null
      } as any)
    
    if (error) {
      console.error('Error saving team member:', error)
    } else {
      setTeamMembers(prev => [...prev, newMember])
    }
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
              {(loading || saving) && (
                <div className="flex items-center gap-2 text-zinc-500 text-sm">
                  <div className="w-4 h-4 border-2 border-zinc-600 border-t-emerald-500 rounded-full animate-spin" />
                  {saving ? 'Saving...' : 'Loading...'}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowManageDataModal(true)} 
                className="text-zinc-400 hover:text-white px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-sm"
              >
                Manage Data
              </button>
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
        <UploadModal 
          onClose={() => setShowUploadModal(false)} 
          teamMembers={teamMembers}
          onUploadComplete={async (txs, period, files) => { 
            // Add period to each transaction
            const txsWithPeriod = txs.map(tx => ({ ...tx, period }))
            
            // Save to Supabase
            const filename = files.map(f => f.name).join(', ')
            const bank = txs[0]?.bank || 'Imported'
            const success = await saveTransactions(txsWithPeriod, period, filename, bank)
            
            if (success) {
              setShowUploadModal(false) 
            }
          }} 
        />
      )}

      {/* Manage Data Modal */}
      {showManageDataModal && (
        <ManageDataModal 
          statements={statements}
          onDeletePeriod={deleteByPeriod}
          onDeleteAll={deleteAllData}
          onClose={() => setShowManageDataModal(false)}
        />
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <AddMemberModal onSave={handleAddMember} onClose={() => setShowAddMemberModal(false)} />
      )}
    </div>
  )
}

// ============================================
// LOCAL CSV PARSER - INSTANTÂNEO
// ============================================
const categoryRules: { pattern: RegExp; category: string }[] = [
  // Advertising - PRIORITY (most common)
  { pattern: /facebook|meta ads|meta_ads|fb ads/i, category: 'Ads' },
  { pattern: /google ads|googleads|dl\*google|dl \*google/i, category: 'Ads' },
  { pattern: /tiktok|snapchat|pinterest ads|twitter ads|linkedin ads/i, category: 'Ads' },
  { pattern: /adspower/i, category: 'Ads' },
  // Sales / Revenue
  { pattern: /shopify|stripe payout|paypal payout|amazon payout|etsy|ebay deposit/i, category: 'Sales' },
  { pattern: /block craft|dinheiro adicionado/i, category: 'Sales' },  // Revolut topups from business
  // Software / SaaS
  { pattern: /notion|slack|zoom|github|vercel|aws|google cloud|heroku|digitalocean/i, category: 'Software' },
  { pattern: /openai|anthropic|zapier|airtable|figma|canva|adobe|microsoft|dropbox|1password/i, category: 'Software' },
  { pattern: /stape|tracking|pixel|analytics/i, category: 'Software' },
  { pattern: /pagouai|pagou ai/i, category: 'Software' },
  { pattern: /hostinger|namecheap|godaddy|cloudflare/i, category: 'Software' },
  // Payroll
  { pattern: /payroll|salary|gusto|deel|remote\.com|wise transfer|contractor|employee/i, category: 'Payroll' },
  // Shipping / Logistics
  { pattern: /fedex|ups|usps|dhl|shipstation|shippo|easypost|fulfillment|shipping|postage/i, category: 'Shipping' },
  // Fees
  { pattern: /\bfee\b|charge|interest|penalty|overdraft|wire fee|monthly service/i, category: 'Fees' },
  // Transfers - Internal (only actual bank accounts)
  { pattern: /^(business savings|business checking|savings account|checking account)$/i, category: 'Transfer' },
  { pattern: /^(para main|de main|from main|to main)$/i, category: 'Transfer' },
  // Refunds
  { pattern: /refund|chargeback|dispute|reversal|return/i, category: 'Refunds' },
  // Office / Operations
  { pattern: /chaveiro|office|supplies|equipment/i, category: 'Operations' },
]

function detectCategory(description: string, payee?: string): string {
  // Check payee first (more reliable for Relay)
  const textToCheck = `${payee || ''} ${description || ''}`.toLowerCase()
  
  for (const rule of categoryRules) {
    if (rule.pattern.test(textToCheck)) {
      return rule.category
    }
  }
  return 'Other'
}

function cleanDescription(desc: string, payee?: string): string {
  // For Relay: use Payee as main description if Description is "Unknown"
  let text = desc
  if (!desc || desc.toLowerCase() === 'unknown' || desc.trim() === '') {
    text = payee || 'Transaction'
  }
  
  if (!text) return 'Transaction'
  
  // Remove ALL CAPS, clean up
  let cleaned = text.trim()
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = cleaned.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  }
  // Remove common prefixes
  cleaned = cleaned.replace(/^(payment to|payment from|direct debit|card payment|pos|purchase)\s*/i, '')
  return cleaned.substring(0, 80) || 'Transaction'
}

// Conta do Relay para marcar como internal automaticamente
const RELAY_ACCOUNT = '200000805781'

function parseCSVLocally(csvContent: string, fileName: string, teamMembers: TeamMember[] = [], exchangeRates: Record<string, number> = {}): Transaction[] {
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []
  
  // Parse header
  const headerLine = lines[0]
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim())
  
  // Detect bank format
  const isRelay = headers.includes('payee') && headers.includes('transaction type')
  const isRevolut = headers.some(h => h.includes('date started') || h.includes('date completed')) && headers.includes('type')
  const isMercury = headers.includes('bank description')
  
  const transactions: Transaction[] = []
  const bankName = isRelay ? 'Relay' : isRevolut ? 'Revolut' : isMercury ? 'Mercury' : 'Imported'
  
  // Get column indices based on format
  if (isRelay) {
    // Relay format: Date,Payee,Account #,Transaction Type,Description,Reference,Status,Amount,Currency,Balance
    const dateIdx = headers.indexOf('date')
    const payeeIdx = headers.indexOf('payee')
    const txTypeIdx = headers.indexOf('transaction type')
    const descIdx = headers.indexOf('description')
    const refIdx = headers.indexOf('reference')
    const amountIdx = headers.indexOf('amount')
    const currencyIdx = headers.indexOf('currency')
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length < 2) continue
      
      const amountStr = values[amountIdx] || '0'
      const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0
      if (amount === 0) continue
      
      const payee = values[payeeIdx] || ''
      const txType = values[txTypeIdx] || ''
      const rawDesc = values[descIdx] || ''
      const reference = values[refIdx] || ''
      
      // Description: use payee if description is "Unknown"
      const description = cleanDescription(rawDesc, payee)
      
      // Type and Category based on Transaction Type column
      let type: 'income' | 'expense' | 'internal'
      let category: string
      const txTypeLower = txType.toLowerCase()
      
      // Check if payee indicates transfer from another bank (Revolut → Relay)
      const isFromOtherBank = /^(revolut|relay)$/i.test(payee)
      
      if (txTypeLower === 'spend') {
        type = 'expense'
        category = detectCategory(rawDesc, payee)  // Category by Payee (Facebook→Ads, etc)
      } else if (txTypeLower === 'receive') {
        if (isFromOtherBank) {
          // Money coming from Revolut or between Relay accounts = internal
          type = 'internal'
          category = 'Transfer'
        } else {
          // Real income from external sources (Cartpanda, Shopify, etc)
          type = 'income'
          category = 'Sales'
        }
      } else if (txTypeLower.includes('transfer')) {
        type = 'internal'
        category = 'Transfer'  // All transfers are internal
      } else {
        type = amount > 0 ? 'income' : 'expense'
        category = type === 'income' ? 'Sales' : detectCategory(rawDesc, payee)
      }
      
      const date = parseDate(values[dateIdx] || '')
      const originalCurrency = values[currencyIdx] || 'USD'
      
      // Convert to USD
      const amountInUSD = convertToUSD(amount, originalCurrency, exchangeRates)
      
      transactions.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`,
        date,
        description,
        reference: reference || rawDesc,
        bank: bankName,
        account: originalCurrency,
        type,
        category,
        amount: amountInUSD,
        currency: 'USD',
        originalAmount: originalCurrency !== 'USD' ? amount : undefined,
        originalCurrency: originalCurrency !== 'USD' ? originalCurrency : undefined
      })
    }
  } else if (isRevolut) {
    // Revolut format: Date started,Date completed,ID,Type,State,Description,Reference,...,Amount,...,Beneficiary account number,...
    const dateIdx = headers.findIndex(h => h.includes('date completed') || h.includes('date started'))
    const typeIdx = headers.indexOf('type')
    const descIdx = headers.indexOf('description')
    const amountIdx = headers.indexOf('amount')
    const currencyIdx = headers.indexOf('payment currency') !== -1 ? headers.indexOf('payment currency') : headers.indexOf('currency')
    const beneficiaryIdx = headers.indexOf('beneficiary account number')
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length < 5) continue
      
      const amountStr = values[amountIdx] || '0'
      const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0
      if (amount === 0) continue
      
      const revolut_type = (values[typeIdx] || '').toUpperCase()
      const rawDesc = values[descIdx] || ''
      const beneficiaryAccount = beneficiaryIdx >= 0 ? values[beneficiaryIdx]?.trim() : ''
      
      const description = cleanDescription(rawDesc, '')
      let category = detectCategory(rawDesc, '')
      
      // Type based on Revolut transaction type
      let type: 'income' | 'expense' | 'internal'
      
      if (revolut_type === 'CARD_PAYMENT' || revolut_type === 'FEE') {
        type = 'expense'
        if (revolut_type === 'FEE') category = 'Fees'
      } else if (revolut_type === 'TOPUP') {
        type = 'income'
        category = 'Sales'  // TOPUPs são faturamento real
      } else if (revolut_type === 'REFUND' || revolut_type === 'CARD_REFUND') {
        type = 'income'
        category = 'Refunds'
      } else if (revolut_type === 'EXCHANGE') {
        type = 'internal'
        category = 'Transfer'
      } else if (revolut_type === 'TRANSFER') {
        // TRANSFER logic:
        // - No beneficiary = internal (moving between Revolut accounts)
        // - Beneficiary = RELAY_ACCOUNT = internal (sending to own Relay)
        // - Beneficiary in teamMembers = expense/Payroll
        // - Other beneficiary = expense/Other
        
        if (!beneficiaryAccount) {
          // No beneficiary = internal transfer between Revolut accounts
          type = 'internal'
          category = 'Transfer'
        } else if (beneficiaryAccount === RELAY_ACCOUNT) {
          // Sending to own Relay account
          type = 'internal'
          category = 'Transfer'
        } else {
          // Has beneficiary - check if it's a team member
          const matchedMember = teamMembers.find(m => m.beneficiaryAccount === beneficiaryAccount)
          if (matchedMember) {
            type = 'expense'
            category = 'Payroll'
          } else {
            type = 'expense'
            category = 'Other'
          }
        }
      } else {
        type = amount > 0 ? 'income' : 'expense'
      }
      
      const date = parseDate(values[dateIdx] || '')
      const originalCurrency = values[currencyIdx] || 'USD'
      
      // Convert to USD
      const amountInUSD = convertToUSD(amount, originalCurrency, exchangeRates)
      
      transactions.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`,
        date,
        description,
        reference: rawDesc,
        bank: bankName,
        account: originalCurrency,
        type,
        category,
        amount: amountInUSD,
        currency: 'USD',
        originalAmount: originalCurrency !== 'USD' ? amount : undefined,
        originalCurrency: originalCurrency !== 'USD' ? originalCurrency : undefined
      })
    }
  } else {
    // Generic CSV format
    let dateIdx = headers.findIndex(h => h.includes('date'))
    let descIdx = headers.findIndex(h => h.includes('description') || h.includes('memo'))
    let amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('value'))
    let currencyIdx = headers.findIndex(h => h.includes('currency'))
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length < 2) continue
      
      const amountStr = values[amountIdx >= 0 ? amountIdx : 2] || '0'
      const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0
      if (amount === 0) continue
      
      const rawDesc = values[descIdx >= 0 ? descIdx : 1] || ''
      const description = cleanDescription(rawDesc, '')
      const category = detectCategory(rawDesc, '')
      
      const date = parseDate(values[dateIdx >= 0 ? dateIdx : 0] || '')
      const originalCurrency = values[currencyIdx] || 'USD'
      
      // Convert to USD
      const amountInUSD = convertToUSD(amount, originalCurrency, exchangeRates)
      
      transactions.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`,
        date,
        description,
        reference: rawDesc,
        bank: bankName,
        account: originalCurrency,
        type: amount > 0 ? 'income' : 'expense',
        category,
        amount: amountInUSD,
        currency: 'USD',
        originalAmount: originalCurrency !== 'USD' ? amount : undefined,
        originalCurrency: originalCurrency !== 'USD' ? originalCurrency : undefined
      })
    }
  }
  
  return transactions
}

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ''))
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim().replace(/^"|"$/g, ''))
  
  return values
}

function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0]
  
  // Try various formats
  const cleaned = dateStr.trim().split(' ')[0] // Remove time part
  
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned
  
  // MM/DD/YYYY or DD/MM/YYYY
  const parts = cleaned.split(/[\/\-]/)
  if (parts.length === 3) {
    const [a, b, c] = parts.map(p => parseInt(p))
    if (c > 1000) {
      // MM/DD/YYYY or DD/MM/YYYY
      if (a > 12) {
        return `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`
      }
      return `${c}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
    }
    if (a > 1000) {
      return `${a}-${String(b).padStart(2, '0')}-${String(c).padStart(2, '0')}`
    }
  }
  
  // Try native parsing
  const parsed = new Date(dateStr)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }
  
  return new Date().toISOString().split('T')[0]
}

// ============================================
// UPLOAD MODAL - INSTANTÂNEO
// ============================================
function UploadModal({ onClose, onUploadComplete, teamMembers }: { onClose: () => void; onUploadComplete: (transactions: Transaction[], period: string, files: File[]) => void; teamMembers: TeamMember[] }) {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<{ transactions: Transaction[]; summary: any } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Period selection
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIndex)
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
      setAnalysisResult(null)
    } else {
      setError('Please upload CSV files')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles])
      setError(null)
      setAnalysisResult(null)
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setAnalysisResult(null)
  }

  const processFiles = async () => {
    if (files.length === 0) return
    setProcessing(true)
    setError(null)
    setAnalysisResult(null)
    
    const period = `${monthNamesShort[selectedMonth]} ${selectedYear}`
    const allTransactions: Transaction[] = []

    try {
      // Fetch exchange rates first
      const exchangeRates = await getExchangeRates()
      console.log('Exchange rates loaded:', Object.keys(exchangeRates).length, 'currencies')
      
      // Process all files locally - INSTANT
      for (const file of files) {
        const csvContent = await file.text()
        const transactions = parseCSVLocally(csvContent, file.name, teamMembers, exchangeRates)
        
        // Add period to each transaction
        transactions.forEach(tx => {
          tx.period = period
        })
        
        allTransactions.push(...transactions)
      }

      if (allTransactions.length === 0) {
        setError('No valid transactions found. Please check your CSV format.')
        setProcessing(false)
        return
      }

      // Calculate summary (all amounts now in USD)
      const income = allTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expenses = allTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0)
      
      setAnalysisResult({
        transactions: allTransactions,
        summary: {
          total: allTransactions.length,
          income,
          expenses,
          incomeCount: allTransactions.filter(t => t.type === 'income').length,
          expenseCount: allTransactions.filter(t => t.type === 'expense').length,
          internalCount: allTransactions.filter(t => t.type === 'internal').length,
          categories: [...new Set(allTransactions.map(t => t.category).filter(Boolean))]
        }
      })
      
    } catch (err: any) {
      console.error(err)
      setError('Error processing files: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const confirmImport = () => {
    if (analysisResult) {
      const period = `${monthNamesShort[selectedMonth]} ${selectedYear}`
      onUploadComplete(analysisResult.transactions, period, files)
    }
  }

  // Auto-process when files are added
  useEffect(() => {
    if (files.length > 0 && !analysisResult && !processing) {
      processFiles()
    }
  }, [files])

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
          <div>
            <h3 className="text-lg font-semibold">Upload Statements</h3>
            <p className="text-zinc-500 text-sm flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Instant Processing
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5 text-zinc-400" /></button>
        </div>
        
        <div className="p-5 space-y-4">
          {/* Period Selector */}
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Statement Period</label>
            <div className="flex gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(parseInt(e.target.value)); setAnalysisResult(null); setFiles([]) }}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {monthNames.map((month, idx) => (
                  <option key={month} value={idx}>{month}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setAnalysisResult(null); setFiles([]) }}
                className="w-24 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {[2023, 2024, 2025, 2026].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Drop Zone */}
          {!analysisResult && (
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
              <p className="text-zinc-400 mb-1">Drop your bank statements here</p>
              <p className="text-zinc-600 text-sm mb-3">Relay, Revolut, Mercury CSV files</p>
              <button type="button" className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium px-4 py-2 rounded-lg transition-colors">
                Browse Files
              </button>
            </div>
          )}

          {/* Processing indicator */}
          {processing && (
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              <span className="text-zinc-400">Processing {files.length} file{files.length > 1 ? 's' : ''}...</span>
            </div>
          )}

          {/* Analysis Result */}
          {analysisResult && (
            <div className="space-y-4">
              {/* Success header */}
              <div className="flex items-center gap-2 text-emerald-400">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <span className="text-black text-sm font-bold">✓</span>
                </div>
                <span className="font-semibold">Ready to Import</span>
                <span className="text-zinc-500 text-sm ml-auto">{files.length} file{files.length > 1 ? 's' : ''}</span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-emerald-400">{analysisResult.summary.incomeCount}</p>
                  <p className="text-xs text-zinc-500 mt-1">Income</p>
                  <p className="text-sm text-emerald-400/70 font-medium">{formatCurrency(analysisResult.summary.income)}</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-red-400">{analysisResult.summary.expenseCount}</p>
                  <p className="text-xs text-zinc-500 mt-1">Expenses</p>
                  <p className="text-sm text-red-400/70 font-medium">{formatCurrency(analysisResult.summary.expenses)}</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-blue-400">{analysisResult.summary.internalCount}</p>
                  <p className="text-xs text-zinc-500 mt-1">Transfers</p>
                  <p className="text-sm text-blue-400/70 font-medium">Internal</p>
                </div>
              </div>

              {/* Net result */}
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Net Result</span>
                  <span className={`text-2xl font-bold ${analysisResult.summary.income - analysisResult.summary.expenses >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(analysisResult.summary.income - analysisResult.summary.expenses)}
                  </span>
                </div>
              </div>

              {/* Categories */}
              {analysisResult.summary.categories.length > 0 && (
                <div>
                  <p className="text-zinc-500 text-xs mb-2">Auto-categorized:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.summary.categories.map((cat: string) => (
                      <span key={cat} className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-medium">{cat}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              <div>
                <p className="text-zinc-500 text-xs mb-2">Preview:</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {analysisResult.transactions.slice(0, 4).map((tx, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-zinc-800/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{tx.description}</p>
                        <p className="text-zinc-600 text-xs">{tx.category} • {tx.bank}</p>
                      </div>
                      <span className={`text-sm font-semibold ml-3 ${tx.type === 'income' ? 'text-emerald-400' : tx.type === 'expense' ? 'text-red-400' : 'text-blue-400'}`}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '↔'}
                        {formatCurrency(Math.abs(tx.amount), tx.currency)}
                      </span>
                    </div>
                  ))}
                  {analysisResult.transactions.length > 4 && (
                    <p className="text-zinc-600 text-xs text-center py-1">
                      +{analysisResult.transactions.length - 4} more transactions
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          {analysisResult && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setAnalysisResult(null); setFiles([]) }}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors"
              >
                Add More Files
              </button>
              <button
                onClick={confirmImport}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-colors"
              >
                Import {analysisResult.transactions.length} Transactions
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// ADD MEMBER MODAL
// ============================================
// ============================================
// MANAGE DATA MODAL
// ============================================
function ManageDataModal({ 
  statements, 
  onDeletePeriod, 
  onDeleteAll, 
  onClose 
}: { 
  statements: { id: string; filename: string; bank: string; period: string; transactions_count: number; created_at: string }[]
  onDeletePeriod: (period: string) => Promise<boolean>
  onDeleteAll: () => Promise<boolean>
  onClose: () => void 
}) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  // Group statements by period
  const byPeriod = statements.reduce((acc, stmt) => {
    if (!acc[stmt.period]) acc[stmt.period] = []
    acc[stmt.period].push(stmt)
    return acc
  }, {} as Record<string, typeof statements>)

  const periods = Object.keys(byPeriod).sort((a, b) => {
    // Sort by date descending
    const [aMonth, aYear] = a.split(' ')
    const [bMonth, bYear] = b.split(' ')
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return (parseInt(bYear) - parseInt(aYear)) || (monthOrder.indexOf(bMonth) - monthOrder.indexOf(aMonth))
  })

  const handleDeletePeriod = async (period: string) => {
    setDeleting(period)
    await onDeletePeriod(period)
    setDeleting(null)
  }

  const handleDeleteAll = async () => {
    setDeleting('all')
    await onDeleteAll()
    setDeleting(null)
    setConfirmDeleteAll(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
          <div>
            <h3 className="text-lg font-semibold">Manage Data</h3>
            <p className="text-zinc-500 text-sm">View and delete imported statements</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          {periods.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No data imported yet</p>
            </div>
          ) : (
            <>
              {/* Periods list */}
              <div className="space-y-3">
                {periods.map(period => {
                  const stmts = byPeriod[period]
                  const totalTx = stmts.reduce((sum, s) => sum + s.transactions_count, 0)
                  
                  return (
                    <div key={period} className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{period}</h4>
                        <button
                          onClick={() => handleDeletePeriod(period)}
                          disabled={deleting === period}
                          className="text-red-400 hover:text-red-300 text-sm font-medium disabled:opacity-50 flex items-center gap-1"
                        >
                          {deleting === period ? (
                            <>
                              <div className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Delete Period'
                          )}
                        </button>
                      </div>
                      <p className="text-zinc-500 text-sm mb-2">{totalTx} transactions</p>
                      <div className="space-y-1">
                        {stmts.map(stmt => (
                          <div key={stmt.id} className="text-xs text-zinc-500 flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-zinc-700 rounded">{stmt.bank}</span>
                            <span className="truncate">{stmt.filename}</span>
                            <span className="text-zinc-600">({stmt.transactions_count})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Delete all */}
              <div className="pt-4 border-t border-zinc-800">
                {!confirmDeleteAll ? (
                  <button
                    onClick={() => setConfirmDeleteAll(true)}
                    className="w-full py-3 text-red-400 hover:bg-red-500/10 rounded-xl font-medium transition-colors"
                  >
                    Delete All Data
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-center text-zinc-400 text-sm">Are you sure? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDeleteAll(false)}
                        className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAll}
                        disabled={deleting === 'all'}
                        className="flex-1 py-2 bg-red-500 hover:bg-red-400 text-white rounded-xl font-medium disabled:opacity-50"
                      >
                        {deleting === 'all' ? 'Deleting...' : 'Yes, Delete All'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AddMemberModal({ onSave, onClose }: { onSave: (name: string, role: string, baseSalary: number, beneficiaryAccount?: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [baseSalary, setBaseSalary] = useState('')
  const [beneficiaryAccount, setBeneficiaryAccount] = useState('')

  const handleSave = () => {
    if (!name || !role || !baseSalary) return
    onSave(name, role, parseFloat(baseSalary), beneficiaryAccount || undefined)
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
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Beneficiary Account <span className="text-zinc-600">(optional)</span></label>
            <input type="text" value={beneficiaryAccount} onChange={(e) => setBeneficiaryAccount(e.target.value)} placeholder="For auto-matching payments" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500" />
            <p className="text-zinc-600 text-xs mt-1">Account number from Revolut transfers</p>
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
