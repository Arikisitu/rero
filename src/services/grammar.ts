/**
 * Rero Offline Grammar and Spelling Engine
 * 100% Local-first, privacy-respecting, zero paid APIs.
 *
 * Provides:
 * 1. ESL-focused grammatical rules (subject-verb agreement, tenses, articles, double negatives, prepositions, homophones).
 * 2. Spelling correction dictionary for frequent slips.
 * 3. Safe offset tracking and atomic replacement functions.
 */

export interface GrammarIssue {
  id: string
  offset: number
  length: number
  originalText: string
  suggestedReplacement: string
  category: 'spelling' | 'grammar' | 'style'
  explanation: string
}

// Common English misspellings to correct forms
const SPELLING_DICTIONARY: Record<string, string> = {
  teh: 'the',
  definately: 'definitely',
  definitly: 'definitely',
  seperate: 'separate',
  seperated: 'separated',
  recieve: 'receive',
  recieved: 'received',
  recieving: 'receiving',
  occured: 'occurred',
  occuring: 'occurring',
  untill: 'until',
  grammer: 'grammar',
  alot: 'a lot',
  truely: 'truly',
  writting: 'writing',
  speach: 'speech',
  beleive: 'believe',
  beleived: 'believed',
  enviroment: 'environment',
  tommorrow: 'tomorrow',
  tomorow: 'tomorrow',
  goverment: 'government',
  neccessary: 'necessary',
  necesary: 'necessary',
  succesful: 'successful',
  wich: 'which',
  thier: 'their',
  untilll: 'until',
  becuase: 'because',
  becasue: 'because',
  practise: 'practice',
  rember: 'remember',
  diffrent: 'different',
  colleague: 'colleague',
  convenient: 'convenient',
  interseting: 'interesting',
  intresting: 'interesting',
  oppurtunity: 'opportunity',
  oppertunity: 'opportunity',
  pronounciation: 'pronunciation',
  knowlege: 'knowledge',
  freind: 'friend',
  buisness: 'business',
  finaly: 'finally'
}

interface RuleDefinition {
  regex: RegExp
  replacement: (match: RegExpExecArray) => string
  category: 'grammar' | 'style'
  explanation: string | ((match: RegExpExecArray) => string)
}

