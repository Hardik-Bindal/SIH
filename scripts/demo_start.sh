#!/bin/bash
# demo_start.sh - Zero-friction startup script for SIH Round 2 demo

echo "=========================================================="
echo " Starting SIF Sentinel AI - Demo Mode"
echo "=========================================================="

# 1. Kill any existing processes on ports 8000 and 5173
echo "→ Cleaning up old processes..."
lsof -ti:8000,5173 | xargs kill -9 2>/dev/null
sleep 1

# 2. Start Backend
echo "→ Starting FastAPI Backend..."
cd backend
source ../.venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Wait for backend to be healthy
echo "→ Waiting for backend health check..."
until $(curl --output /dev/null --silent --fail http://localhost:8000/api/v1/health); do
    printf '.'
    sleep 1
done
echo -e "\n✓ Backend is healthy!"

# 3. Start Frontend
echo "→ Starting React Frontend..."
cd frontend
npm run dev -- --host &
FRONTEND_PID=$!

echo "=========================================================="
echo " SIF Sentinel AI is LIVE!"
echo " Backend: http://localhost:8000"
echo " Frontend: http://localhost:5173"
echo " Press Ctrl+C to stop all services."
echo "=========================================================="

# Wait for user interrupt
trap "echo 'Stopping services...'; kill -9 $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
