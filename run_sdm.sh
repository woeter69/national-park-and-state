#!/usr/bin/env bash
# Runner script for Indian Elephant Species Distribution Model (SDM)
set -e

echo "======================================================================"
echo " Running Indian Elephant Correlative SDM Pipeline"
echo "======================================================================"

if command -v nix-shell &> /dev/null; then
    nix-shell -p python3Packages.rasterio python3Packages.scikit-learn python3Packages.pandas python3Packages.matplotlib python3Packages.numpy --run "python3 sdm_elephant.py"
else
    python3 sdm_elephant.py
fi
