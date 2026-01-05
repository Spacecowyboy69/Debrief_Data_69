#!/bin/bash

# Start script for ADIZ Dashboard
# This starts a simple Python web server

echo "🚀 Starting ADIZ Dashboard..."
echo ""
echo "Server will run at: http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null
then
    echo "Using Python 3..."
    python3 -m http.server 8000
# Check if Python 2 is available
elif command -v python &> /dev/null
then
    echo "Using Python 2..."
    python -m SimpleHTTPServer 8000
else
    echo "❌ Error: Python not found!"
    echo ""
    echo "Please install Python or see HOW_TO_RUN.md for alternatives"
    echo ""
    read -p "Press Enter to exit..."
fi
