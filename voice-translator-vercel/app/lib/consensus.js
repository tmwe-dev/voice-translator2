// ═══════════════════════════════════════════════
// Consensus Translation — "Guaranteed" mode
//
// Calls 3 providers in parallel, compares results:
// - If 2 of 3 agree (Levenshtein similarity ≥ threshold) → guaranteed
// - If no agreement → use highest-scored result
// ═══════════════════════════════════════════════

/**
 * Levenshtein distance between two strings
 */
export function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  // Optimization: early exit for identical strings
  if (str1 === str2) return 0;
  if (m === 0) return n;
  if (n === 0) return m;

  // Use single-row DP for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Normalized similarity score (0 to 1, where 1 = identical)
 */
export function similarity(str1, str2) {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();
  if (s1 === s2) return 1;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(s1, s2);
  return 1 - (dist / maxLen);
}

/**
 * Find consensus among translation results
 *
 * @param {Array} results - Array of { text, provider, score }
 * @param {number} threshold - Similarity threshold for agreement (default 0.75)
 * @returns {{ text, guaranteed, confidence, agreedProviders, allResults }}
 */
export function findConsensus(results, threshold = 0.75) {
  // Filter to valid results only
  const valid = results.filter(r => r.text && r.text.trim());
  if (valid.length === 0) {
    return { text: null, guaranteed: false, confidence: 0, agreedProviders: [], allResults: results };
  }
  if (valid.length === 1) {
    return {
      text: valid[0].text,
      guaranteed: false,
      confidence: 0.5,
      agreedProviders: [valid[0].provider],
      allResults: results,
    };
  }

  // Compare all pairs and find agreements
  const agreements = [];
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const sim = similarity(valid[i].text, valid[j].text);
      if (sim >= threshold) {
        agreements.push({
          providers: [valid[i].provider, valid[j].provider],
          similarity: sim,
          texts: [valid[i].text, valid[j].text],
          scores: [valid[i].score || 0, valid[j].score || 0],
        });
      }
    }
  }

  if (agreements.length > 0) {
    // Find best agreement (highest similarity, then highest combined score)
    agreements.sort((a, b) => {
      if (b.similarity !== a.similarity) return b.similarity - a.similarity;
      return (b.scores[0] + b.scores[1]) - (a.scores[0] + a.scores[1]);
    });

    const best = agreements[0];
    // Use the text with higher score
    const chosenText = best.scores[0] >= best.scores[1] ? best.texts[0] : best.texts[1];

    // Check if a third provider also agrees
    const agreedProviders = [...best.providers];
    for (const r of valid) {
      if (agreedProviders.includes(r.provider)) continue;
      const sim = similarity(chosenText, r.text);
      if (sim >= threshold) agreedProviders.push(r.provider);
    }

    return {
      text: chosenText,
      guaranteed: true,
      confidence: best.similarity,
      agreedProviders,
      allResults: results,
    };
  }

  // No consensus — use highest-scored result
  valid.sort((a, b) => (b.score || 0) - (a.score || 0));
  return {
    text: valid[0].text,
    guaranteed: false,
    confidence: 0,
    agreedProviders: [valid[0].provider],
    allResults: results,
  };
}
