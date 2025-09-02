#!/bin/bash

echo "🚀 APXO Deployment Script"
echo "========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "server" ]; then
    print_error "Please run this script from the APXO root directory"
    exit 1
fi

echo "Choose deployment option:"
echo "1) Local Network (for LAN access)"
echo "2) Online Deployment Setup"
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        print_status "Setting up local network deployment..."

        # Get local IP
        if [[ "$OSTYPE" == "darwin"* ]]; then
            LOCAL_IP=$(ipconfig getifaddr en0)
        else
            LOCAL_IP=$(hostname -I | awk '{print $1}')
        fi

        if [ -z "$LOCAL_IP" ]; then
            print_error "Could not determine local IP address"
            exit 1
        fi

        print_status "Your local IP: $LOCAL_IP"
        print_status "Frontend will be available at: http://$LOCAL_IP:5173"
        print_status "Backend will be available at: http://$LOCAL_IP:3001"

        # Update CORS for local network
        print_status "Updating CORS configuration..."
        sed -i.bak "s|http://localhost:5173|http://$LOCAL_IP:5173|g" server/server.js
        sed -i.bak "s|http://localhost:5174|http://$LOCAL_IP:5174|g" server/server.js

        # Start backend
        print_status "Starting backend server..."
        cd server
        npm start &
        BACKEND_PID=$!
        cd ..

        # Start frontend with host flag
        print_status "Starting frontend server..."
        npm run dev -- --host &
        FRONTEND_PID=$!

        print_status "Servers started!"
        print_warning "Press Ctrl+C to stop all servers"

        # Wait for Ctrl+C
        trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
        wait
        ;;

    2)
        print_status "Setting up online deployment..."

        # Check if Vercel CLI is installed
        if ! command -v vercel &> /dev/null; then
            print_warning "Vercel CLI not found. Installing..."
            npm install -g vercel
        fi

        # Check if Render CLI is installed
        if ! command -v render &> /dev/null; then
            print_warning "Render CLI not found. Please install it manually:"
            print_warning "npm install -g render-cli"
        fi

        print_status "Please follow these steps:"
        echo ""
        echo "1) Push your code to GitHub:"
        echo "   git add ."
        echo "   git commit -m 'Ready for deployment'"
        echo "   git push origin main"
        echo ""
        echo "2) Deploy Frontend to Vercel:"
        echo "   vercel --prod"
        echo "   - Set VITE_SERVER_URL when prompted"
        echo ""
        echo "3) Deploy Backend to Render:"
        echo "   - Go to https://render.com"
        echo "   - Create new Web Service"
        echo "   - Connect your GitHub repo"
        echo "   - Set environment variables:"
        echo "     * NODE_ENV=production"
        echo "     * FRONTEND_URL=your-vercel-url"
        echo ""
        echo "4) Update .env.production with your URLs"
        echo ""
        print_warning "Don't forget to update CORS origins in server/server.js"
        ;;

    *)
        print_error "Invalid choice. Please run the script again."
        exit 1
        ;;
esac
