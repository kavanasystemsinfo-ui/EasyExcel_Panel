#!/bin/bash
# Build script for Vercel static deployment
# Copia los archivos estáticos del frontend/dist a una posición accesible
mkdir -p dist
cp -r frontend/dist/* dist/ 2>/dev/null || echo "Frontend build not found"
ls -la dist/