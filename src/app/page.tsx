'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Calendar, LayoutDashboard, Receipt, Users, ChevronDown, ChevronLeft, ChevronRight, Plus, Pencil, X, FileUp, UserPlus, DollarSign, PoundSterling, Euro, Building2, CreditCard, Landmark, Loader2, Banknote, Check, Tag, Trash2, Search, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase'

// ============================================
// TYPES
// ============================================
type Category = {
  id: string
  name: string
  color: string
  created_at?: string
}

type CategorizationRule = {
  id: string
  keyword: string
  category: string
  match_type: 'contains' | 'exact' | 'starts_with'
  priority: number
  created_at?: string
}

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
  // Extended fields from CSV
  payee?: string           // Payee name (Relay) or counterpart
  accountNumber?: string   // Account # (Relay sub-account)
  transactionType?: string // Original type: Receive-transfer, Spend, CARD_PAYMENT, etc
  status?: string          // SETTLED, PENDING, COMPLETED, etc
  balance?: number         // Balance after transaction
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

// Current month index (0-11) - use fixed value to avoid hydration mismatch
// The actual current date is used inside components with useEffect
const currentMonthIndex = 11 // December (will be updated client-side)
const currentYear = 2025

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
// DATE PICKER COMPONENT
// ============================================
function DatePicker({ 
  value, 
  onChange, 
  placeholder = 'Select date',
  label
}: { 
  value: string
  onChange: (date: string) => void
  placeholder?: string
  label?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value)
    return new Date()
  })
  const containerRef = useRef<HTMLDivElement>(null)

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  // Get days in month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()
    
    const days: { date: Date; isCurrentMonth: boolean }[] = []
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false
      })
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      })
    }
    
    // Next month days to fill grid
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      })
    }
    
    return days
  }

  const days = getDaysInMonth(viewDate)

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const isSelected = (date: Date) => {
    if (!value) return false
    const selected = new Date(value)
    return date.getDate() === selected.getDate() && 
           date.getMonth() === selected.getMonth() && 
           date.getFullYear() === selected.getFullYear()
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear()
  }

  const handleSelect = (date: Date) => {
    const formatted = date.toISOString().split('T')[0]
    onChange(formatted)
    setIsOpen(false)
  }

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }

  const clearDate = () => {
    onChange('')
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="block text-zinc-500 text-xs mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-zinc-600 hover:border-zinc-600 transition-colors text-left"
      >
        <span className={value ? 'text-white' : 'text-zinc-500'}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <Calendar className="w-4 h-4 text-zinc-500" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
              <button 
                onClick={prevMonth}
                className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium">
                {months[viewDate.getMonth()]} {viewDate.getFullYear()}
              </span>
              <button 
                onClick={nextMonth}
                className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 gap-1 p-2 border-b border-zinc-800">
              {daysOfWeek.map(day => (
                <div key={day} className="text-center text-xs text-zinc-500 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 p-2">
              {days.map((day, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(day.date)}
                  className={`
                    p-2 text-sm rounded-lg transition-colors
                    ${!day.isCurrentMonth ? 'text-zinc-600' : 'text-zinc-300'}
                    ${isSelected(day.date) ? 'bg-emerald-500 text-black font-semibold' : ''}
                    ${isToday(day.date) && !isSelected(day.date) ? 'border border-emerald-500/50 text-emerald-400' : ''}
                    ${day.isCurrentMonth && !isSelected(day.date) ? 'hover:bg-zinc-800' : ''}
                  `}
                >
                  {day.date.getDate()}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-zinc-800 flex gap-2">
              <button
                onClick={clearDate}
                className="flex-1 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg text-sm transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  handleSelect(new Date())
                }}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Today
              </button>
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
// LOADING SKELETON COMPONENT
// ============================================
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <div className="h-4 bg-zinc-700 rounded w-20 mb-2" />
            <div className="h-8 bg-zinc-700 rounded w-28" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-4">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 bg-zinc-700 rounded w-20" />
              <div className="h-4 bg-zinc-700 rounded flex-1" />
              <div className="h-4 bg-zinc-700 rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================
// OVERVIEW TAB
// ============================================
function OverviewTab({ data, transactions, onUpload, loading, categorizationRules, onCreateRule, onApplyRules, allCategories, onBulkUpdateCategory }: { 
  data: { income: number; expenses: number; profit: number }
  transactions: Transaction[]
  onUpload: () => void
  loading: boolean
  categorizationRules?: CategorizationRule[]
  onCreateRule?: (keyword: string, category: string, matchType: 'contains' | 'exact' | 'starts_with') => Promise<boolean>
  onApplyRules?: () => Promise<number>
  allCategories?: { id: string; name: string; color: string }[]
  onBulkUpdateCategory?: (transactionIds: string[], category: string, createRule?: { keyword: string }) => Promise<boolean>
}) {
  // State for transaction detail popup
  const [detailPopup, setDetailPopup] = useState<{ title: string; transactions: Transaction[]; category?: string } | null>(null)
  const [showQuickRule, setShowQuickRule] = useState<{ keyword: string; description: string } | null>(null)
  const [quickRuleCategory, setQuickRuleCategory] = useState('Other')
  
  // Bulk selection states
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [popupSearch, setPopupSearch] = useState('')
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null)
  const [bulkProcessing, setBulkProcessing] = useState(false)
  
  // Use allCategories if provided, sorted with Other at the end
  const categories = allCategories 
    ? [...allCategories.filter(c => c.name !== 'Other').map(c => c.name), 'Other']
    : ['Ads', 'Software', 'Payroll', 'Fees', 'Shipping', 'Products', 'Taxes', 'Operations', 'Refunds', 'Other']
  
  const margin = data.income > 0 ? ((data.profit / data.income) * 100).toFixed(1) : '0'
  const hasData = data.income > 0 || data.expenses > 0

  // Reset selection when popup closes
  const closePopup = () => {
    setDetailPopup(null)
    setShowQuickRule(null)
    setSelectedTxIds(new Set())
    setPopupSearch('')
    setExpandedTxId(null)
    setBulkCategory('')
  }

  // Toggle transaction selection
  const toggleTxSelection = (txId: string) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev)
      if (next.has(txId)) {
        next.delete(txId)
      } else {
        next.add(txId)
      }
      return next
    })
  }

  // Select/deselect all filtered transactions
  const toggleSelectAll = (txs: Transaction[]) => {
    const allSelected = txs.every(tx => selectedTxIds.has(tx.id))
    if (allSelected) {
      setSelectedTxIds(new Set())
    } else {
      setSelectedTxIds(new Set(txs.map(tx => tx.id)))
    }
  }

  // Handle bulk categorization
  const handleBulkCategorize = async () => {
    if (!bulkCategory || selectedTxIds.size === 0 || !onBulkUpdateCategory) return
    
    setBulkProcessing(true)
    
    // Get selected transactions
    const selectedTxs = detailPopup?.transactions.filter(tx => selectedTxIds.has(tx.id)) || []
    
    // Find common keyword from descriptions (use the first selected tx description as rule)
    const firstTx = selectedTxs[0]
    const keyword = firstTx?.description.toLowerCase().trim() || ''
    
    const success = await onBulkUpdateCategory(
      Array.from(selectedTxIds), 
      bulkCategory,
      keyword ? { keyword } : undefined
    )
    
    if (success) {
      setSelectedTxIds(new Set())
      setBulkCategory('')
      closePopup()
    }
    
    setBulkProcessing(false)
  }

  // Show skeleton while loading
  if (loading) {
    return <LoadingSkeleton />
  }

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
      if (!acc[cat]) acc[cat] = { total: 0, transactions: [] }
      acc[cat].total += Math.abs(t.amount)
      acc[cat].transactions.push(t)
      return acc
    }, {} as Record<string, { total: number; transactions: Transaction[] }>)

  const totalExpenses = Object.values(expensesByCategory).reduce((a, b) => a + b.total, 0)
  const expensesCategorySorted = Object.entries(expensesByCategory).sort((a, b) => b[1].total - a[1].total)

  // Income by source (using description/payee patterns)
  const incomeBySource = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => {
      // Try to identify source from description
      let source = 'Other'
      const desc = t.description.toLowerCase()
      if (desc.includes('cartpanda')) source = 'Cartpanda'
      else if (desc.includes('shopify')) source = 'Shopify'
      else if (desc.includes('stripe')) source = 'Stripe'
      else if (desc.includes('paypal')) source = 'PayPal'
      else if (t.category === 'Refunds') source = 'Refunds'
      else if (t.payee) source = t.payee
      else source = t.bank
      
      if (!acc[source]) acc[source] = { total: 0, transactions: [] }
      acc[source].total += t.amount
      acc[source].transactions.push(t)
      return acc
    }, {} as Record<string, { total: number; transactions: Transaction[] }>)

  const totalIncome = Object.values(incomeBySource).reduce((a, b) => a + b.total, 0)
  const incomeSourceSorted = Object.entries(incomeBySource).sort((a, b) => b[1].total - a[1].total)

  // Income by Bank
  const incomeByBank = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => {
      const bank = t.bank || 'Unknown'
      if (!acc[bank]) acc[bank] = { total: 0, transactions: [] }
      acc[bank].total += t.amount
      acc[bank].transactions.push(t)
      return acc
    }, {} as Record<string, { total: number; transactions: Transaction[] }>)

  const incomeBankSorted = Object.entries(incomeByBank).sort((a, b) => b[1].total - a[1].total)
  const totalIncomeByBank = Object.values(incomeByBank).reduce((a, b) => a + b.total, 0)

  // Normalize vendor names for grouping
  const normalizeVendor = (name: string): string => {
    const lower = name.toLowerCase().trim()
    
    // Google Ads variations
    if (lower.includes('google') && (lower.includes('ads') || lower.includes('adwords'))) return 'Google Ads'
    if (lower.match(/dl \*google/)) return 'Google Ads'
    
    // Facebook/Meta
    if (lower.includes('facebook') || lower.includes('meta') || lower.includes('fb ')) return 'Facebook Ads'
    
    // TikTok
    if (lower.includes('tiktok') || lower.includes('bytedance')) return 'TikTok Ads'
    
    // Shopify
    if (lower.includes('shopify')) return 'Shopify'
    
    // Stripe
    if (lower.includes('stripe')) return 'Stripe'
    
    // PayPal
    if (lower.includes('paypal')) return 'PayPal'
    
    // Amazon
    if (lower.includes('amazon') || lower.includes('aws')) return 'Amazon'
    
    // Clean up "Para XXX" pattern (Brazilian transfers)
    if (lower.startsWith('para ')) {
      // Extract first meaningful name part
      const cleaned = name.substring(5).split(/\s+/).slice(0, 2).join(' ')
      return cleaned || name
    }
    
    // Clean up "To XXX" pattern
    if (lower.startsWith('to ')) {
      const cleaned = name.substring(3).split(/\s+/).slice(0, 2).join(' ')
      return cleaned || name
    }
    
    // Remove common prefixes/suffixes
    let result = name
      .replace(/^(dl \*|payment to |transfer to |pix para )/i, '')
      .replace(/\d{6,}/g, '') // Remove long numbers
      .replace(/\s+/g, ' ')
      .trim()
    
    // Capitalize first letter of each word
    result = result.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
    
    return result || name
  }

  // Top vendors (grouped by normalized payee/description) - only real expenses
  const vendorTotals = transactions
    .filter(t => t.type === 'expense' && t.category !== 'Sales') // Exclude mis-categorized sales
    .reduce((acc, t) => {
      // Use payee if available, otherwise use description
      const rawVendor = t.payee || t.description || 'Unknown'
      const vendor = normalizeVendor(rawVendor)
      if (!acc[vendor]) {
        acc[vendor] = { total: 0, count: 0, category: t.category }
      }
      acc[vendor].total += Math.abs(t.amount)
      acc[vendor].count += 1
      return acc
    }, {} as Record<string, { total: number; count: number; category: string }>)

  const topVendors = Object.entries(vendorTotals)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)

  // Currency breakdown - INCOME ONLY
  const currencyBreakdown = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => {
      const currency = t.originalCurrency || t.currency || 'USD'
      const originalAmount = t.originalAmount !== undefined ? Math.abs(t.originalAmount) : Math.abs(t.amount)
      const usdAmount = Math.abs(t.amount)
      
      if (!acc[currency]) {
        acc[currency] = { amount: 0, originalAmount: 0, count: 0 }
      }
      
      acc[currency].amount += usdAmount
      acc[currency].originalAmount += originalAmount
      acc[currency].count += 1
      return acc
    }, {} as Record<string, { amount: number; originalAmount: number; count: number }>)

  const currencySorted = Object.entries(currencyBreakdown)
    .map(([currency, data]) => ({
      currency,
      ...data
    }))
    .sort((a, b) => b.amount - a.amount)
  
  const totalIncomeByCurrency = currencySorted.reduce((a, b) => a + b.amount, 0)

  // Currency info - using symbols only (no emojis)
  const currencyInfo: Record<string, { symbol: string; color: string }> = {
    USD: { symbol: '$', color: 'text-emerald-400' },
    EUR: { symbol: '€', color: 'text-blue-400' },
    GBP: { symbol: '£', color: 'text-purple-400' },
    BRL: { symbol: 'R$', color: 'text-yellow-400' },
    CAD: { symbol: 'C$', color: 'text-red-400' },
    AUD: { symbol: 'A$', color: 'text-orange-400' },
    JPY: { symbol: '¥', color: 'text-pink-400' },
    CNY: { symbol: '¥', color: 'text-rose-400' },
    MXN: { symbol: '$', color: 'text-green-400' },
  }

  // Bank icons component
  const BankIcon = ({ bank, className = "w-5 h-5" }: { bank: string; className?: string }) => {
    switch (bank) {
      case 'Relay': return <Building2 className={className} />
      case 'Revolut': return <CreditCard className={className} />
      case 'Mercury': return <Landmark className={className} />
      default: return <Banknote className={className} />
    }
  }

  // Category colors - merge default with custom from allCategories
  const colorMapping: Record<string, string> = {
    purple: 'from-purple-500 to-purple-600',
    cyan: 'from-cyan-500 to-cyan-600',
    blue: 'from-blue-500 to-blue-600',
    amber: 'from-amber-500 to-amber-600',
    orange: 'from-orange-500 to-orange-600',
    pink: 'from-pink-500 to-pink-600',
    red: 'from-red-500 to-red-600',
    zinc: 'from-zinc-500 to-zinc-600',
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    teal: 'from-teal-500 to-teal-600',
    rose: 'from-rose-500 to-rose-600',
    lime: 'from-lime-500 to-lime-600',
  }

  // Build categoryColors from allCategories
  const categoryColors: Record<string, string> = {}
  if (allCategories) {
    allCategories.forEach(cat => {
      categoryColors[cat.name] = colorMapping[cat.color] || colorMapping.zinc
    })
  }
  // Add defaults for any missing
  const defaultColors: Record<string, string> = {
    Ads: 'from-purple-500 to-purple-600',
    Payroll: 'from-blue-500 to-blue-600',
    Software: 'from-cyan-500 to-cyan-600',
    Fees: 'from-amber-500 to-amber-600',
    Shipping: 'from-orange-500 to-orange-600',
    Products: 'from-pink-500 to-pink-600',
    Taxes: 'from-red-500 to-red-600',
    Other: 'from-zinc-500 to-zinc-600',
    Transfer: 'from-indigo-500 to-indigo-600',
    Refunds: 'from-emerald-500 to-emerald-600',
    Sales: 'from-emerald-500 to-emerald-600',
  }
  Object.entries(defaultColors).forEach(([name, color]) => {
    if (!categoryColors[name]) {
      categoryColors[name] = color
    }
  })

  const getCategoryColor = (cat: string) => categoryColors[cat] || 'from-zinc-500 to-zinc-600'

  // Extract potential keyword from transaction description
  const extractKeyword = (description: string): string => {
    // Get first meaningful word (skip common words)
    const words = description.toLowerCase().split(/\s+/)
    const skipWords = ['from', 'to', 'the', 'and', 'for', 'via', 'por', 'com', 'de', 'para', 'dinheiro', 'adicionado', 'partir']
    for (const word of words) {
      if (word.length > 3 && !skipWords.includes(word)) {
        return word
      }
    }
    return words[0] || description.toLowerCase()
  }

  const handleQuickRule = async (keyword: string, category: string) => {
    if (onCreateRule) {
      const success = await onCreateRule(keyword, category, 'contains')
      if (success && onApplyRules) {
        await onApplyRules()
      }
      setShowQuickRule(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Transaction Detail Popup */}
      {detailPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closePopup}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">{detailPopup.title}</h3>
                <p className="text-zinc-500 text-sm">{detailPopup.transactions.length} transactions</p>
              </div>
              <button onClick={closePopup} className="p-2 hover:bg-zinc-800 rounded-lg">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Search Bar */}
            {detailPopup.category === 'Other' && (
              <div className="px-5 py-3 border-b border-zinc-800 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={popupSearch}
                    onChange={(e) => setPopupSearch(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-zinc-600"
                  />
                </div>
              </div>
            )}

            {/* Bulk Action Bar */}
            {selectedTxIds.size > 0 && detailPopup.category === 'Other' && onBulkUpdateCategory && (
              <div className="px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/30 flex items-center gap-3 flex-shrink-0">
                <span className="text-emerald-400 text-sm font-medium">{selectedTxIds.size} selected</span>
                <div className="flex-1" />
                <div className="relative">
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 pr-8 text-sm focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                  >
                    <option value="">Select category...</option>
                    {categories.filter(c => c !== 'Other').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                </div>
                <button
                  onClick={handleBulkCategorize}
                  disabled={!bulkCategory || bulkProcessing}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                  Categorize & Create Rule
                </button>
                <button
                  onClick={() => setSelectedTxIds(new Set())}
                  className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {/* Transaction List */}
            <div className="p-5 overflow-y-auto flex-1">
              {(() => {
                // Filter transactions by search
                const filteredTxs = popupSearch 
                  ? detailPopup.transactions.filter(tx => 
                      tx.description.toLowerCase().includes(popupSearch.toLowerCase()) ||
                      (tx.payee || '').toLowerCase().includes(popupSearch.toLowerCase())
                    )
                  : detailPopup.transactions
                
                const allSelected = filteredTxs.length > 0 && filteredTxs.every(tx => selectedTxIds.has(tx.id))

                return (
                  <div className="space-y-2">
                    {/* Select All Header for Other category */}
                    {detailPopup.category === 'Other' && filteredTxs.length > 0 && (
                      <div className="flex items-center gap-3 pb-2 border-b border-zinc-800 mb-3">
                        <button
                          onClick={() => toggleSelectAll(filteredTxs)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            allSelected 
                              ? 'bg-emerald-500 border-emerald-500' 
                              : 'border-zinc-600 hover:border-zinc-500'
                          }`}
                        >
                          {allSelected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                        </button>
                        <span className="text-zinc-400 text-sm">
                          {allSelected ? 'Deselect all' : 'Select all'} ({filteredTxs.length})
                        </span>
                      </div>
                    )}

                    {filteredTxs.map((tx) => {
                      const originalCurrency = tx.originalCurrency || tx.currency || 'USD'
                      const originalAmount = tx.originalAmount !== undefined ? tx.originalAmount : tx.amount
                      const currInfo = currencyInfo[originalCurrency] || { symbol: originalCurrency, color: 'text-zinc-400' }
                      const hasConversion = tx.originalCurrency && tx.originalCurrency !== 'USD'
                      const isSelected = selectedTxIds.has(tx.id)
                      const isExpanded = expandedTxId === tx.id
                      
                      return (
                        <div key={tx.id} className="bg-zinc-800/50 rounded-lg overflow-hidden">
                          {/* Main Row */}
                          <div 
                            className={`flex items-center p-3 hover:bg-zinc-800 transition-colors cursor-pointer ${isExpanded ? 'bg-zinc-800' : ''}`}
                            onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                          >
                            {/* Checkbox for Other category */}
                            {detailPopup.category === 'Other' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleTxSelection(tx.id) }}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mr-3 flex-shrink-0 ${
                                  isSelected 
                                    ? 'bg-emerald-500 border-emerald-500' 
                                    : 'border-zinc-600 hover:border-zinc-500'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                              </button>
                            )}
                            
                            <div className="w-8 h-8 rounded-lg bg-zinc-700/50 flex items-center justify-center text-zinc-400 flex-shrink-0">
                              <BankIcon bank={tx.bank} className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0 ml-3">
                              <p className="font-medium truncate">{tx.description}</p>
                              <p className="text-zinc-500 text-sm">{tx.date} • {tx.bank}</p>
                            </div>
                            <div className="text-right ml-3">
                              <span className={`font-semibold ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {tx.type === 'income' ? '+' : '-'}{currInfo.symbol}{Math.abs(originalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              {hasConversion && (
                                <p className="text-zinc-500 text-xs">≈ {formatCurrency(Math.abs(tx.amount))}</p>
                              )}
                            </div>
                            <ChevronDown className={`w-4 h-4 text-zinc-500 ml-2 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 border-t border-zinc-700/50 bg-zinc-800/30">
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-zinc-500 text-xs mb-1">Description</p>
                                  <p className="font-medium">{tx.description}</p>
                                </div>
                                {tx.payee && (
                                  <div>
                                    <p className="text-zinc-500 text-xs mb-1">Payee</p>
                                    <p className="font-medium">{tx.payee}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-zinc-500 text-xs mb-1">Date</p>
                                  <p className="font-medium">{tx.date}</p>
                                </div>
                                <div>
                                  <p className="text-zinc-500 text-xs mb-1">Bank</p>
                                  <p className="font-medium">{tx.bank}</p>
                                </div>
                                {tx.account && (
                                  <div>
                                    <p className="text-zinc-500 text-xs mb-1">Account</p>
                                    <p className="font-medium">{tx.account}</p>
                                  </div>
                                )}
                                {tx.accountNumber && (
                                  <div>
                                    <p className="text-zinc-500 text-xs mb-1">Account Number</p>
                                    <p className="font-medium">{tx.accountNumber}</p>
                                  </div>
                                )}
                                {tx.reference && (
                                  <div>
                                    <p className="text-zinc-500 text-xs mb-1">Reference</p>
                                    <p className="font-medium font-mono text-xs">{tx.reference}</p>
                                  </div>
                                )}
                                {tx.transactionType && (
                                  <div>
                                    <p className="text-zinc-500 text-xs mb-1">Type</p>
                                    <p className="font-medium">{tx.transactionType}</p>
                                  </div>
                                )}
                                {tx.status && (
                                  <div>
                                    <p className="text-zinc-500 text-xs mb-1">Status</p>
                                    <p className="font-medium">{tx.status}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-zinc-500 text-xs mb-1">Amount (USD)</p>
                                  <p className={`font-medium ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {formatCurrency(Math.abs(tx.amount))}
                                  </p>
                                </div>
                                {hasConversion && (
                                  <div>
                                    <p className="text-zinc-500 text-xs mb-1">Original Amount</p>
                                    <p className="font-medium">
                                      {currInfo.symbol}{Math.abs(originalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {originalCurrency}
                                    </p>
                                  </div>
                                )}
                                {tx.balance !== undefined && (
                                  <div>
                                    <p className="text-zinc-500 text-xs mb-1">Balance After</p>
                                    <p className="font-medium">{formatCurrency(tx.balance)}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-zinc-500 text-xs mb-1">Category</p>
                                  <p className="font-medium">{tx.category}</p>
                                </div>
                                {tx.period && (
                                  <div>
                                    <p className="text-zinc-500 text-xs mb-1">Period</p>
                                    <p className="font-medium">{tx.period}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {filteredTxs.length === 0 && (
                      <p className="text-zinc-500 text-center py-8">No transactions found</p>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Main Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`col-span-2 bg-gradient-to-br ${data.profit >= 0 ? 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30' : 'from-red-500/20 to-red-600/5 border-red-500/30'} border rounded-2xl p-6`}>
          <p className={`${data.profit >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'} text-sm font-medium mb-1`}>Total Profit</p>
          <p className={`text-4xl font-bold ${data.profit >= 0 ? '' : 'text-red-400'}`}>
            {data.profit < 0 ? '-' : ''}{formatCurrency(Math.abs(data.profit))}
          </p>
          <p className={`${data.profit >= 0 ? 'text-emerald-400' : 'text-red-400'} text-sm mt-2`}>{margin}% margin</p>
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

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Expenses by Category */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold">Expenses by Category</h3>
            <span className="text-zinc-500 text-sm">{formatCurrency(totalExpenses)}</span>
          </div>
          <div className="space-y-4">
            {expensesCategorySorted.slice(0, 6).map(([category, data]) => {
              const percentage = totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0
              return (
                <div 
                  key={category} 
                  className="space-y-2 cursor-pointer hover:bg-zinc-700/30 -mx-2 px-2 py-1 rounded-lg transition-colors"
                  onClick={() => setDetailPopup({ title: `${category} Expenses`, transactions: data.transactions, category })}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{category}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500">{percentage.toFixed(0)}%</span>
                      <span className="font-medium w-24 text-right">{formatCurrency(data.total)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${getCategoryColor(category)} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {expensesCategorySorted.length === 0 && (
              <p className="text-zinc-500 text-sm text-center py-4">No expense data</p>
            )}
          </div>
        </div>

        {/* Income Sources */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold">Income Sources</h3>
            <span className="text-zinc-500 text-sm">{formatCurrency(totalIncome)}</span>
          </div>
          <div className="space-y-4">
            {incomeSourceSorted.slice(0, 6).map(([source, data]) => {
              const percentage = totalIncome > 0 ? (data.total / totalIncome) * 100 : 0
              return (
                <div 
                  key={source} 
                  className="space-y-2 cursor-pointer hover:bg-zinc-700/30 -mx-2 px-2 py-1 rounded-lg transition-colors"
                  onClick={() => setDetailPopup({ title: `${source} Income`, transactions: data.transactions })}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{source}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500">{percentage.toFixed(0)}%</span>
                      <span className="font-medium text-emerald-400 w-24 text-right">{formatCurrency(data.total)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {incomeSourceSorted.length === 0 && (
              <p className="text-zinc-500 text-sm text-center py-4">No income data</p>
            )}
          </div>
        </div>

        {/* Top Vendors */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6">
          <h3 className="font-semibold mb-5">Top Vendors</h3>
          <div className="space-y-3">
            {topVendors.map(([vendor, data], idx) => (
              <div key={vendor} className="flex items-center gap-4 py-2 border-b border-zinc-800/50 last:border-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  idx === 0 ? 'bg-red-500/20 text-red-400' :
                  idx === 1 ? 'bg-orange-500/20 text-orange-400' :
                  idx === 2 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-zinc-700/50 text-zinc-400'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{vendor}</p>
                  <p className="text-zinc-500 text-xs">{data.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-400">{formatCurrency(data.total)}</p>
                  <p className="text-zinc-500 text-xs">{data.count} payment{data.count > 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
            {topVendors.length === 0 && (
              <p className="text-zinc-500 text-sm text-center py-4">No expenses yet</p>
            )}
          </div>
        </div>

        {/* Income by Currency */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold">Income by Currency</h3>
            <span className="text-zinc-500 text-sm">{formatCurrency(totalIncomeByCurrency)}</span>
          </div>
          <div className="space-y-4">
            {currencySorted.map((data) => {
              const info = currencyInfo[data.currency] || { symbol: data.currency, color: 'text-zinc-400' }
              const percentage = totalIncomeByCurrency > 0 ? (data.amount / totalIncomeByCurrency) * 100 : 0
              return (
                <div key={data.currency} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-zinc-700/50 flex items-center justify-center text-sm font-bold ${info.color}`}>
                      {info.symbol}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{data.currency}</span>
                        <span className="text-zinc-500 text-sm">{percentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right w-24">
                      <p className="font-semibold text-emerald-400">{formatCurrency(data.amount)}</p>
                      {data.currency !== 'USD' && (
                        <p className="text-zinc-500 text-xs">
                          {info.symbol}{data.originalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {currencySorted.length === 0 && (
              <p className="text-zinc-500 text-sm text-center py-4">No income data</p>
            )}
          </div>
          {currencySorted.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-700/50 flex items-center justify-between">
              <span className="text-zinc-500 text-sm">{currencySorted.length} currencies</span>
              <span className="text-zinc-500 text-sm">{currencySorted.reduce((a, b) => a + b.count, 0)} transactions</span>
            </div>
          )}
        </div>

        {/* Income by Bank */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold">Income by Bank</h3>
            <span className="text-zinc-500 text-sm">{formatCurrency(totalIncomeByBank)}</span>
          </div>
          <div className="space-y-4">
            {incomeBankSorted.map(([bank, data]) => {
              const percentage = totalIncomeByBank > 0 ? (data.total / totalIncomeByBank) * 100 : 0
              return (
                <div 
                  key={bank} 
                  className="space-y-2 cursor-pointer hover:bg-zinc-700/30 -mx-2 px-2 py-1 rounded-lg transition-colors"
                  onClick={() => setDetailPopup({ title: `${bank} Income`, transactions: data.transactions })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-700/50 flex items-center justify-center text-zinc-400">
                      <BankIcon bank={bank} className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{bank}</span>
                        <span className="text-zinc-500 text-sm">{percentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right w-24">
                      <p className="font-semibold text-emerald-400">{formatCurrency(data.total)}</p>
                      <p className="text-zinc-500 text-xs">{data.transactions.length} tx</p>
                    </div>
                  </div>
                </div>
              )
            })}
            {incomeBankSorted.length === 0 && (
              <p className="text-zinc-500 text-sm text-center py-4">No income data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// TRANSACTIONS TAB
// ============================================
function TransactionsTab({ transactions, onUpload, selectedYear, selectedMonths, loading }: { 
  transactions: Transaction[]
  onUpload: () => void
  selectedYear: number
  selectedMonths: number[]
  loading: boolean
}) {
  const [filterType, setFilterType] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState<number | null>(null)
  const [filterDateTo, setFilterDateTo] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showDateFilter, setShowDateFilter] = useState(false)

  // Get unique categories from transactions
  const categories = [...new Set(transactions.map(t => t.category).filter(Boolean))].sort()

  // Get the current period month info
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const currentMonth = selectedMonths.length === 1 ? selectedMonths[0] : new Date().getMonth()
  const daysInMonth = new Date(selectedYear, currentMonth + 1, 0).getDate()

  const filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterCategory !== 'all' && t.category !== filterCategory) return false
    
    // Date filter within selected month - only apply when range is complete
    if (filterDateFrom !== null && filterDateTo !== null) {
      const txDate = new Date(t.date)
      const txDay = txDate.getDate()
      if (txDay < filterDateFrom || txDay > filterDateTo) return false
    }
    
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0)

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)))
    }
  }

  const isAllSelected = filtered.length > 0 && selectedIds.size === filtered.length
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filtered.length

  // Export selected transactions as CSV
  const exportCSV = () => {
    const toExport = filtered.filter(t => selectedIds.has(t.id))
    if (toExport.length === 0) return

    const headers = ['Date', 'Description', 'Reference', 'Bank', 'Account', 'Type', 'Category', 'Amount', 'Currency', 'Original Amount', 'Original Currency']
    const rows = toExport.map(t => [
      t.date,
      `"${t.description.replace(/"/g, '""')}"`,
      `"${(t.reference || '').replace(/"/g, '""')}"`,
      t.bank,
      t.account,
      t.type,
      t.category,
      t.amount.toFixed(2),
      t.currency,
      t.originalAmount?.toFixed(2) || '',
      t.originalCurrency || ''
    ])

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Clear filters
  const clearFilters = () => {
    setFilterType('all')
    setFilterCategory('all')
    setFilterDateFrom(null)
    setFilterDateTo(null)
    setSearch('')
  }

  const hasActiveFilters = filterType !== 'all' || filterCategory !== 'all' || (filterDateFrom !== null && filterDateTo !== null) || search
  const hasDateFilter = filterDateFrom !== null && filterDateTo !== null // Only active when range is complete

  // Date filter display text
  const getDateFilterText = () => {
    if (filterDateFrom === null && filterDateTo === null) return 'All Dates'
    if (filterDateFrom !== null && filterDateTo === null) return `${monthNamesShort[currentMonth]} ${filterDateFrom}...`
    if (filterDateFrom !== null && filterDateTo !== null) {
      if (filterDateFrom === filterDateTo) return `${monthNamesShort[currentMonth]} ${filterDateFrom}`
      return `${monthNamesShort[currentMonth]} ${filterDateFrom}-${filterDateTo}`
    }
    return 'All Dates'
  }

  // Show skeleton while loading
  if (loading) {
    return <LoadingSkeleton />
  }

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
      {/* Summary Cards */}
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

      {/* Compact Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-zinc-600 text-sm"
        />
        
        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 pr-10 focus:outline-none cursor-pointer text-sm appearance-none"
          >
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
            <option value="internal">Internal</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        </div>
        
        <div className="relative">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 pr-10 focus:outline-none cursor-pointer text-sm appearance-none"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        </div>

        {/* Date Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-colors ${
              hasDateFilter 
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                : 'bg-zinc-800 border-zinc-700 text-white hover:border-zinc-600'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{getDateFilterText()}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showDateFilter ? 'rotate-180' : ''}`} />
          </button>

          {showDateFilter && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowDateFilter(false)} />
              <div className="absolute top-full right-0 mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                {/* Header */}
                <div className="p-3 border-b border-zinc-800">
                  <p className="text-sm font-medium text-center">
                    {monthNamesShort[currentMonth]} {selectedYear}
                  </p>
                </div>

                {/* Quick Filters */}
                <div className="p-3 border-b border-zinc-800 flex flex-wrap gap-2">
                  <button
                    onClick={() => { setFilterDateFrom(null); setFilterDateTo(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      !hasDateFilter ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => { setFilterDateFrom(1); setFilterDateTo(7); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filterDateFrom === 1 && filterDateTo === 7 ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    Week 1
                  </button>
                  <button
                    onClick={() => { setFilterDateFrom(8); setFilterDateTo(14); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filterDateFrom === 8 && filterDateTo === 14 ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    Week 2
                  </button>
                  <button
                    onClick={() => { setFilterDateFrom(15); setFilterDateTo(21); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filterDateFrom === 15 && filterDateTo === 21 ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    Week 3
                  </button>
                  <button
                    onClick={() => { setFilterDateFrom(22); setFilterDateTo(daysInMonth); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filterDateFrom === 22 && filterDateTo === daysInMonth ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    Week 4+
                  </button>
                </div>

                {/* Day Grid */}
                <div className="p-3">
                  <p className="text-xs text-zinc-500 mb-2">Select day range:</p>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                      const isInRange = filterDateFrom !== null && filterDateTo !== null && 
                                       day >= filterDateFrom && day <= filterDateTo
                      const isStart = filterDateFrom === day
                      const isEnd = filterDateTo === day
                      const isSingleDay = filterDateFrom === filterDateTo && filterDateFrom === day
                      
                      return (
                        <button
                          key={day}
                          onClick={() => {
                            // If no selection or already have a complete range (different days), start fresh
                            if (filterDateFrom === null || (filterDateFrom !== null && filterDateTo !== null && filterDateFrom !== filterDateTo)) {
                              // Start new selection - only set From, leave To as null temporarily
                              setFilterDateFrom(day)
                              setFilterDateTo(null)
                            } else {
                              // Complete selection (we have From but no To, or From === To)
                              if (day < filterDateFrom) {
                                setFilterDateTo(filterDateFrom)
                                setFilterDateFrom(day)
                              } else {
                                setFilterDateTo(day)
                              }
                            }
                          }}
                          className={`
                            p-2 text-xs rounded-md transition-colors
                            ${isInRange && !isSingleDay ? 'bg-emerald-500/20 text-emerald-400' : ''}
                            ${isStart || isEnd ? 'bg-emerald-500 text-black font-semibold' : ''}
                            ${!isInRange && !isStart && !isEnd ? 'hover:bg-zinc-800 text-zinc-300' : ''}
                            ${filterDateFrom === day && filterDateTo === null ? 'bg-emerald-500 text-black font-semibold ring-2 ring-emerald-400' : ''}
                          `}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                  {filterDateFrom !== null && filterDateTo === null && (
                    <p className="text-xs text-emerald-400 mt-2 text-center">Click another day to complete range</p>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-zinc-800 flex gap-2">
                  <button
                    onClick={() => { setFilterDateFrom(null); setFilterDateTo(null); }}
                    className="flex-1 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg text-sm transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowDateFilter(false)}
                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg text-sm transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors text-sm"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Selection Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
          <span className="text-emerald-400 text-sm font-medium">
            {selectedIds.size} transaction{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-zinc-400 hover:text-white text-sm rounded-lg hover:bg-zinc-800"
            >
              Clear
            </button>
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium rounded-lg flex items-center gap-1"
            >
              <FileUp className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="p-4 w-12">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => { if (el) el.indeterminate = isSomeSelected }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                  />
                </th>
                <th className="text-left p-4 text-zinc-400 text-sm font-medium">Date</th>
                <th className="text-left p-4 text-zinc-400 text-sm font-medium">Description</th>
                <th className="text-left p-4 text-zinc-400 text-sm font-medium">Category</th>
                <th className="text-right p-4 text-zinc-400 text-sm font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((tx) => (
                <tr 
                  key={tx.id} 
                  className={`hover:bg-zinc-800/50 cursor-pointer transition-colors ${selectedIds.has(tx.id) ? 'bg-emerald-500/5' : ''}`}
                  onClick={() => setSelectedTransaction(tx)}
                >
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(tx.id)}
                      onChange={() => toggleSelect(tx.id)}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                    />
                  </td>
                  <td className="p-4 text-sm whitespace-nowrap">{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  <td className="p-4">
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-zinc-500 text-xs">{tx.bank} • {tx.account}</p>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-zinc-700/50 rounded text-zinc-300 text-xs">{tx.category}</span>
                  </td>
                  <td className={`p-4 text-right font-semibold whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-400' : tx.type === 'expense' ? 'text-red-400' : 'text-blue-400'}`}>
                    <div>{tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}</div>
                    {tx.originalCurrency && (
                      <div className="text-xs text-zinc-500 font-normal">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: tx.originalCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(tx.originalAmount || 0))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-zinc-500">
            No transactions match your filters
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <TransactionDetailModal 
          transaction={selectedTransaction} 
          onClose={() => setSelectedTransaction(null)} 
        />
      )}
    </div>
  )
}

// ============================================
// TRANSACTION DETAIL MODAL
// ============================================
function TransactionDetailModal({ transaction: tx, onClose }: { transaction: Transaction; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
          <div>
            <h3 className="font-semibold text-lg">{tx.description}</h3>
            <p className="text-zinc-500 text-sm">{tx.bank} • {tx.date}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          {/* Amount */}
          <div className="text-center py-4 bg-zinc-800/30 rounded-xl">
            <p className={`text-3xl font-bold ${tx.type === 'income' ? 'text-emerald-400' : tx.type === 'expense' ? 'text-red-400' : 'text-blue-400'}`}>
              {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
            </p>
            {tx.originalCurrency && (
              <p className="text-zinc-500 mt-1">
                Original: {new Intl.NumberFormat('en-US', { style: 'currency', currency: tx.originalCurrency }).format(Math.abs(tx.originalAmount || 0))} {tx.originalCurrency}
              </p>
            )}
            {tx.balance !== undefined && (
              <p className="text-zinc-500 text-sm mt-2">
                Balance after: {formatCurrency(tx.balance)}
              </p>
            )}
          </div>

          {/* Classification */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Classification</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Type</p>
                <p className="font-medium capitalize">{tx.type}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Category</p>
                <p className="font-medium">{tx.category || 'Uncategorized'}</p>
              </div>
            </div>
          </div>

          {/* Source Details */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Source Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Bank</p>
                <p className="font-medium">{tx.bank}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Currency</p>
                <p className="font-medium">{tx.account || tx.currency || 'USD'}</p>
              </div>
              {tx.accountNumber && (
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-zinc-500 text-xs mb-1">Account #</p>
                  <p className="font-medium font-mono">{tx.accountNumber}</p>
                </div>
              )}
              {tx.transactionType && (
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-zinc-500 text-xs mb-1">Transaction Type</p>
                  <p className="font-medium">{tx.transactionType}</p>
                </div>
              )}
              {tx.status && (
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-zinc-500 text-xs mb-1">Status</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    tx.status.toUpperCase() === 'SETTLED' || tx.status.toUpperCase() === 'COMPLETED' 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {tx.status}
                  </span>
                </div>
              )}
              {tx.payee && (
                <div className="bg-zinc-800/50 rounded-lg p-3 col-span-2">
                  <p className="text-zinc-500 text-xs mb-1">Payee / Counterpart</p>
                  <p className="font-medium">{tx.payee}</p>
                </div>
              )}
            </div>
          </div>

          {/* Date & Period */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Date & Period</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Date</p>
                <p className="font-medium">{new Date(tx.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Period</p>
                <p className="font-medium">{tx.period || '-'}</p>
              </div>
            </div>
          </div>

          {/* Reference */}
          {tx.reference && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Reference / Notes</p>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-sm text-zinc-300 break-words">{tx.reference}</p>
              </div>
            </div>
          )}

          {/* Transaction ID */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">System</p>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-zinc-500 text-xs mb-1">Transaction ID</p>
              <p className="text-xs text-zinc-500 font-mono break-all">{tx.id}</p>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-zinc-800 sticky bottom-0 bg-zinc-900">
          <button
            onClick={onClose}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// PAYROLL TAB
// ============================================
function PayrollTab({ teamMembers, currentMonth, onUpdateVariable, onAddMember, onDeleteMember, loading, payrollTransactions }: { 
  teamMembers: TeamMember[]
  currentMonth: string
  onUpdateVariable: (id: string, variable: number, note: string) => void
  onAddMember: () => void
  onDeleteMember: (id: string) => void
  loading: boolean
  payrollTransactions: Transaction[]
}) {
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showTransactions, setShowTransactions] = useState(false)

  const totals = teamMembers.reduce((acc, m) => {
    const comp = m.compensation[currentMonth] || { variable: 0 }
    return { base: acc.base + m.baseSalary, variable: acc.variable + comp.variable, total: acc.total + m.baseSalary + comp.variable }
  }, { base: 0, variable: 0, total: 0 })

  // Calculate total from transactions
  const txTotal = payrollTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

  // Show skeleton while loading
  if (loading) {
    return <LoadingSkeleton />
  }

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <div 
          onClick={() => setShowTransactions(!showTransactions)}
          className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5 cursor-pointer hover:bg-blue-500/20 transition-colors"
        >
          <p className="text-blue-400/80 text-sm mb-1">From Transactions</p>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(txTotal)}</p>
            <span className="text-blue-400/60 text-sm">{payrollTransactions.length} tx</span>
          </div>
        </div>
      </div>

      {/* Payroll Transactions Section */}
      {showTransactions && payrollTransactions.length > 0 && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
            <h3 className="font-semibold">Payroll Transactions</h3>
            <button onClick={() => setShowTransactions(false)} className="text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            <div className="divide-y divide-zinc-800">
              {payrollTransactions.map((tx) => (
                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{tx.description}</p>
                    <p className="text-zinc-500 text-sm">{tx.date} • {tx.bank}</p>
                  </div>
                  <span className="text-red-400 font-semibold">-{formatCurrency(Math.abs(tx.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
              <div key={member.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center font-medium text-sm">
                    {member.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                  </div>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: `${roleColors[member.role] || '#6b7280'}20`, color: roleColors[member.role] || '#6b7280' }}>{member.role}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
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
                  <button
                    onClick={() => setConfirmDelete(member.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 rounded-lg text-zinc-400 hover:text-red-400 transition-all ml-2"
                    title="Delete member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-zinc-800">
              <h3 className="font-semibold text-lg">Delete Team Member</h3>
              <p className="text-zinc-500 text-sm mt-1">Are you sure you want to remove this person from payroll?</p>
            </div>
            <div className="p-5 flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors">
                Cancel
              </button>
              <button 
                onClick={() => { onDeleteMember(confirmDelete); setConfirmDelete(null) }} 
                className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
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
// RULES TAB
// ============================================
function RulesTab({ 
  rules, 
  onCreateRule, 
  onDeleteRule, 
  onUpdateRule, 
  transactions,
  onApplyRules,
  loading,
  categories,
  customCategories,
  onCreateCategory,
  onDeleteCategory,
  onMigrateAndDeleteCategory
}: { 
  rules: CategorizationRule[]
  onCreateRule: (keyword: string, category: string, matchType: 'contains' | 'exact' | 'starts_with') => Promise<boolean>
  onDeleteRule: (id: string) => Promise<boolean>
  onUpdateRule: (id: string, updates: Partial<CategorizationRule>) => Promise<boolean>
  transactions: Transaction[]
  onApplyRules: () => Promise<number>
  loading: boolean
  categories: { id: string; name: string; color: string }[]
  customCategories: Category[]
  onCreateCategory: (name: string, color: string) => Promise<boolean>
  onDeleteCategory: (id: string, name: string) => Promise<boolean>
  onMigrateAndDeleteCategory: (categoryName: string, newCategory: string, categoryId: string) => Promise<boolean>
}) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false)
  const [activeSection, setActiveSection] = useState<'rules' | 'categories'>('rules')
  const [searchTerm, setSearchTerm] = useState('')
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<number | null>(null)
  
  // Category deletion states
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set())
  const [migrationModal, setMigrationModal] = useState<{ categoryId: string; categoryName: string; txCount: number } | null>(null)
  const [migrationTarget, setMigrationTarget] = useState('')
  const [savingCategories, setSavingCategories] = useState(false)

  const categoryNames = categories.map(c => c.name)

  // Count how many transactions each rule would match
  const getRuleMatchCount = (rule: CategorizationRule) => {
    return transactions.filter(tx => {
      const searchText = `${tx.description} ${tx.payee || ''}`.toLowerCase()
      switch (rule.match_type) {
        case 'exact': return searchText === rule.keyword
        case 'starts_with': return searchText.startsWith(rule.keyword)
        default: return searchText.includes(rule.keyword)
      }
    }).length
  }

  // Filter rules by search
  const filteredRules = rules.filter(r => 
    r.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // All uncategorized transactions - group by description and sort by frequency
  const otherTransactions = transactions.filter(tx => tx.category === 'Other')
  
  // Group by similar descriptions (normalize and count)
  const descriptionGroups = otherTransactions.reduce((acc, tx) => {
    // Use a simplified key for grouping (lowercase, trimmed)
    const key = tx.description.toLowerCase().trim()
    if (!acc[key]) {
      acc[key] = { description: tx.description, count: 0, transactions: [] }
    }
    acc[key].count++
    acc[key].transactions.push(tx)
    return acc
  }, {} as Record<string, { description: string; count: number; transactions: Transaction[] }>)

  // Get ALL descriptions sorted by frequency (most repeated first)
  const allUncategorizedPatterns = Object.values(descriptionGroups)
    .filter(item => !rules.some(r => item.description.toLowerCase().includes(r.keyword))) // Not covered by existing rule
    .sort((a, b) => b.count - a.count)

  const handleApplyRules = async () => {
    setApplying(true)
    setApplyResult(null)
    const count = await onApplyRules()
    setApplyResult(count)
    setApplying(false)
    setTimeout(() => setApplyResult(null), 3000)
  }

  // Color options for categories
  const colorOptions = [
    { name: 'purple', class: 'bg-purple-500' },
    { name: 'cyan', class: 'bg-cyan-500' },
    { name: 'blue', class: 'bg-blue-500' },
    { name: 'amber', class: 'bg-amber-500' },
    { name: 'orange', class: 'bg-orange-500' },
    { name: 'pink', class: 'bg-pink-500' },
    { name: 'red', class: 'bg-red-500' },
    { name: 'emerald', class: 'bg-emerald-500' },
    { name: 'indigo', class: 'bg-indigo-500' },
    { name: 'teal', class: 'bg-teal-500' },
    { name: 'rose', class: 'bg-rose-500' },
    { name: 'lime', class: 'bg-lime-500' },
  ]

  const getCategoryColorClass = (color: string) => {
    return colorOptions.find(c => c.name === color)?.class || 'bg-zinc-500'
  }

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
        <button
          onClick={() => setActiveSection('rules')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSection === 'rules' 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <span className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Rules ({rules.length})
          </span>
        </button>
        <button
          onClick={() => setActiveSection('categories')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSection === 'categories' 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <span className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Categories ({categories.length})
          </span>
        </button>
      </div>

      {/* CATEGORIES SECTION */}
      {activeSection === 'categories' && (
        <>
          {/* Categories Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Categories</h2>
              <p className="text-zinc-500 text-sm">{categories.length} categories • Organize your transactions</p>
            </div>
            <div className="flex items-center gap-3">
              {pendingDeletions.size > 0 && (
                <button
                  onClick={async () => {
                    setSavingCategories(true)
                    for (const catName of pendingDeletions) {
                      const cat = categories.find(c => c.name === catName)
                      if (cat) {
                        await onDeleteCategory(cat.id, cat.name)
                      }
                    }
                    setPendingDeletions(new Set())
                    setSavingCategories(false)
                  }}
                  disabled={savingCategories}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {savingCategories ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete {pendingDeletions.size} Categories
                </button>
              )}
              {pendingDeletions.size > 0 && (
                <button
                  onClick={() => setPendingDeletions(new Set())}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => setShowCreateCategoryModal(true)}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <Plus className="w-5 h-5" />
                New Category
              </button>
            </div>
          </div>

          {/* Info about protected categories */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm">
            <p className="text-blue-400">
              <strong>Payroll</strong> and <strong>Other</strong> are protected categories and cannot be deleted. 
              Payroll is linked to the Payroll tab.
            </p>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => {
              const txCount = transactions.filter(tx => tx.category === cat.name).length
              const isProtected = cat.name === 'Other' || cat.name === 'Payroll'
              const isPendingDelete = pendingDeletions.has(cat.name)
              
              return (
                <div 
                  key={cat.id} 
                  className={`bg-zinc-800/50 border rounded-xl p-4 transition-all group ${
                    isPendingDelete 
                      ? 'border-red-500/50 bg-red-500/10' 
                      : isProtected 
                        ? 'border-zinc-700 opacity-80' 
                        : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-4 h-4 rounded-full ${getCategoryColorClass(cat.color)}`} />
                    <span className="font-medium flex-1">{cat.name}</span>
                    {isProtected ? (
                      <span className="text-xs text-zinc-500 px-2 py-0.5 bg-zinc-700 rounded">Protected</span>
                    ) : isPendingDelete ? (
                      <button
                        onClick={() => {
                          setPendingDeletions(prev => {
                            const next = new Set(prev)
                            next.delete(cat.name)
                            return next
                          })
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          // Check if category has transactions
                          if (txCount > 0) {
                            setMigrationModal({ categoryId: cat.id, categoryName: cat.name, txCount })
                            setMigrationTarget('')
                          } else {
                            setPendingDeletions(prev => new Set([...prev, cat.name]))
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg text-zinc-400 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className={`text-sm ${isPendingDelete ? 'text-red-400 line-through' : 'text-zinc-500'}`}>
                    {txCount} transactions
                    {cat.name === 'Payroll' && ' • Linked to Payroll tab'}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Migration Modal */}
          {migrationModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setMigrationModal(null)}>
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-zinc-800">
                  <h3 className="text-lg font-semibold">Migrate Transactions</h3>
                  <p className="text-zinc-500 text-sm mt-1">
                    "{migrationModal.categoryName}" has <strong>{migrationModal.txCount}</strong> transactions. 
                    Select a new category before deleting.
                  </p>
                </div>
                
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">Move transactions to:</label>
                    <div className="relative">
                      <select
                        value={migrationTarget}
                        onChange={(e) => setMigrationTarget(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                      >
                        <option value="">Select category...</option>
                        {categories
                          .filter(c => c.name !== migrationModal.categoryName)
                          .map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="p-5 border-t border-zinc-800 flex gap-3">
                  <button 
                    onClick={() => setMigrationModal(null)} 
                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      if (!migrationTarget) return
                      setSavingCategories(true)
                      const success = await onMigrateAndDeleteCategory(
                        migrationModal.categoryName,
                        migrationTarget,
                        migrationModal.categoryId
                      )
                      setSavingCategories(false)
                      if (success) {
                        setMigrationModal(null)
                      }
                    }}
                    disabled={!migrationTarget || savingCategories}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingCategories && <Loader2 className="w-4 h-4 animate-spin" />}
                    Migrate & Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create Category Modal */}
          {showCreateCategoryModal && (
            <CreateCategoryModal
              onClose={() => setShowCreateCategoryModal(false)}
              onSave={async (name, color) => {
                const success = await onCreateCategory(name, color)
                if (success) setShowCreateCategoryModal(false)
              }}
              colorOptions={colorOptions}
              existingCategories={categoryNames}
            />
          )}
        </>
      )}

      {/* RULES SECTION */}
      {activeSection === 'rules' && (
        <>
          {/* Rules Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Categorization Rules</h2>
              <p className="text-zinc-500 text-sm">{rules.length} rules • Auto-categorize transactions based on keywords</p>
            </div>
            <div className="flex items-center gap-3">
              {applyResult !== null && (
                <span className="text-emerald-400 text-sm animate-pulse">
                  {applyResult > 0 ? `Updated ${applyResult} transactions` : 'No transactions to update'}
                </span>
              )}
              <button
                onClick={handleApplyRules}
                disabled={applying || rules.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Apply to Existing
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <Plus className="w-5 h-5" />
                New Rule
              </button>
            </div>
          </div>

      {/* Suggested Patterns */}
      {allUncategorizedPatterns.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-amber-400">Uncategorized Transactions</h3>
            <span className="text-zinc-500 text-sm ml-auto">{otherTransactions.length} total • sorted by frequency</span>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {allUncategorizedPatterns.map((item) => (
              <button
                key={item.description}
                onClick={() => {
                  setShowCreateModal(true)
                  // Pre-fill the keyword with full description
                  setTimeout(() => {
                    const input = document.getElementById('rule-keyword') as HTMLInputElement
                    if (input) input.value = item.description.toLowerCase()
                  }, 100)
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm transition-colors text-left"
              >
                <span className="font-medium truncate flex-1">{item.description}</span>
                <span className={`whitespace-nowrap px-2 py-0.5 rounded text-xs ${
                  item.count > 5 ? 'bg-red-500/20 text-red-400' :
                  item.count > 2 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-zinc-700 text-zinc-400'
                }`}>
                  {item.count}x
                </span>
                <Plus className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          placeholder="Search rules..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-zinc-600"
        />
      </div>

      {/* Rules List */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
          <div className="col-span-4">Keyword</div>
          <div className="col-span-2">Match Type</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2 text-right">Matches</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Rules */}
        {filteredRules.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 font-medium mb-2">No rules yet</p>
            <p className="text-zinc-600 text-sm mb-4">Create rules to auto-categorize your transactions</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Create First Rule
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filteredRules.map((rule) => {
              const matchCount = getRuleMatchCount(rule)
              return (
                <div key={rule.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-zinc-800/50 transition-colors">
                  <div className="col-span-4">
                    <span className="font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                      {rule.keyword}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-zinc-400 text-sm capitalize">{rule.match_type.replace('_', ' ')}</span>
                  </div>
                  <div className="col-span-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      rule.category === 'Ads' ? 'bg-purple-500/20 text-purple-400' :
                      rule.category === 'Software' ? 'bg-cyan-500/20 text-cyan-400' :
                      rule.category === 'Payroll' ? 'bg-blue-500/20 text-blue-400' :
                      rule.category === 'Fees' ? 'bg-amber-500/20 text-amber-400' :
                      rule.category === 'Shipping' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {rule.category}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={`text-sm ${matchCount > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {matchCount} transactions
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <button
                      onClick={() => onDeleteRule(rule.id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <CreateRuleModal
          onClose={() => setShowCreateModal(false)}
          onSave={async (keyword, category, matchType) => {
            const success = await onCreateRule(keyword, category, matchType)
            if (success) setShowCreateModal(false)
          }}
          categories={categoryNames}
        />
      )}
      </>
      )}
    </div>
  )
}

// Create Category Modal
function CreateCategoryModal({ 
  onClose, 
  onSave, 
  colorOptions,
  existingCategories
}: { 
  onClose: () => void
  onSave: (name: string, color: string) => void
  colorOptions: { name: string; class: string }[]
  existingCategories: string[]
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('purple')
  const [error, setError] = useState('')

  const handleSave = () => {
    if (!name.trim()) {
      setError('Category name is required')
      return
    }
    if (existingCategories.some(c => c.toLowerCase() === name.toLowerCase())) {
      setError('Category already exists')
      return
    }
    onSave(name.trim(), color)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create Category</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Category Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              placeholder="e.g., Marketing, Inventory, Legal"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-zinc-400 text-sm mb-2">Color</label>
            <div className="grid grid-cols-6 gap-2">
              {colorOptions.map((opt) => (
                <button
                  key={opt.name}
                  onClick={() => setColor(opt.name)}
                  className={`w-10 h-10 rounded-lg ${opt.class} transition-all ${
                    color === opt.name 
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' 
                      : 'hover:scale-105'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <p className="text-zinc-500 text-xs mb-2">Preview</p>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${colorOptions.find(c => c.name === color)?.class}`} />
              <span className="font-medium">{name || 'Category Name'}</span>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-zinc-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Category
          </button>
        </div>
      </div>
    </div>
  )
}

// Create Rule Modal
function CreateRuleModal({ 
  onClose, 
  onSave, 
  categories,
  initialKeyword = ''
}: { 
  onClose: () => void
  onSave: (keyword: string, category: string, matchType: 'contains' | 'exact' | 'starts_with') => void
  categories: string[]
  initialKeyword?: string
}) {
  const [keyword, setKeyword] = useState(initialKeyword)
  const [category, setCategory] = useState('Other')
  const [matchType, setMatchType] = useState<'contains' | 'exact' | 'starts_with'>('contains')

  // Sort categories with Other always last
  const sortedCategories = [...categories.filter(c => c !== 'Other'), 'Other']

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create Rule</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Keyword</label>
            <input
              id="rule-keyword"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g., klaviyo, facebook, stripe"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <p className="text-zinc-600 text-xs mt-1">Case-insensitive match on description and payee</p>
          </div>

          <div>
            <label className="block text-zinc-400 text-sm mb-2">Match Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['contains', 'starts_with', 'exact'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setMatchType(type)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    matchType === type 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  {type === 'contains' ? 'Contains' : type === 'starts_with' ? 'Starts with' : 'Exact'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 text-sm mb-2">Category</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
              >
                {sortedCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-zinc-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors">
            Cancel
          </button>
          <button 
            onClick={() => onSave(keyword, category, matchType)}
            disabled={!keyword.trim()}
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Rule
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN DASHBOARD
// ============================================
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'payroll' | 'rules'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zoop-active-tab')
      if (saved === 'overview' || saved === 'transactions' || saved === 'payroll' || saved === 'rules') return saved
    }
    return 'overview'
  })
  const [selectedYear, setSelectedYear] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zoop-selected-year')
      return saved ? parseInt(saved) : currentYear
    }
    return currentYear
  })
  const [selectedMonths, setSelectedMonths] = useState<number[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zoop-selected-months')
      return saved ? JSON.parse(saved) : [currentMonthIndex]
    }
    return [currentMonthIndex]
  })
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [statements, setStatements] = useState<{ id: string; filename: string; bank: string; period: string; transactions_count: number; created_at: string }[]>([])
  const [categorizationRules, setCategorizationRules] = useState<CategorizationRule[]>([])
  const [customCategories, setCustomCategories] = useState<Category[]>([])
  const [hiddenCategories, setHiddenCategories] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zoop-hidden-categories')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [showManageDataModal, setShowManageDataModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Persist hidden categories to localStorage
  useEffect(() => {
    localStorage.setItem('zoop-hidden-categories', JSON.stringify(hiddenCategories))
  }, [hiddenCategories])

  // Default categories with colors
  const defaultCategories = [
    { id: 'default-ads', name: 'Ads', color: 'purple' },
    { id: 'default-software', name: 'Software', color: 'cyan' },
    { id: 'default-payroll', name: 'Payroll', color: 'blue' },
    { id: 'default-fees', name: 'Fees', color: 'amber' },
    { id: 'default-shipping', name: 'Shipping', color: 'orange' },
    { id: 'default-products', name: 'Products', color: 'pink' },
    { id: 'default-taxes', name: 'Taxes', color: 'red' },
    { id: 'default-operations', name: 'Operations', color: 'indigo' },
    { id: 'default-refunds', name: 'Refunds', color: 'emerald' },
    { id: 'default-other', name: 'Other', color: 'zinc' },
  ]

  // All categories (default + custom), filtered by hidden
  const allCategories = [...defaultCategories, ...customCategories].filter(c => !hiddenCategories.includes(c.name))

  const supabase = createClient()

  // Month names
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const currentMonthStr = `${monthNamesShort[currentMonthIndex]} ${currentYear}`

  // Persist selected period to localStorage
  useEffect(() => {
    localStorage.setItem('zoop-active-tab', activeTab)
  }, [activeTab])

  useEffect(() => {
    localStorage.setItem('zoop-selected-year', selectedYear.toString())
  }, [selectedYear])

  useEffect(() => {
    localStorage.setItem('zoop-selected-months', JSON.stringify(selectedMonths))
  }, [selectedMonths])

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
        const mapped = allTransactions.map(tx => ({
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
          period: tx.period,
          // Extended fields
          payee: tx.payee || undefined,
          accountNumber: tx.account_number || undefined,
          transactionType: tx.transaction_type || undefined,
          status: tx.status || undefined,
          balance: tx.balance ? parseFloat(tx.balance) : undefined
        }))
        
        setTransactions(mapped)
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

      // Load categorization rules
      const { data: rulesData, error: rulesError } = await (supabase
        .from('categorization_rules') as any)
        .select('*')
        .order('priority', { ascending: false })
      
      if (!rulesError && rulesData) {
        setCategorizationRules(rulesData as CategorizationRule[])
      }

      // Load custom categories
      const { data: catData, error: catError } = await (supabase
        .from('categories') as any)
        .select('*')
        .order('name', { ascending: true })
      
      if (!catError && catData) {
        setCustomCategories(catData as Category[])
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
        period: tx.period || period,
        // Extended fields
        payee: tx.payee || null,
        account_number: tx.accountNumber || null,
        transaction_type: tx.transactionType || null,
        status: tx.status || null,
        balance: tx.balance || null
      }))

      // Delete existing transactions for this period AND bank only (to allow multiple banks)
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('period', period)
        .eq('bank', bank)
      
      if (deleteError) {
        console.error('Error deleting existing transactions:', deleteError)
        // Continue anyway - might be first import
      }

      // Insert in batches of 100 to avoid payload limits
      const batchSize = 100
      for (let i = 0; i < txToInsert.length; i += batchSize) {
        const batch = txToInsert.slice(i, i + batchSize)
        const { error: txError } = await supabase
          .from('transactions')
          .insert(batch as any)

        if (txError) {
          console.error(`Error saving batch ${i / batchSize + 1}:`, txError)
          throw txError
        }
      }

      // Record the statement (delete existing first)
      await supabase
        .from('statements')
        .delete()
        .eq('filename', filename)
      
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

  const handleDeleteMember = async (memberId: string) => {
    // Delete compensation records first
    await (supabase
      .from('compensation') as any)
      .delete()
      .eq('member_id', memberId)
    
    // Delete team member
    const { error } = await (supabase
      .from('team_members') as any)
      .delete()
      .eq('id', memberId)
    
    if (error) {
      console.error('Error deleting team member:', error)
    } else {
      setTeamMembers(prev => prev.filter(m => m.id !== memberId))
    }
  }

  // ============================================
  // CATEGORIZATION RULES MANAGEMENT
  // ============================================
  const handleCreateRule = async (keyword: string, category: string, matchType: 'contains' | 'exact' | 'starts_with' = 'contains') => {
    const newRule: CategorizationRule = {
      id: crypto.randomUUID(),
      keyword: keyword.toLowerCase().trim(),
      category,
      match_type: matchType,
      priority: categorizationRules.length + 1
    }
    
    const { error } = await (supabase
      .from('categorization_rules') as any)
      .insert(newRule)
    
    if (error) {
      console.error('Error creating rule:', error)
      return false
    }
    
    setCategorizationRules(prev => [...prev, newRule])
    return true
  }

  const handleDeleteRule = async (ruleId: string) => {
    const { error } = await (supabase
      .from('categorization_rules') as any)
      .delete()
      .eq('id', ruleId)
    
    if (error) {
      console.error('Error deleting rule:', error)
      return false
    }
    
    setCategorizationRules(prev => prev.filter(r => r.id !== ruleId))
    return true
  }

  const handleUpdateRule = async (ruleId: string, updates: Partial<CategorizationRule>) => {
    const { error } = await (supabase
      .from('categorization_rules') as any)
      .update(updates)
      .eq('id', ruleId)
    
    if (error) {
      console.error('Error updating rule:', error)
      return false
    }
    
    setCategorizationRules(prev => prev.map(r => r.id === ruleId ? { ...r, ...updates } : r))
    return true
  }

  // Apply rules to existing transactions (retroactive)
  const handleApplyRulesToExisting = async () => {
    if (categorizationRules.length === 0) return 0
    
    setSaving(true)
    let updatedCount = 0
    
    try {
      // Get all transactions that could be re-categorized
      const txsToUpdate = transactions.filter(tx => {
        // Check if any rule matches
        const matchingRule = categorizationRules.find(rule => {
          const searchText = `${tx.description} ${tx.payee || ''}`.toLowerCase()
          switch (rule.match_type) {
            case 'exact': return searchText === rule.keyword
            case 'starts_with': return searchText.startsWith(rule.keyword)
            default: return searchText.includes(rule.keyword)
          }
        })
        // Only update if a rule matches AND current category is different
        return matchingRule && tx.category !== matchingRule.category
      })
      
      // Update each matching transaction
      for (const tx of txsToUpdate) {
        const matchingRule = categorizationRules.find(rule => {
          const searchText = `${tx.description} ${tx.payee || ''}`.toLowerCase()
          switch (rule.match_type) {
            case 'exact': return searchText === rule.keyword
            case 'starts_with': return searchText.startsWith(rule.keyword)
            default: return searchText.includes(rule.keyword)
          }
        })
        
        if (matchingRule) {
          const { error } = await (supabase
            .from('transactions') as any)
            .update({ category: matchingRule.category })
            .eq('id', tx.id)
          
          if (!error) {
            updatedCount++
          }
        }
      }
      
      // Reload data to reflect changes
      if (updatedCount > 0) {
        await loadData()
      }
    } catch (err) {
      console.error('Error applying rules:', err)
    } finally {
      setSaving(false)
    }
    
    return updatedCount
  }

  // Bulk update transaction categories and optionally create a rule
  const handleBulkUpdateCategory = async (transactionIds: string[], category: string, createRule?: { keyword: string }) => {
    setSaving(true)
    try {
      // Update all selected transactions
      for (const txId of transactionIds) {
        await (supabase
          .from('transactions') as any)
          .update({ category })
          .eq('id', txId)
      }

      // Create rule if keyword provided
      if (createRule?.keyword) {
        const newRule: CategorizationRule = {
          id: crypto.randomUUID(),
          keyword: createRule.keyword.toLowerCase().trim(),
          category,
          match_type: 'contains',
          priority: categorizationRules.length + 1
        }
        
        await (supabase
          .from('categorization_rules') as any)
          .insert(newRule)
        
        setCategorizationRules(prev => [...prev, newRule])
      }

      // Reload data
      await loadData()
      return true
    } catch (err) {
      console.error('Error bulk updating:', err)
      return false
    } finally {
      setSaving(false)
    }
  }

  // ============================================
  // CATEGORY MANAGEMENT
  // ============================================
  const handleCreateCategory = async (name: string, color: string) => {
    // Check if category already exists
    if (allCategories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      return false
    }

    const newCategory: Category = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color
    }
    
    const { error } = await (supabase
      .from('categories') as any)
      .insert(newCategory)
    
    if (error) {
      console.error('Error creating category:', error)
      return false
    }
    
    setCustomCategories(prev => [...prev, newCategory])
    return true
  }

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    // For default categories, just hide them
    if (categoryId.startsWith('default-')) {
      setHiddenCategories(prev => [...prev, categoryName])
      return true
    }

    // For custom categories, delete from Supabase
    const { error } = await (supabase
      .from('categories') as any)
      .delete()
      .eq('id', categoryId)
    
    if (error) {
      console.error('Error deleting category:', error)
      return false
    }
    
    setCustomCategories(prev => prev.filter(c => c.id !== categoryId))
    return true
  }

  // Migrate transactions to new category and then delete the old category
  const handleMigrateAndDeleteCategory = async (categoryName: string, newCategory: string, categoryId: string) => {
    setSaving(true)
    try {
      // Update all transactions with this category to new category
      const { error: updateError } = await (supabase
        .from('transactions') as any)
        .update({ category: newCategory })
        .eq('category', categoryName)
      
      if (updateError) {
        console.error('Error migrating transactions:', updateError)
        return false
      }

      // Delete the category
      const deleted = await handleDeleteCategory(categoryId, categoryName)
      
      if (deleted) {
        // Reload data to reflect changes
        await loadData()
      }
      
      return deleted
    } catch (err) {
      console.error('Error in migrate and delete:', err)
      return false
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions' as const, label: 'Transactions', icon: Receipt },
    { id: 'payroll' as const, label: 'Payroll', icon: Users },
    { id: 'rules' as const, label: 'Rules', icon: Tag },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />
      
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-zinc-950/80 backdrop-blur-xl border-r border-zinc-800 z-40 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center font-bold text-xl">Z</div>
            <span className="text-xl font-bold">Zoop Finance</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <p className="text-xs text-zinc-500 uppercase tracking-wider px-3 mb-3">Menu</p>
          {tabs.map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-zinc-800 space-y-2">
          <button 
            onClick={() => setShowManageDataModal(true)} 
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
          >
            <Calendar className="w-5 h-5" />
            Manage Data
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-64 relative z-10">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold">{getPeriodLabel()}</h1>
                <p className="text-zinc-500 text-sm">
                  {loading ? 'Loading...' : filteredTransactions.length > 0 
                    ? `${filteredTransactions.length} transactions • ${formatCurrency(aggregatedData.profit)} profit`
                    : 'No data for this period'
                  }
                </p>
              </div>
              {(loading || saving) && (
                <div className="flex items-center gap-2 text-zinc-500 text-sm">
                  <div className="w-4 h-4 border-2 border-zinc-600 border-t-emerald-500 rounded-full animate-spin" />
                  {saving ? 'Saving...' : ''}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <PeriodSelector selectedYear={selectedYear} setSelectedYear={setSelectedYear} selectedMonths={selectedMonths} setSelectedMonths={setSelectedMonths} />
              <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-4 py-2.5 rounded-xl transition-colors">
                <Upload className="w-5 h-5" />Upload
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {activeTab === 'overview' && <OverviewTab data={aggregatedData} transactions={filteredTransactions} onUpload={() => setShowUploadModal(true)} loading={loading} categorizationRules={categorizationRules} onCreateRule={handleCreateRule} onApplyRules={handleApplyRulesToExisting} allCategories={allCategories} onBulkUpdateCategory={handleBulkUpdateCategory} />}
          {activeTab === 'transactions' && <TransactionsTab transactions={filteredTransactions} onUpload={() => setShowUploadModal(true)} selectedYear={selectedYear} selectedMonths={selectedMonths} loading={loading} />}
          {activeTab === 'payroll' && <PayrollTab teamMembers={teamMembers} currentMonth={getPayrollMonth()} onUpdateVariable={handleUpdateVariable} onAddMember={() => setShowAddMemberModal(true)} onDeleteMember={handleDeleteMember} loading={loading} payrollTransactions={filteredTransactions.filter(tx => tx.category === 'Payroll')} />}
          {activeTab === 'rules' && <RulesTab rules={categorizationRules} onCreateRule={handleCreateRule} onDeleteRule={handleDeleteRule} onUpdateRule={handleUpdateRule} transactions={transactions} onApplyRules={handleApplyRulesToExisting} loading={loading} categories={allCategories} customCategories={customCategories} onCreateCategory={handleCreateCategory} onDeleteCategory={handleDeleteCategory} onMigrateAndDeleteCategory={handleMigrateAndDeleteCategory} />}
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
  // Platform Fees (Shopify, Stripe fees - when expense)
  { pattern: /shopify/i, category: 'Fees' },
  { pattern: /stripe fee|stripe.com/i, category: 'Fees' },
  { pattern: /paypal fee/i, category: 'Fees' },
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
    const accountNumIdx = headers.indexOf('account #')
    const txTypeIdx = headers.indexOf('transaction type')
    const descIdx = headers.indexOf('description')
    const refIdx = headers.indexOf('reference')
    const statusIdx = headers.indexOf('status')
    const amountIdx = headers.indexOf('amount')
    const currencyIdx = headers.indexOf('currency')
    const balanceIdx = headers.indexOf('balance')
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length < 2) continue
      
      const amountStr = values[amountIdx] || '0'
      const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0
      if (amount === 0) continue
      
      const payee = values[payeeIdx] || ''
      const accountNum = values[accountNumIdx] || ''
      const txType = values[txTypeIdx] || ''
      const rawDesc = values[descIdx] || ''
      const reference = values[refIdx] || ''
      const status = values[statusIdx] || ''
      const balanceStr = values[balanceIdx] || ''
      const balance = parseFloat(balanceStr.replace(/[^0-9.-]/g, '')) || undefined
      
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
        id: crypto.randomUUID(),
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
        originalCurrency: originalCurrency !== 'USD' ? originalCurrency : undefined,
        // Extended fields
        payee: payee || undefined,
        accountNumber: accountNum || undefined,
        transactionType: txType || undefined,
        status: status || undefined,
        balance: balance
      })
    }
  } else if (isRevolut) {
    // Revolut format: Date started,Date completed,ID,Type,State,Description,Reference,...,Amount,...,Beneficiary account number,Beneficiary name,...
    const dateIdx = headers.findIndex(h => h.includes('date completed') || h.includes('date started'))
    const idIdx = headers.indexOf('id')
    const typeIdx = headers.indexOf('type')
    const stateIdx = headers.indexOf('state')
    const descIdx = headers.indexOf('description')
    const refIdx = headers.indexOf('reference')
    const amountIdx = headers.indexOf('amount')
    const currencyIdx = headers.indexOf('payment currency') !== -1 ? headers.indexOf('payment currency') : headers.indexOf('currency')
    const balanceIdx = headers.indexOf('balance')
    const beneficiaryIdx = headers.indexOf('beneficiary account number')
    const beneficiaryNameIdx = headers.indexOf('beneficiary name')
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length < 5) continue
      
      const amountStr = values[amountIdx] || '0'
      const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0
      if (amount === 0) continue
      
      const revolut_type = (values[typeIdx] || '').toUpperCase()
      const rawDesc = values[descIdx] || ''
      const reference = refIdx >= 0 ? values[refIdx] || '' : ''
      const state = stateIdx >= 0 ? values[stateIdx] || '' : ''
      const beneficiaryAccount = beneficiaryIdx >= 0 ? values[beneficiaryIdx]?.trim() : ''
      const beneficiaryName = beneficiaryNameIdx >= 0 ? values[beneficiaryNameIdx]?.trim() : ''
      const balanceStr = balanceIdx >= 0 ? values[balanceIdx] || '' : ''
      const balance = parseFloat(balanceStr.replace(/[^0-9.-]/g, '')) || undefined
      
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
        id: crypto.randomUUID(),
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
        originalCurrency: originalCurrency !== 'USD' ? originalCurrency : undefined,
        // Extended fields
        payee: beneficiaryName || undefined,
        accountNumber: beneficiaryAccount || undefined,
        transactionType: revolut_type || undefined,
        status: state || undefined,
        balance: balance
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
        id: crypto.randomUUID(),
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
  const [importing, setImporting] = useState(false)
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
      
      // Auto-detect period from filename (e.g., Relay_2025-11-01 → November 2025)
      const firstFile = droppedFiles[0]
      const dateMatch = firstFile.name.match(/(\d{4})-(\d{2})-\d{2}/)
      if (dateMatch) {
        const [_, year, month] = dateMatch
        setSelectedYear(parseInt(year))
        setSelectedMonth(parseInt(month) - 1) // 0-indexed
      }
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
      
      // Auto-detect period from filename (e.g., Relay_2025-11-01 → November 2025)
      const firstFile = selectedFiles[0]
      const dateMatch = firstFile.name.match(/(\d{4})-(\d{2})-\d{2}/)
      if (dateMatch) {
        const [_, year, month] = dateMatch
        setSelectedYear(parseInt(year))
        setSelectedMonth(parseInt(month) - 1) // 0-indexed
      }
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
      const incomeTransactions = allTransactions.filter(t => t.type === 'income')
      const expenseTransactions = allTransactions.filter(t => t.type === 'expense')
      const internalTransactions = allTransactions.filter(t => t.type === 'internal')
      
      const income = incomeTransactions.reduce((s, t) => s + t.amount, 0)
      const expenses = expenseTransactions.reduce((s, t) => s + Math.abs(t.amount), 0)
      
      setAnalysisResult({
        transactions: allTransactions,
        summary: {
          total: allTransactions.length,
          income,
          expenses,
          incomeCount: incomeTransactions.length,
          expenseCount: expenseTransactions.length,
          internalCount: internalTransactions.length,
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
      setImporting(true)
      const period = `${monthNamesShort[selectedMonth]} ${selectedYear}`
      // Small delay to show loading state before heavy operation
      setTimeout(() => {
        onUploadComplete(analysisResult.transactions, period, files)
      }, 100)
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
              Zoop AI Analysis
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5 text-zinc-400" /></button>
        </div>
        
        <div className="p-5 space-y-4">
          {/* Period Selector */}
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Statement Period</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={selectedMonth}
                  onChange={(e) => { setSelectedMonth(parseInt(e.target.value)); setAnalysisResult(null); setFiles([]) }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:border-emerald-500 cursor-pointer appearance-none"
                >
                  {monthNames.map((month, idx) => (
                    <option key={month} value={idx}>{month}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              </div>
              <div className="relative w-28">
                <select
                  value={selectedYear}
                  onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setAnalysisResult(null); setFiles([]) }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:border-emerald-500 cursor-pointer appearance-none"
                >
                  {[2023, 2024, 2025, 2026].map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              </div>
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
                  <Check className="w-4 h-4 text-black" strokeWidth={3} />
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
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Importing Overlay */}
          {importing && (
            <div className="absolute inset-0 bg-zinc-900/95 flex flex-col items-center justify-center rounded-2xl">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
              <p className="text-lg font-semibold">Importing transactions...</p>
              <p className="text-zinc-500 text-sm mt-1">This may take a moment</p>
            </div>
          )}

          {/* Action Buttons */}
          {analysisResult && !importing && (
            <div className="pt-2">
              <button
                onClick={confirmImport}
                disabled={importing}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
