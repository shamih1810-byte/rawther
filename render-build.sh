#!/usr/bin/env bash
# exit on error
set -o errexit

echo "===> Installing Backend Python Dependencies"
pip install -r backend/requirements.txt

echo "===> Checking for Node.js"
if ! command -v node &> /dev/null; then
  echo "Node.js not found, installing via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
fi

echo "===> Node version: $(node --version)"
echo "===> npm version: $(npm --version)"

echo "===> Installing Frontend Dependencies"
cd frontend
npm install

echo "===> Building Frontend React SPA"
npx vite build
cd ..

echo "===> Build complete!"
