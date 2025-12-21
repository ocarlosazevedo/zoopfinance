export type Database = {
  public: {
    Tables: {
      team_members: {
        Row: {
          id: string
          user_id: string
          name: string
          role: string
          type: 'contractor' | 'employee'
          base_salary: number
          currency: string
          start_date: string
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          role: string
          type?: 'contractor' | 'employee'
          base_salary: number
          currency?: string
          start_date: string
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          role?: string
          type?: 'contractor' | 'employee'
          base_salary?: number
          currency?: string
          start_date?: string
          status?: 'active' | 'inactive'
          updated_at?: string
        }
      }
      compensation: {
        Row: {
          id: string
          member_id: string
          month: string
          year: number
          base_amount: number
          variable_amount: number
          note: string | null
          paid: boolean
          paid_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          member_id: string
          month: string
          year: number
          base_amount: number
          variable_amount?: number
          note?: string | null
          paid?: boolean
          paid_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          month?: string
          year?: number
          base_amount?: number
          variable_amount?: number
          note?: string | null
          paid?: boolean
          paid_date?: string | null
          updated_at?: string
        }
      }
      bank_accounts: {
        Row: {
          id: string
          user_id: string
          bank_name: string
          account_name: string
          account_identifier: string
          currency: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bank_name: string
          account_name: string
          account_identifier?: string
          currency?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          bank_name?: string
          account_name?: string
          account_identifier?: string
          currency?: string
          is_active?: boolean
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          bank_account_id: string
          external_id: string | null
          date: string
          description: string
          reference: string | null
          amount: number
          currency: string
          type: 'income' | 'expense' | 'internal' | 'exchange'
          category: string | null
          status: 'completed' | 'pending' | 'matched' | 'ignored'
          matched_transaction_id: string | null
          raw_data: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bank_account_id: string
          external_id?: string | null
          date: string
          description: string
          reference?: string | null
          amount: number
          currency?: string
          type: 'income' | 'expense' | 'internal' | 'exchange'
          category?: string | null
          status?: 'completed' | 'pending' | 'matched' | 'ignored'
          matched_transaction_id?: string | null
          raw_data?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          bank_account_id?: string
          external_id?: string | null
          date?: string
          description?: string
          reference?: string | null
          amount?: number
          currency?: string
          type?: 'income' | 'expense' | 'internal' | 'exchange'
          category?: string | null
          status?: 'completed' | 'pending' | 'matched' | 'ignored'
          matched_transaction_id?: string | null
          raw_data?: Record<string, unknown> | null
        }
      }
      monthly_reports: {
        Row: {
          id: string
          user_id: string
          month: string
          year: number
          total_income: number
          total_expenses: number
          total_payroll: number
          net_profit: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month: string
          year: number
          total_income?: number
          total_expenses?: number
          total_payroll?: number
          net_profit?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          total_income?: number
          total_expenses?: number
          total_payroll?: number
          net_profit?: number
          updated_at?: string
        }
      }
    }
  }
}

// Utility types
export type TeamMember = Database['public']['Tables']['team_members']['Row']
export type Compensation = Database['public']['Tables']['compensation']['Row']
export type BankAccount = Database['public']['Tables']['bank_accounts']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']
export type MonthlyReport = Database['public']['Tables']['monthly_reports']['Row']
