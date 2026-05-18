#!/bin/bash
set -e
cd ~/ab-tracker

echo "→ Removing duplicate handleCommentInput..."

python3 << 'PYEOF'
path = 'components/work-orders/BoardClient.tsx'
with open(path) as f:
    c = f.read()

# Find both occurrences of handleCommentInput
marker = "  function handleCommentInput(value: string, cursorPos: number) {"

idx1 = c.find(marker)
idx2 = c.find(marker, idx1 + 1)

if idx1 == -1 or idx2 == -1:
    print(f"⚠️  Expected 2 occurrences, found {c.count(marker)}")
else:
    # Find the end of the second occurrence (matching closing brace)
    # The function body has: setNewComment, const before, const m, if (m) {...}, else {...}, closing }
    # Look for the next "}\n" at the right indent after idx2
    
    # Simpler: find "  }\n\n" (function close with blank line after) starting from idx2
    end_marker = "  }\n\n"
    end_idx = c.find(end_marker, idx2)
    
    if end_idx == -1:
        print("⚠️  Couldn't find end of second handleCommentInput")
    else:
        # Remove from idx2 to end_idx + len(end_marker), keeping one newline
        before = c[:idx2]
        after = c[end_idx + len(end_marker):]
        # Make sure we don't have triple-blank lines
        c = before + after
        print(f"✅ Removed duplicate handleCommentInput (was at position {idx2})")

with open(path, 'w') as f:
    f.write(c)

# Verify
with open(path) as f:
    verify = f.read()

count = verify.count("function handleCommentInput(")
print(f"\nhandleCommentInput count: {count} (should be 1)")
if count == 1:
    print("✅ Fixed!")
else:
    print("⚠️  Still wrong — needs manual edit")
PYEOF

echo ""
echo "Now run: npm run build && git add -A && git commit --amend --no-edit && git push --force"
