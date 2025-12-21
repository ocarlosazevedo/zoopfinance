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

    const systemPrompt = `You are a financial data processor. Parse bank statement CSVs and output ONLY a JSON array.

CATEGORIES:
- Sales: Shopify, Stripe, PayPal payouts, e-commerce revenue
- Ads: Facebook Ads, Google Ads, TikTok Ads, Meta
- Software: SaaS, subscriptions, tools
- Payroll: Salaries, contractor payments
- Shipping: Logistics, fulfillment, delivery
- Fees: Bank fees, processing fees
- Transfer: Internal transfers between own accounts
- Refunds: Customer refunds, chargebacks
- Other: Everything else

RULES:
- Positive amounts = income
- Negative amounts = expense
- Transfers between own accounts = type "internal"
- Clean ALL CAPS to Title Case
- Output ONLY the JSON array, nothing else
- No markdown, no explanations, no text before or after

OUTPUT FORMAT - JSON array only:
[{"date":"YYYY-MM-DD","description":"Clean name","amount":123.45,"currency":"USD","type":"income","category":"Sales","bank":"Revolut","originalDescription":"RAW DESC"}]`

    const userPrompt = `Parse this CSV and return ONLY a JSON array of transactions:

${csvContent}

Remember: Output ONLY the JSON array, no other text.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
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
      // Clean up response - remove markdown and extra text
      let jsonStr = textContent.text.trim()
      
      // Find JSON array in response
      const jsonStart = jsonStr.indexOf('[')
      const jsonEnd = jsonStr.lastIndexOf(']')
      
      if (jsonStart === -1 || jsonEnd === -1) {
        console.error('No JSON array found in response:', jsonStr.substring(0, 500))
        throw new Error('No valid JSON array in response')
      }
      
      jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1)
      
      transactions = JSON.parse(jsonStr)
      
      if (!Array.isArray(transactions)) {
        throw new Error('Response is not an array')
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textContent.text.substring(0, 1000))
      throw new Error('Failed to parse AI response as JSON')
    }

    // Validate and add IDs
    const processedTransactions = transactions
      .filter((tx: any) => {
        // Filter out invalid transactions
        const amount = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount)
        return !isNaN(amount) && amount !== 0
      })
      .map((tx: any, index: number) => {
        const amount = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0
        return {
          id: `${Date.now()}-${index}`,
          date: tx.date || new Date().toISOString().split('T')[0],
          description: tx.description || tx.originalDescription || 'Unknown',
          amount: amount,
          currency: tx.currency || 'USD',
          type: tx.type || (amount > 0 ? 'income' : 'expense'),
          category: tx.category || 'Other',
          bank: tx.bank || 'Imported',
          account: tx.currency || 'Main',
          reference: tx.originalDescription || '',
          period: period
        }
      })

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
