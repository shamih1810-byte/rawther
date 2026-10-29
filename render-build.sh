#!/usr/bin/env bash
# exit on error
set -o errexit

echo "===> Installing Frontend Dependencies"
npm install --prefix frontend

echo "===> Building Frontend React SPA"
npm run build --prefix frontend

echo "===> Installing Backend Python Dependencies"
pip install -r backend/requirements.txt

