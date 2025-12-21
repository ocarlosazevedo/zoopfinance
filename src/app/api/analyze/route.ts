import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Fallback parser caso AI falhe
function fallbackParser(csvContent: string, fileName: string): any[] {
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const transactions: any[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    
    for (const char of lines[i]) {
      if (char === '"') inQuotes = !inQuotes
      else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/"/g, ''))
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim().replace(/"/g, ''))
    
    if (values.length < 2) continue

    // Try to find date, description, amount columns
    const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('completed'))
    const descIdx = headers.findIndex(h => h.includes('description') || h.includes('memo') || h.includes('name'))
    const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('value') || h.includes('sum'))
    const currencyIdx = headers.findIndex(h => h.includes('currency'))

    const amount = parseFloat((values[amountIdx >= 0 ? amountIdx : 2] || '0').replace(/[^0-9.-]/g, '')) || 0
    if (amount === 0) continue

    const isRelay = fileName.toLowerCase().includes('relay')
    const isRevolut = fileName.toLowerCase().includes('revolut') || headers.includes('type')

    transactions.push({
      date: values[dateIdx >= 0 ? dateIdx : 0]?.split(' ')[0] || new Date().toISOString().split('T')[0],
      description: values[descIdx >= 0 ? descIdx : 1] || 'Transaction',
      amount,
      currency: values[currencyIdx] || 'USD',
      type: amount > 0 ? 'income' : 'expense',
      category: 'Uncategorized',
      bank: isRelay ? 'Relay' : isRevolut ? 'Revolut' : 'Imported',
      originalDescription: values[descIdx >= 0 ? descIdx : 1] || ''
    })
  }

  return transactions
}

export async function POST(request: NextRequest) {
  try {
    const { csvContent, fileName, period } = await request.json()

    if (!csvContent) {
      return NextResponse.json({ error: 'No CSV content provided' }, { status: 400 })
    }

    // Limit CSV size to prevent timeout
    const maxLines = 500
    const lines = csvContent.split('\n')
    const truncatedCSV = lines.slice(0, maxLines + 1).join('\n')
    const wasTruncated = lines.length > maxLines + 1

    let transactions: any[] = []
    let usedAI = true

    try {
      const systemPrompt = `You are a JSON generator. Parse CSV bank statements and output ONLY a valid JSON array.

IMPORTANT: Your response must start with [ and end with ] - nothing else.

For each transaction, output:
{"date":"YYYY-MM-DD","description":"Clean Name","amount":NUMBER,"currency":"USD","type":"income|expense|internal","category":"CATEGORY","bank":"BANK"}

Categories: Sales, Ads, Software, Payroll, Shipping, Fees, Transfer, Refunds, Other

Rules:
- Positive = income, Negative = expense
- Internal transfers between own accounts = "internal"
- Clean descriptions (no ALL CAPS)
- Detect bank from data (Relay, Revolut, Mercury, etc)

OUTPUT ONLY THE JSON ARRAY. NO TEXT BEFORE OR AFTER.`

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        messages: [{ role: 'user', content: `Parse this CSV to JSON array:\n\n${truncatedCSV}` }],
        system: systemPrompt
      })

      const textContent = message.content.find(block => block.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No response')
      }

      let jsonStr = textContent.text.trim()
      
      // Extract JSON array from response
      const firstBracket = jsonStr.indexOf('[')
      const lastBracket = jsonStr.lastIndexOf(']')
      
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        jsonStr = jsonStr.substring(firstBracket, lastBracket + 1)
        
        // Try to fix common JSON issues
        jsonStr = jsonStr
          .replace(/,\s*]/g, ']') // Remove trailing commas
          .replace(/,\s*,/g, ',') // Remove double commas
        
        transactions = JSON.parse(jsonStr)
        
        if (!Array.isArray(transactions)) {
          throw new Error('Not an array')
        }
      } else {
        throw new Error('No JSON array found')
      }
    } catch (aiError) {
      console.error('AI parsing failed, using fallback:', aiError)
      transactions = fallbackParser(csvContent, fileName)
      usedAI = false
    }

    // Process and validate transactions
    const processedTransactions = transactions
      .filter((tx: any) => {
        const amount = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount)
        return !isNaN(amount) && amount !== 0
      })
      .map((tx: any, index: number) => {
        const amount = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0
        return {
          id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          date: tx.date || new Date().toISOString().split('T')[0],
          description: (tx.description || tx.originalDescription || 'Transaction').substring(0, 100),
          amount,
          currency: tx.currency || 'USD',
          type: tx.type || (amount > 0 ? 'income' : 'expense'),
          category: tx.category || 'Other',
          bank: tx.bank || 'Imported',
          account: tx.currency || 'Main',
          reference: (tx.originalDescription || '').substring(0, 200),
          period
        }
      })

    if (processedTransactions.length === 0) {
      return NextResponse.json({ 
        error: 'No valid transactions found. Please check your CSV format.' 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      transactions: processedTransactions,
      meta: {
        total: processedTransactions.length,
        usedAI,
        truncated: wasTruncated,
        originalLines: lines.length - 1
      }
    })

  } catch (error: any) {
    console.error('Analysis error:', error)
    return NextResponse.json({ 
      error: 'Failed to process statement. Please try again.' 
    }, { status: 500 })
  }
}
