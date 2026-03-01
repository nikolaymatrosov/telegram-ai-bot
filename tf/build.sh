#!/usr/bin/env bash
set -e
# Build TypeScript from project root
cd ..
npm ci
npm run build
cd tf
# Clean and assemble staging directory
rm -rf staging
mkdir -p staging
cp -r ../dist/. staging/
cp -r ../node_modules staging/node_modules
cp ../package.json staging/package.json
