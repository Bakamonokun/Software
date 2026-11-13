#!/usr/bin/env bash
set -e
echo "==============================================================="
echo "Kanha ERP & POS v2.5.3 - macOS / Linux Build Suite"
echo "==============================================================="

if command -v gcc >/dev/null 2>&1; then
  mkdir -p build/native
  gcc -std=c11 -O2 -shared -fPIC native-c/erp_vault_core.c -o build/native/liberp_vault_core.so
  echo "[OK] Compiled native-c/erp_vault_core.c"
fi

if command -v javac >/dev/null 2>&1; then
  mkdir -p build/classes
  javac -d build/classes java-erp/src/com/kanhasoft/erp/KanhaErpApplication.java
  echo "[OK] Compiled java-erp/src/com/kanhasoft/erp/KanhaErpApplication.java"
fi

npm run build
echo "[OK] Web & Desktop bundle build finished."
