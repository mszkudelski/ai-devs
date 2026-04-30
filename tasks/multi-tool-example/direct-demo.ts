/**
 * Direct Multi-Tool Example with Visible Output
 * 
 * This example shows multi-tool coordination with clear, visible results
 * by directly calling tools and displaying their outputs.
 */

import { TextAnalyzerTool, CalculatorTool } from "../../src/agent/examples/example-tools.js";

/**
 * Simple Data Processing Tool for demonstrations
 */
class SimpleDataProcessor {
    async processNumbers(numbers: number[], operation: string): Promise<any> {
        switch (operation) {
            case 'average':
                const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
                return {
                    operation: 'average',
                    input: numbers,
                    result: avg,
                    count: numbers.length
                };
            
            case 'max':
                const max = Math.max(...numbers);
                return {
                    operation: 'maximum',
                    input: numbers,
                    result: max,
                    count: numbers.length
                };
            
            case 'sum':
                const sum = numbers.reduce((a, b) => a + b, 0);
                return {
                    operation: 'sum',
                    input: numbers,
                    result: sum,
                    count: numbers.length
                };
            
            default:
                throw new Error(`Unsupported operation: ${operation}`);
        }
    }
}

/**
 * Multi-Tool Task Processor
 * Demonstrates coordinated use of multiple tools with visible output
 */
class MultiToolProcessor {
    private textAnalyzer: TextAnalyzerTool;
    private calculator: CalculatorTool;
    private dataProcessor: SimpleDataProcessor;

    constructor() {
        this.textAnalyzer = new TextAnalyzerTool();
        this.calculator = new CalculatorTool();
        this.dataProcessor = new SimpleDataProcessor();
    }

    /**
     * Analyze customer feedback with ratings
     */
    async analyzeCustomerFeedback(feedback: string, ratings: number[]): Promise<void> {
        console.log('🔍 ANALYZING CUSTOMER FEEDBACK');
        console.log('=' .repeat(50));
        console.log('📝 Feedback Text:', `"${feedback}"`);
        console.log('⭐ Ratings:', ratings);
        console.log('');

        // Step 1: Analyze text sentiment
        console.log('📊 Step 1: Analyzing Text Sentiment');
        console.log('-'.repeat(30));
        try {
            const textResult = await this.textAnalyzer.execute({ text: feedback });
            const textData = textResult.data; // Extract the actual data from ToolResult
            console.log('✅ Text Analysis Results:');
            console.log(`   • Word Count: ${textData.wordCount}`);
            console.log(`   • Sentiment: ${textData.sentiment}`);
            console.log(`   • Positive Keywords: ${textData.sentimentScore.positive}`);
            console.log(`   • Negative Keywords: ${textData.sentimentScore.negative}`);
            console.log(`   • Character Count: ${textData.characterCount}`);
            console.log('');

            // Step 2: Calculate average rating
            console.log('📈 Step 2: Processing Numerical Ratings');
            console.log('-'.repeat(30));
            const avgResult = await this.dataProcessor.processNumbers(ratings, 'average');
            const maxResult = await this.dataProcessor.processNumbers(ratings, 'max');
            
            console.log('✅ Rating Statistics:');
            console.log(`   • Average Rating: ${avgResult.result.toFixed(2)}/5.0`);
            console.log(`   • Maximum Rating: ${maxResult.result}/5.0`);
            console.log(`   • Total Ratings: ${avgResult.count}`);
            console.log('');

            // Step 3: Calculate satisfaction percentage
            console.log('🧮 Step 3: Calculating Satisfaction Percentage');
            console.log('-'.repeat(30));
            const satisfactionCalc = await this.calculator.execute({
                operation: 'multiply',
                a: avgResult.result,
                b: 20 // Convert 5-point scale to percentage
            });
            const satisfactionData = satisfactionCalc.data; // Extract calculator result
            
            console.log('✅ Satisfaction Calculation:');
            console.log(`   • Calculation: ${avgResult.result.toFixed(2)} × 20 = ${satisfactionData.result}%`);
            console.log('');

            // Step 4: Generate insights
            console.log('💡 Step 4: Combined Insights');
            console.log('-'.repeat(30));
            console.log('✅ Multi-Tool Analysis Summary:');
            
            const sentimentMatch = this.determineSentimentMatch(textData.sentiment, avgResult.result);
            console.log(`   • Text Sentiment: ${textData.sentiment}`);
            console.log(`   • Average Rating: ${avgResult.result.toFixed(2)}/5.0 (${satisfactionData.result}%)`);
            console.log(`   • Sentiment-Rating Alignment: ${sentimentMatch ? '✅ Consistent' : '⚠️ Inconsistent'}`);
            console.log(`   • Customer Satisfaction Level: ${this.getSatisfactionLevel(avgResult.result)}`);
            console.log('');

        } catch (error) {
            console.error('❌ Analysis failed:', error);
        }
    }

