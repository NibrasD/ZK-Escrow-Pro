@echo off
setlocal enabledelayedexpansion

echo ═══════════════════════════════════════════════════════════════
echo ZK-Escrow Pro V6 (Shielded UTXO) - Deployment Script
echo ═══════════════════════════════════════════════════════════════

echo.
set /p PRIVATE_KEY="1. Enter your Aleo Testnet Private Key (APrivateKey1...): "

if "%PRIVATE_KEY%"=="" (
    echo Error: Private key cannot be empty.
    pause
    exit /b 1
)

echo.
echo 2. Initiating Leo Deploy to Testnet Beta...
echo Please wait, this may take 1-3 minutes...
echo.

leo deploy --network testnet --endpoint "https://api.explorer.provable.com/v1" --broadcast --private-key "%PRIVATE_KEY%"

echo.
echo If deployment was successful, copy the Transaction ID above!
echo.
pause
