#!/usr/bin/env bun
/**
 * Test script for Wiki functionality
 */

import { DefaultKnowledgeRepository } from './scheme/src/data/wiki/knowledge-repository';
import { DefaultWikiMatchService } from './scheme/src/services/wiki/match-service';
import { saveInspirationNote, listRecentInspirationNotes } from './scheme/src/services/wiki/auto-extractor';

async function testWiki() {
  console.log('🧪 Testing Wiki Functionality...\n');

  // Test 1: Knowledge Repository
  console.log('1️⃣ Testing Knowledge Repository');
  const repo = new DefaultKnowledgeRepository();

  const testEntry = {
    id: 'test-001',
    title: 'React useEffect 执行两次问题',
    content: '在 StrictMode 下，React 会故意执行两次 effect 来帮助发现副作用。这是正常行为。',
    tags: ['react', 'bug', 'strictmode'],
    timestamp: Date.now(),
  };

  await repo.add(testEntry);
  console.log('   ✅ Added entry:', testEntry.title);

  const retrieved = await repo.get('test-001');
  console.log('   ✅ Retrieved:', retrieved?.title);

  const searchResults = await repo.search('react');
  console.log(`   ✅ Search found ${searchResults.length} results`);

  // Test 2: Wiki Match Service
  console.log('\n2️⃣ Testing Wiki Match Service');
  const matcher = new DefaultWikiMatchService();

  const match = await matcher.searchByQuery('useEffect 问题');
  if (match) {
    console.log(`   ✅ Match found: "${match.entry.title}" (score: ${match.score.toFixed(2)})`);
  } else {
    console.log('   ℹ️  No match found (expected if no data)');
  }

  // Test 3: Inspiration Notes
  console.log('\n3️⃣ Testing Inspiration Notes');

  const inspiration = {
    id: `insp-${Date.now()}`,
    content: 'Learned that tmux base-index can be set per-session to fix window numbering issues.',
    timestamp: Date.now(),
    source: 'debugging',
    tags: ['tmux', 'fix'],
  };

  await saveInspirationNote(inspiration);
  console.log('   ✅ Saved inspiration note');

  const recent = await listRecentInspirationNotes(5);
  console.log(`   ✅ Found ${recent.length} recent inspirations`);

  // Test 4: List all entries
  console.log('\n4️⃣ Listing all knowledge entries');
  const allEntries = await repo.list();
  console.log(`   ✅ Total entries: ${allEntries.length}`);

  allEntries.forEach(entry => {
    console.log(`      - ${entry.title} (${entry.tags?.join(', ')})`);
  });

  console.log('\n✨ All tests completed!');
  console.log('\n📁 Data locations:');
  console.log('   - Knowledge: ~/.flow-wiki/');
  console.log('   - Inspirations: ~/.flow-sessions/');
}

testWiki().catch(console.error);
