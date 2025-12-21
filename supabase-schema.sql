-- =============================================
-- ZOOP FINANCE - SUPABASE SCHEMA
-- =============================================
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TEAM MEMBERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  type TEXT DEFAULT 'contractor' CHECK (type IN ('contractor', 'employee')),
  base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  start_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- COMPENSATION TABLE (monthly payroll records)
-- =============================================
CREATE TABLE IF NOT EXISTS compensation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- 'Jan', 'Feb', etc
  year INTEGER NOT NULL,
  base_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  variable_amount DECIMAL(12,2) DEFAULT 0,
  note TEXT,
  paid BOOLEAN DEFAULT FALSE,
  paid_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, month, year)
);

-- =============================================
-- BANK ACCOUNTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL, -- 'Revolut', 'Relay', 'Mercury', etc
  account_name TEXT NOT NULL, -- 'USD Main', 'GBP Main', '#4264'
  account_identifier TEXT, -- IBAN or account number
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TRANSACTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  external_id TEXT, -- Original transaction ID from bank
  date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'internal', 'exchange')),
  category TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'matched', 'ignored')),
  matched_transaction_id UUID REFERENCES transactions(id),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MONTHLY REPORTS TABLE (cached calculations)
-- =============================================
CREATE TABLE IF NOT EXISTS monthly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  total_income DECIMAL(12,2) DEFAULT 0,
  total_expenses DECIMAL(12,2) DEFAULT 0,
  total_payroll DECIMAL(12,2) DEFAULT 0,
  net_profit DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

-- =============================================
-- STATEMENTS TABLE (uploaded files)
-- =============================================
CREATE TABLE IF NOT EXISTS statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  month TEXT,
  year INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  transactions_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_compensation_member ON compensation(member_id);
CREATE INDEX IF NOT EXISTS idx_compensation_period ON compensation(year, month);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_bank ON transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_statements_user ON statements(user_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;

-- Team Members policies
CREATE POLICY "Users can view own team members" ON team_members
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own team members" ON team_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own team members" ON team_members
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY "Users can delete own team members" ON team_members
  FOR DELETE USING (auth.uid() = user_id);

-- Compensation policies
CREATE POLICY "Users can view own compensation" ON compensation
  FOR SELECT USING (
    member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
  );
  
CREATE POLICY "Users can insert own compensation" ON compensation
  FOR INSERT WITH CHECK (
    member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
  );
  
CREATE POLICY "Users can update own compensation" ON compensation
  FOR UPDATE USING (
    member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own compensation" ON compensation
  FOR DELETE USING (
    member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
  );

-- Bank Accounts policies
CREATE POLICY "Users can view own bank accounts" ON bank_accounts
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own bank accounts" ON bank_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own bank accounts" ON bank_accounts
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY "Users can delete own bank accounts" ON bank_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Monthly Reports policies
CREATE POLICY "Users can view own reports" ON monthly_reports
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can manage own reports" ON monthly_reports
  FOR ALL USING (auth.uid() = user_id);

-- Statements policies
CREATE POLICY "Users can view own statements" ON statements
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can manage own statements" ON statements
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_compensation_updated_at
  BEFORE UPDATE ON compensation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_monthly_reports_updated_at
  BEFORE UPDATE ON monthly_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- STORAGE BUCKET FOR STATEMENTS
-- =============================================
-- Run this separately in Supabase Dashboard > Storage

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('statements', 'statements', false);

-- CREATE POLICY "Users can upload own statements"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'statements' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view own statements"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'statements' AND auth.uid()::text = (storage.foldername(name))[1]);
