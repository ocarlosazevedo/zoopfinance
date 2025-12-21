import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { csvContent, fileName, period } = await request.json()

    if (!csvContent) {
      return NextResponse.json({ error: 'No CSV content provided' }, { status: 400 })
    }

    const systemPrompt = `You are a financial analyst AI that processes bank statements. Your job is to:

1. Parse the CSV data and extract transactions
2. Categorize each transaction intelligently based on the description
3. Identify the transaction type (income, expense, or internal transfer)
4. Clean up and standardize descriptions
5. Detect the bank/source from the data format

Categories to use:
- Sales: Shopify payouts, Stripe, payment processors, e-commerce revenue
- Ads: Facebook Ads, Google Ads, TikTok Ads, advertising spend
- Software: SaaS subscriptions, tools, software services
- Payroll: Salaries, contractor payments, team payments
- Shipping: Logistics, fulfillment, delivery costs
- Fees: Bank fees, processing fees, platform fees
- Transfer: Internal transfers between accounts (mark as type "internal")
- Refunds: Customer refunds, chargebacks
- Other: Anything that doesn't fit above

Rules:
- Positive amounts are income, negative are expenses
- Transfers between own accounts should be type "internal"
- Keep original currency
- Use the transaction date from the CSV
- Clean up ALL CAPS descriptions to Title Case
- Remove unnecessary prefixes like "PAYMENT TO" or "DIRECT DEBIT"

Respond ONLY with valid JSON array, no markdown, no explanation. Each transaction object must have:
{
  "date": "YYYY-MM-DD",
  "description": "Clean description",
  "amount": number (positive for income, negative for expense),
  "currency": "USD/EUR/GBP/BRL",
  "type": "income" | "expense" | "internal",
  "category": "Sales" | "Ads" | "Software" | "Payroll" | "Shipping" | "Fees" | "Transfer" | "Refunds" | "Other",
  "bank": "Detected bank name",
  "originalDescription": "Original raw description"
}`

    const userPrompt = `Analyze this bank statement CSV from file "${fileName}" for period "${period}":

\`\`\`csv
${csvContent}
\`\`\`

Return ONLY a JSON array of transaction objects. No other text.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ],
      system: systemPrompt
    })

    // Extract text content
    const textContent = message.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse JSON response
    let transactions
    try {
      // Clean up response - remove markdown if present
      let jsonStr = textContent.text.trim()
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7)
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3)
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3)
      }
      jsonStr = jsonStr.trim()
      
      transactions = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textContent.text)
      throw new Error('Failed to parse AI response as JSON')
    }

    // Validate and add IDs
    const processedTransactions = transactions.map((tx: any, index: number) => ({
      id: `${Date.now()}-${index}`,
      date: tx.date || new Date().toISOString().split('T')[0],
      description: tx.description || 'Unknown',
      amount: typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0,
      currency: tx.currency || 'USD',
      type: tx.type || (tx.amount > 0 ? 'income' : 'expense'),
      category: tx.category || 'Other',
      bank: tx.bank || 'Unknown',
      account: tx.currency || 'Main',
      reference: tx.originalDescription || '',
      period: period
    }))

    return NextResponse.json({ 
      success: true, 
      transactions: processedTransactions,
      summary: {
        total: processedTransactions.length,
        income: processedTransactions.filter((t: any) => t.type === 'income').length,
        expenses: processedTransactions.filter((t: any) => t.type === 'expense').length,
        internal: processedTransactions.filter((t: any) => t.type === 'internal').length
      }
    })

  } catch (error: any) {
    console.error('Analysis error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to analyze statement' 
    }, { status: 500 })
  }
}
