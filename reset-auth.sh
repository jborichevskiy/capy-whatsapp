#!/bin/bash

echo "🔐 WhatsApp Bot Authentication Reset Script"
echo "=========================================="
echo ""
echo "This script will help you reset the WhatsApp authentication"
echo "when your session has expired (401 error)."
echo ""

# Check if auth directory exists
if [ -d "auth" ]; then
    echo "📁 Found existing auth directory"
    echo "🗑️  Removing old authentication files..."
    rm -rf auth
    echo "✅ Authentication files removed"
else
    echo "ℹ️  No existing auth directory found"
fi

echo ""
echo "🎯 Next steps:"
echo "1. Run 'pnpm dev' to start the bot"
echo "2. A QR code will appear in the terminal"
echo "3. Open WhatsApp on your phone"
echo "4. Go to Settings → Linked Devices → Link a Device"
echo "5. Scan the QR code with your phone"
echo ""
echo "✨ Your bot will be re-authenticated and ready to use!"