    /**
     * Analyze business report with financial data
     */
    async analyzeBusinessReport(reportText: string, expenses: number[], revenue: number[]): Promise<void> {
        console.log('💼 ANALYZING BUSINESS REPORT');
        console.log('=' .repeat(50));
        console.log('📄 Report:', `"${reportText}"`);
        console.log('💰 Expenses:', expenses);
        console.log('💵 Revenue:', revenue);
        console.log('');

        try {
            // Step 1: Analyze report sentiment
            console.log('📊 Step 1: Analyzing Report Sentiment');
            console.log('-'.repeat(30));
            const textResult = await this.textAnalyzer.execute({ text: reportText });
            const textData = textResult.data; // Extract the actual data
            console.log('✅ Report Analysis:');
            console.log(`   • Overall Sentiment: ${textData.sentiment}`);
            console.log(`   • Word Count: ${textData.wordCount}`);
            console.log(`   • Positive Indicators: ${textData.sentimentScore.positive}`);
            console.log('');

            // Step 2: Calculate financial metrics
            console.log('📈 Step 2: Processing Financial Data');
            console.log('-'.repeat(30));
            
            const expenseSum = await this.dataProcessor.processNumbers(expenses, 'sum');
            const revenueSum = await this.dataProcessor.processNumbers(revenue, 'sum');
            const expenseAvg = await this.dataProcessor.processNumbers(expenses, 'average');
            const revenueAvg = await this.dataProcessor.processNumbers(revenue, 'average');
            
            console.log('✅ Financial Calculations:');
            console.log(`   • Total Expenses: $${expenseSum.result.toLocaleString()}`);
            console.log(`   • Total Revenue: $${revenueSum.result.toLocaleString()}`);
            console.log(`   • Average Monthly Expenses: $${expenseAvg.result.toLocaleString()}`);
            console.log(`   • Average Monthly Revenue: $${revenueAvg.result.toLocaleString()}`);
            console.log('');

            // Step 3: Calculate profit
            console.log('🧮 Step 3: Calculating Total Profit');
            console.log('-'.repeat(30));
            const profitCalc = await this.calculator.execute({
                operation: 'subtract',
                a: revenueSum.result,
                b: expenseSum.result
            });
            const profitData = profitCalc.data; // Extract calculator result
            
            console.log('✅ Profit Analysis:');
            console.log(`   • Calculation: $${revenueSum.result.toLocaleString()} - $${expenseSum.result.toLocaleString()} = $${profitData.result.toLocaleString()}`);
            console.log(`   • Profit Margin: ${((profitData.result / revenueSum.result) * 100).toFixed(1)}%`);
            console.log('');

            // Step 4: Combined insights
            console.log('💡 Step 4: Strategic Insights');
            console.log('-'.repeat(30));
            console.log('✅ Business Performance Summary:');
            console.log(`   • Report Tone: ${textData.sentiment} (${textData.sentimentScore.positive} positive keywords)`);
            console.log(`   • Financial Performance: ${profitData.result > 0 ? '✅ Profitable' : '⚠️ Loss'}`);
            console.log(`   • Total Profit: $${profitData.result.toLocaleString()}`);
            console.log(`   • Alignment: ${this.assessBusinessAlignment(textData.sentiment, profitData.result)}`);
            console.log('');

        } catch (error) {
            console.error('❌ Business analysis failed:', error);
        }
    }

    private determineSentimentMatch(sentiment: string, avgRating: number): boolean {
        if (sentiment === 'positive' && avgRating >= 4) return true;
        if (sentiment === 'neutral' && avgRating >= 3 && avgRating < 4) return true;
        if (sentiment === 'negative' && avgRating < 3) return true;
        return false;
    }

    private getSatisfactionLevel(avgRating: number): string {
        if (avgRating >= 4.5) return 'Excellent (4.5+)';
        if (avgRating >= 4.0) return 'Very Good (4.0+)';
        if (avgRating >= 3.5) return 'Good (3.5+)';
        if (avgRating >= 3.0) return 'Average (3.0+)';
        return 'Poor (< 3.0)';
    }

    private assessBusinessAlignment(sentiment: string, profit: number): string {
        const isPositiveSentiment = sentiment === 'positive';
        const isProfitable = profit > 0;
        
        if (isPositiveSentiment && isProfitable) return '✅ Report sentiment matches financial performance';
        if (!isPositiveSentiment && !isProfitable) return '⚠️ Report sentiment matches poor financial performance';
        if (isPositiveSentiment && !isProfitable) return '🔍 Positive report despite financial losses - investigate';
        return '🔍 Negative sentiment despite profitability - investigate';
    }
}

/**
 * Main execution function with clear outputs
 */
async function executeMultiToolDemo(): Promise<void> {
    console.log('🚀 MULTI-TOOL COORDINATION DEMO');
    console.log('=' .repeat(60));
    console.log('This demo shows how multiple tools work together to analyze complex data\n');

    const processor = new MultiToolProcessor();

    try {
        // Demo 1: Customer Feedback Analysis
        await processor.analyzeCustomerFeedback(
            "This product is absolutely amazing! The quality exceeded all my expectations and the customer service was outstanding. I'm extremely happy with this purchase!",
            [5, 4, 5, 5, 4, 5]
        );

        console.log('🔗'.repeat(25));
        console.log('');

        // Demo 2: Business Report Analysis  
        await processor.analyzeBusinessReport(
            "This quarter demonstrated excellent growth with outstanding performance across all departments. Sales exceeded targets and customer feedback was very positive.",
            [45000, 52000, 48000, 41000, 47000], // expenses
            [78000, 85000, 92000, 88000, 91000]  // revenue
        );

        console.log('🎯'.repeat(25));
        console.log('✅ MULTI-TOOL DEMO COMPLETED SUCCESSFULLY!');
        console.log('');
        console.log('🔧 Tools Demonstrated:');
        console.log('   • TextAnalyzerTool - Sentiment analysis, word counting');
        console.log('   • CalculatorTool - Mathematical operations');  
        console.log('   • DataProcessor - Statistical analysis');
        console.log('');
        console.log('💡 Key Benefits:');
        console.log('   • Automatic tool coordination');
        console.log('   • Clear, structured output');
        console.log('   • Real-world applicable analysis');
        console.log('   • Comprehensive insights from multiple data types');

    } catch (error) {
        console.error('❌ Demo execution failed:', error);
    }
}

// Execute the demo
executeMultiToolDemo().catch(console.error);
