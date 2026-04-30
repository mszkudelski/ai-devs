# 🤖 Agent Framework - Simple Example

This demonstrates how the agent framework works with a clear **Question → Steps → Answer** flow.

## 📋 User Question
**"Analyze this text and calculate words per sentence"**

Text: *"AI is amazing. It helps us work faster. The future is bright!"*

## 🔄 Agent Steps (Autonomous)

### Step 1: Text Analysis
```
💭 Agent thinks: "I need to analyze the text first"
🔧 Uses: text_analyzer tool
📊 Result: 12 words, 3 sentences, positive sentiment
```

### Step 2: Math Calculation  
```
💭 Agent thinks: "Now I need to calculate 12 ÷ 3"
🔧 Uses: calculator tool  
🧮 Result: 12 ÷ 3 = 4
```

## ✅ Final Answer
- **Text Analysis**: 12 words, 3 sentences
- **Sentiment**: positive  
- **Words per sentence**: 4

---

## 🛠 How It Works

1. **User provides question** (natural language)
2. **Agent breaks it down** into tool-specific steps
3. **Agent executes tools** autonomously (text_analyzer, calculator)
4. **Agent combines results** into final answer

## 🎯 Key Features

- ✅ **Multi-step reasoning**: Breaks complex questions into simple steps
- ✅ **Tool selection**: Automatically chooses right tools (text analysis + math)
- ✅ **Context awareness**: Uses results from step 1 in step 2
- ✅ **Natural language**: Input and output in plain English

## 🚀 Usage

```bash
# Run the example
npm run start --dir=simple-agent-demo

# Or run the fuller demo
npm run start --dir=agent-demo
```

Perfect for AI_devs tasks that need intelligent, multi-step problem solving!