const GRAMMAR_RULES: RuleDefinition[] = [
  // Subject-Verb Agreement: Pronoun + 'is/are/am'
  {
    regex: /\b(I)\s+(is)\b/gi,
    replacement: () => 'I am',
    category: 'grammar',
    explanation: "Subject-verb agreement: use 'am' with 'I'."
  },
  {
    regex: /\b(you|we|they)\s+(is)\b/gi,
    replacement: (m) => `${m[1]} are`,
    category: 'grammar',
    explanation: (m) => `Subject-verb agreement: use 'are' with '${m[1]}'.`
  },
  {
    regex: /\b(he|she|it)\s+(are)\b/gi,
    replacement: (m) => `${m[1]} is`,
    category: 'grammar',
    explanation: (m) => `Subject-verb agreement: use 'is' with '${m[1]}'.`
  },
  // Subject-Verb Agreement: Pronoun + 'have/has'
  {
    regex: /\b(he|she|it)\s+(have)\b/gi,
    replacement: (m) => `${m[1]} has`,
    category: 'grammar',
    explanation: (m) => `Subject-verb agreement: use 'has' with singular third-person '${m[1]}'.`
  },
  {
    regex: /\b(I|you|we|they)\s+(has)\b/gi,
    replacement: (m) => `${m[1]} have`,
    category: 'grammar',
    explanation: (m) => `Subject-verb agreement: use 'have' with '${m[1]}'.`
  },
  // Subject-Verb Agreement: Pronoun + 'do/does'
  {
    regex: /\b(he|she|it)\s+(do)\b/gi,
    replacement: (m) => `${m[1]} does`,
    category: 'grammar',
    explanation: (m) => `Subject-verb agreement: use 'does' with singular third-person '${m[1]}'.`
  },
  {
    regex: /\b(I|you|we|they)\s+(does)\b/gi,
    replacement: (m) => `${m[1]} do`,
    category: 'grammar',
    explanation: (m) => `Subject-verb agreement: use 'do' with '${m[1]}'.`
  },
  // Past Tense 'was/were'
  {
    regex: /\b(you|we|they)\s+(was)\b/gi,
    replacement: (m) => `${m[1]} were`,
    category: 'grammar',
    explanation: (m) => `Subject-verb agreement: use 'were' with plural pronoun '${m[1]}'.`
  },
  {
    regex: /\b(I|he|she|it)\s+(were)\b/gi,
    replacement: (m) => `${m[1]} was`,
    category: 'grammar',
    explanation: (m) => `Subject-verb agreement: use 'was' with '${m[1]}' in indicative past tense.`
  },
  // Common singular third-person verbs without 's'
  {
    regex: /\b(he|she)\s+(go)\b/gi,
    replacement: (m) => `${m[1]} goes`,
    category: 'grammar',
    explanation: (m) => `Use 'goes' with '${m[1]}'.`
  },
  {
    regex: /\b(he|she|it)\s+(want)\b/gi,
    replacement: (m) => `${m[1]} wants`,
    category: 'grammar',
    explanation: (m) => `Use 'wants' with '${m[1]}'.`
  },
  {
    regex: /\b(he|she)\s+(say)\b/gi,
    replacement: (m) => `${m[1]} says`,
    category: 'grammar',
    explanation: (m) => `Use 'says' with '${m[1]}'.`
  },
  {
    regex: /\b(he|she)\s+(know)\b/gi,
    replacement: (m) => `${m[1]} knows`,
    category: 'grammar',
    explanation: (m) => `Use 'knows' with '${m[1]}'.`
  },
  {
    regex: /\b(he|she|it)\s+(make)\b/gi,
    replacement: (m) => `${m[1]} makes`,
    category: 'grammar',
    explanation: (m) => `Use 'makes' with '${m[1]}'.`
  },
  {
    regex: /\b(he|she|it)\s+(seem)\b/gi,
    replacement: (m) => `${m[1]} seems`,
    category: 'grammar',
    explanation: (m) => `Use 'seems' with '${m[1]}'.`
  },
  // Did / Didn't + Past verb slips
  {
    regex: /\b(did|didn't|did not)\s+(went)\b/gi,
    replacement: (m) => `${m[1]} go`,
    category: 'grammar',
    explanation: "Use the base form of the verb after 'did' / 'didn't' ('did go')."
  },
  {
    regex: /\b(did|didn't|did not)\s+(saw)\b/gi,
    replacement: (m) => `${m[1]} see`,
    category: 'grammar',
    explanation: "Use the base form of the verb after 'did' / 'didn't' ('did see')."
  },
  {
    regex: /\b(did|didn't|did not)\s+(came)\b/gi,
    replacement: (m) => `${m[1]} come`,
    category: 'grammar',
    explanation: "Use the base form of the verb after 'did' / 'didn't' ('did come')."
  },
  {
    regex: /\b(did|didn't|did not)\s+(knew)\b/gi,
    replacement: (m) => `${m[1]} know`,
    category: 'grammar',
    explanation: "Use the base form of the verb after 'did' / 'didn't' ('did know')."
  },
  {
    regex: /\b(did|didn't|did not)\s+(had)\b/gi,
    replacement: (m) => `${m[1]} have`,
    category: 'grammar',
    explanation: "Use the base form of the verb after 'did' / 'didn't' ('did have')."
  },
  {
    regex: /\b(did|didn't|did not)\s+(took)\b/gi,
    replacement: (m) => `${m[1]} take`,
    category: 'grammar',
    explanation: "Use the base form of the verb after 'did' / 'didn't' ('did take')."
  },
  {
    regex: /\b(did|didn't|did not)\s+(ate)\b/gi,
    replacement: (m) => `${m[1]} eat`,
    category: 'grammar',
    explanation: "Use the base form of the verb after 'did' / 'didn't' ('did eat')."
  },
  // Have / Has + Past Simple instead of Past Participle
  {
    regex: /\b(have|has|had)\s+(went)\b/gi,
    replacement: (m) => `${m[1]} gone`,
    category: 'grammar',
    explanation: "Use the past participle 'gone' with perfect tenses ('have gone')."
  },
  {
    regex: /\b(have|has|had)\s+(saw)\b/gi,
    replacement: (m) => `${m[1]} seen`,
    category: 'grammar',
    explanation: "Use the past participle 'seen' with perfect tenses ('have seen')."
  },
  {
    regex: /\b(have|has|had)\s+(took)\b/gi,
    replacement: (m) => `${m[1]} taken`,
    category: 'grammar',
    explanation: "Use the past participle 'taken' with perfect tenses ('have taken')."
  },
  {
    regex: /\b(have|has|had)\s+(ate)\b/gi,
    replacement: (m) => `${m[1]} eaten`,
    category: 'grammar',
    explanation: "Use the past participle 'eaten' with perfect tenses ('have eaten')."
  },
  {
    regex: /\b(have|has|had)\s+(wrote)\b/gi,
    replacement: (m) => `${m[1]} written`,
    category: 'grammar',
    explanation: "Use the past participle 'written' with perfect tenses ('have written')."
  },
  // Modal auxiliary + verb form
  {
    regex: /\b(can|could|should|would|will|must)\s+(goes|went)\b/gi,
    replacement: (m) => `${m[1]} go`,
    category: 'grammar',
    explanation: "Modals take the base form of the verb ('should go')."
  },
  {
    regex: /\b(should|could|would)\s+(has|had)\b/gi,
    replacement: (m) => `${m[1]} have`,
    category: 'grammar',
    explanation: "Modals take the base infinitive 'have' ('should have')."
  },
  // Article 'a' before vowel sounds
  {
    regex: /\b(a)\s+(apple|orange|egg|elephant|hour|honest|idea|uncle|umbrella|opportunity|expert|interview|island|accident|example|answer)\b/gi,
    replacement: (m) => `an ${m[2]}`,
    category: 'grammar',
    explanation: (m) => `Use 'an' before vowel sounds ('an ${m[2]}').`
  },
  // Article 'an' before consonant sounds
  {
    regex: /\b(an)\s+(university|uniform|unique|user|useful|european|car|book|dog|person|game|day|week|month|year)\b/gi,
    replacement: (m) => `a ${m[2]}`,
    category: 'grammar',
    explanation: (m) => `Use 'a' before consonant sounds ('a ${m[2]}').`
  },
  // Homophones and Confused Words
  {
    regex: /\b(your)\s+(welcome|right|wrong|leaving|coming|the best|doing great)\b/gi,
    replacement: (m) => `you're ${m[2]}`,
    category: 'grammar',
    explanation: "Use 'you're' (you are) instead of possessive 'your'."
  },
  {
    regex: /\b(you're)\s+(car|house|phone|friend|time|family|dog|cat|turn|entry|diary)\b/gi,
    replacement: (m) => `your ${m[2]}`,
    category: 'grammar',
    explanation: "Use possessive 'your' instead of contraction 'you're'."
  },
  {
    regex: /\b(their)\s+(going|coming|leaving|here|there|ready|doing)\b/gi,
    replacement: (m) => `they're ${m[2]}`,
    category: 'grammar',
    explanation: "Use 'they're' (they are) instead of possessive 'their'."
  },
  {
    regex: /\b(its)\s+(raining|going|good|bad|nice|important|true|okay)\b/gi,
    replacement: (m) => `it's ${m[2]}`,
    category: 'grammar',
    explanation: "Use 'it's' (it is) instead of possessive 'its'."
  },
  {
    regex: /\b(better|worse|more|less|faster|slower|bigger|smaller|taller|shorter|easier|harder)\s+(then)\b/gi,
    replacement: (m) => `${m[1]} than`,
    category: 'grammar',
    explanation: (m) => `Use 'than' for comparisons ('${m[1]} than').`
  },
  {
    regex: /\b(to)\s+(much|many|late|early|fast|slow|hard|difficult|easy|expensive)\b/gi,
    replacement: (m) => `too ${m[2]}`,
    category: 'grammar',
    explanation: (m) => `Use 'too' to mean 'excessively' ('too ${m[2]}').`
  },
  {
    regex: /\b(dont|don't)\s+(loose)\b/gi,
    replacement: () => "don't lose",
    category: 'grammar',
    explanation: "Use 'lose' (verb) instead of 'loose' (opposite of tight)."
  },
  {
    regex: /\b(loose)\s+(weight|money|hope|interest|focus)\b/gi,
    replacement: (m) => `lose ${m[2]}`,
    category: 'grammar',
    explanation: "Use 'lose' instead of 'loose'."
  },
  // Double Negatives
  {
    regex: /\b(don't|dont|didn't|didnt|can't|cant)\s+(have|see|want|know|need)\s+(no|nothing|nobody)\b/gi,
    replacement: (m) => {
      const positiveReplacements: Record<string, string> = { no: 'any', nothing: 'anything', nobody: 'anybody' }
      const key = m[3].toLowerCase()
      const rep = positiveReplacements[key] || 'any'
      return `${m[1]} ${m[2]} ${rep}`
    },
    category: 'grammar',
    explanation: "Avoid double negatives ('don't have any' instead of 'don't have no')."
  },
  // Preposition slips common in ESL
  {
    regex: /\b(depends)\s+(of)\b/gi,
    replacement: () => 'depends on',
    category: 'grammar',
    explanation: "Use preposition 'depends on' instead of 'depends of'."
  },
  {
    regex: /\b(interested)\s+(for)\b/gi,
    replacement: () => 'interested in',
    category: 'grammar',
    explanation: "Use preposition 'interested in' instead of 'interested for'."
  },
  {
    regex: /\b(good|bad|great)\s+(in)\s+(english|math|speaking|writing|sports)\b/gi,
    replacement: (m) => `${m[1]} at ${m[3]}`,
    category: 'grammar',
    explanation: (m) => `Use 'at' with skills ('${m[1]} at ${m[3]}').`
  },
  {
    regex: /\b(married)\s+(with)\s+([a-z]+)\b/gi,
    replacement: (m) => `married to ${m[3]}`,
    category: 'grammar',
    explanation: "Use 'married to' instead of 'married with'."
  },
  {
    regex: /\b(listen)\s+(music|to music|podcast|audio)\b/gi,
    replacement: (m) => {
      if (m[2].toLowerCase() === 'to music') return m[0]
      return `listen to ${m[2]}`
    },
    category: 'grammar',
    explanation: (m) => `Use 'listen to' before an object ('listen to ${m[2]}').`
  },
  // Redundant expressions
  {
    regex: /\b(repeat)\s+(again)\b/gi,
    replacement: () => 'repeat',
    category: 'style',
    explanation: "Redundancy: 'repeat' already means to say or do again."
  },
  {
    regex: /\b(return|revert)\s+(back)\b/gi,
    replacement: (m) => m[1],
    category: 'style',
    explanation: (m) => `Redundancy: '${m[1]}' already implies moving back.`
  },
  // Lowercase standalone 'i'
  {
    regex: /(^|[\s.,!?;])(i)([\s.,!?;'’]|$)/g,
    replacement: (m) => `${m[1]}I${m[3]}`,
    category: 'grammar',
    explanation: "The personal pronoun 'I' is always capitalized."
  },
  {
    regex: /\b(english)\b/g,
    replacement: () => 'English',
    category: 'grammar',
    explanation: "'English' is a proper noun and should be capitalized."
  }
]

/**
 * Checks text for spelling and grammar issues.
 * Returns sorted, non-overlapping issues.
 */
export function checkGrammar(text: string): GrammarIssue[] {
  if (!text || !text.trim()) return []

  const rawIssues: GrammarIssue[] = []
  let issueCounter = 0

  // 1. Check Grammar Rules
  for (const rule of GRAMMAR_RULES) {
    rule.regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = rule.regex.exec(text)) !== null) {
      const matchIndex = match.index
      const matchText = match[0]
      const suggested = rule.replacement(match)

      // Skip if suggestion is identical to original match
      if (suggested.toLowerCase() === matchText.toLowerCase()) continue

      const explanation = typeof rule.explanation === 'function'
        ? rule.explanation(match)
        : rule.explanation

      rawIssues.push({
        id: `g_${++issueCounter}`,
        offset: matchIndex,
        length: matchText.length,
        originalText: matchText,
        suggestedReplacement: suggested,
        category: rule.category,
        explanation
      })

      // Avoid infinite loop on zero-width match
      if (match.index === rule.regex.lastIndex) {
        rule.regex.lastIndex++
      }
    }
  }

  // 2. Check Spelling Dictionary
  const wordRegex = /\b[A-Za-z']+\b/g
  let wordMatch: RegExpExecArray | null
  while ((wordMatch = wordRegex.exec(text)) !== null) {
    const rawWord = wordMatch[0]
    const lowerWord = rawWord.toLowerCase()
    const correction = SPELLING_DICTIONARY[lowerWord]

    if (correction && correction.toLowerCase() !== lowerWord) {
      // Preserve uppercase first letter if original had it
      const isCapitalized = /^[A-Z]/.test(rawWord)
      const formattedCorrection = isCapitalized
        ? correction.charAt(0).toUpperCase() + correction.slice(1)
        : correction

      rawIssues.push({
        id: `s_${++issueCounter}`,
        offset: wordMatch.index,
        length: rawWord.length,
        originalText: rawWord,
        suggestedReplacement: formattedCorrection,
        category: 'spelling',
        explanation: `Spelling suggestion for '${rawWord}'.`
      })
    }
  }

  // 3. Sort by start offset and filter overlapping issues
  rawIssues.sort((a, b) => a.offset - b.offset || b.length - a.length)

  const nonOverlapping: GrammarIssue[] = []
  let lastEnd = -1

  for (const issue of rawIssues) {
    const issueEnd = issue.offset + issue.length
    if (issue.offset >= lastEnd) {
      nonOverlapping.push(issue)
      lastEnd = issueEnd
    }
  }

  return nonOverlapping
}

/**
 * Applies a single grammar suggestion cleanly.
 */
export function applySuggestion(text: string, issue: GrammarIssue): string {
  const before = text.slice(0, issue.offset)
  const after = text.slice(issue.offset + issue.length)
  return `${before}${issue.suggestedReplacement}${after}`
}

/**
 * Applies all provided suggestions, updating offsets from right to left
 * so subsequent offsets remain valid.
 */
export function applyAllSuggestions(text: string, issues: GrammarIssue[]): string {
  if (!issues.length) return text

  // Sort descending by offset so changes at the end do not shift earlier offsets
  const sorted = [...issues].sort((a, b) => b.offset - a.offset)
  let current = text

  for (const issue of sorted) {
    current = applySuggestion(current, issue)
  }

  return current
}
