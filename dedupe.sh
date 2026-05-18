#!/bin/bash
set -e
cd ~/ab-tracker

echo "→ Deduplicating mention code in BoardClient.tsx..."

python3 << 'PYEOF'
path = 'components/work-orders/BoardClient.tsx'
with open(path) as f:
    c = f.read()

# 1. Remove duplicate state declarations (lines 63-64 of error)
dup_state = """  const [mentionDropdown, setMentionDropdown] = useState<{ open: boolean; query: string; position: number }>({ open: false, query: '', position: 0 })
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionDropdown, setMentionDropdown] = useState<{ open: boolean; query: string; position: number }>({ open: false, query: '', position: 0 })
  const [mentionIndex, setMentionIndex] = useState(0)"""

single_state = """  const [mentionDropdown, setMentionDropdown] = useState<{ open: boolean; query: string; position: number }>({ open: false, query: '', position: 0 })
  const [mentionIndex, setMentionIndex] = useState(0)"""

if dup_state in c:
    c = c.replace(dup_state, single_state)
    print("✅ Removed duplicate state declarations")

# 2. Remove the second block of mention helpers (the duplicates after the first set)
# We'll find the second occurrence of "const mentionCandidates = useMemo" and remove from there
# down to just before "async function postComment"

# Find all occurrences
import re

# The duplicated helpers block starts after the first block ends.
# Strategy: count occurrences of unique markers. If we see "const mentionCandidates" twice,
# remove the second one and everything until "async function postComment".

# Split on the unique marker
parts = c.split("const mentionCandidates = useMemo(() => {")

if len(parts) >= 3:
    # parts[0] = before first occurrence
    # parts[1] = between first and second occurrence
    # parts[2] = from second occurrence onwards
    
    # The first occurrence is intentional. The second + everything after it through extractMentionedIds 
    # and handleCommentInput is duplicated. We need to find where the duplicated block ends
    # and resume with what comes AFTER (which should be "async function postComment").
    
    # In parts[2], find where the duplicate block ends. Look for the next unique marker.
    # Looking at the error, parts[2] starts with the second mentionCandidates body, then duplicated 
    # mentionMatches, insertMention, extractMentionedIds, handleCommentInput, then async function postComment.
    
    # Find "async function postComment" in parts[2] and take everything from there
    idx = parts[2].find("async function postComment")
    if idx >= 0:
        # Get everything from "async function postComment" onwards in parts[2]
        # but we need the leading whitespace/indent before it.
        # Look backwards a bit to find clean cut point
        rest = parts[2][idx:]
        # Find the preceding indent (likely "  ")
        # Just include "  " before it
        c = parts[0] + "const mentionCandidates = useMemo(() => {" + parts[1] + "  " + rest
        print("✅ Removed duplicate mention helpers block")
    else:
        print("⚠️  Couldn't find 'async function postComment' in second block")
else:
    print(f"⚠️  Found {len(parts)-1} occurrences of mentionCandidates, expected 2")

with open(path, 'w') as f:
    f.write(c)

# Verify
with open(path) as f:
    verify = f.read()

state_count = verify.count("const [mentionDropdown, setMentionDropdown]")
candidates_count = verify.count("const mentionCandidates = useMemo")
matches_count = verify.count("const mentionMatches = useMemo")
insert_count = verify.count("function insertMention(")
extract_count = verify.count("function extractMentionedIds(")
input_count = verify.count("function handleCommentInput(")

print(f"\nVerification:")
print(f"  mentionDropdown state: {state_count} (should be 1)")
print(f"  mentionCandidates: {candidates_count} (should be 1)")
print(f"  mentionMatches: {matches_count} (should be 1)")
print(f"  insertMention: {insert_count} (should be 1)")
print(f"  extractMentionedIds: {extract_count} (should be 1)")
print(f"  handleCommentInput: {input_count} (should be 1)")

if state_count == 1 and candidates_count == 1 and matches_count == 1:
    print("\n✅ Deduplication successful!")
else:
    print("\n⚠️  Still has duplicates — needs manual review")
PYEOF

echo ""
echo "Now run: npm run build"
