#!/bin/bash
# 检查文件是否包含 BOM

echo "Checking for BOM in JSON files..."

HAS_ERROR=0

for file in package.json openclaw.plugin.json; do
  if [ -f "$file" ]; then
    # 检查文件前3个字节是否是 BOM (EF BB BF)
    if head -c 3 "$file" | od -An -tx1 | grep -q "ef bb bf"; then
      echo "✗ Error: $file contains BOM"
      HAS_ERROR=1
    else
      echo "✓ $file is BOM-free"
    fi
  else
    echo "⚠ Warning: $file not found"
  fi
done

if [ $HAS_ERROR -eq 0 ]; then
  echo ""
  echo "All files are BOM-free ✓"
  exit 0
else
  echo ""
  echo "Please remove BOM from files"
  echo "You can use a text editor like VS Code to save without BOM"
  exit 1
fi
