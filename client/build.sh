#!/bin/bash
set -e

echo "Current directory: $(pwd)"
echo "Listing contents:"
ls -la

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Exporting..."
npm run export

echo "Build completed successfully!" 