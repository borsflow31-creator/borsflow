#!/bin/bash

echo "🚀 Setting up Notion-Alt..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "🔧 Creating .env file..."
    cp .env.example .env

    # Generate a random secret
    SECRET=$(openssl rand -base64 32 2>/dev/null || echo "change-this-to-a-random-secret-key")
    
    # Update NEXTAUTH_SECRET in .env
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-secret-key-here-generate-with-openssl-rand-base64-32/$SECRET/" .env
    else
        # Linux
        sed -i "s/your-secret-key-here-generate-with-openssl-rand-base64-32/$SECRET/" .env
    fi

    echo "✅ .env file created with random secret"
else
    echo "✅ .env file already exists"
fi

# Set up Prisma
echo "🗄️  Setting up database..."
npx prisma generate
npx prisma db push

echo ""
echo "✨ Setup complete!"
echo ""
echo "To start the development server, run:"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:3000 in your browser"
