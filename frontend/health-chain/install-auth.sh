#!/bin/bash

# Authentication System Installation Script
# This script installs dependencies and sets up the authentication system

set -e

echo "🔐 Installing Authentication System..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from frontend/health-chain directory."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo ""
    echo "📝 Creating .env.local file..."
    cp .env.example .env.local
    echo "✅ .env.local created. Please update with your API URL."
else
    echo ""
    echo "ℹ️  .env.local already exists. Skipping..."
fi

# Run type check
echo ""
echo "🔍 Running type check..."
npm run type-check

# Run tests
echo ""
echo "🧪 Running tests..."
npm run test

echo ""
echo "✅ Authentication system installed successfully!"
echo ""
echo "📚 Next steps:"
echo "   1. Update .env.local with your API URL"
echo "   2. Ensure backend implements required endpoints (see SETUP_AUTH.md)"
echo "   3. Run 'npm run dev' to start development server"
echo "   4. Navigate to http://localhost:3000/auth/signin to test"
echo ""
echo "📖 Documentation:"
echo "   - Setup Guide: SETUP_AUTH.md"
echo "   - Implementation Details: ../../AUTHENTICATION_IMPLEMENTATION.md"
echo "   - API Documentation: lib/api/README.md"
echo "   - Security Guidelines: ../../SECURITY.md"
echo ""
