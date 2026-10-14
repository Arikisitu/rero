import { describe, it, expect } from 'vitest'
import {
  checkGrammar,
  applySuggestion,
  applyAllSuggestions,
  type GrammarIssue
} from './grammar'

describe('Offline Grammar and Spelling Engine', () => {
  it('detects subject-verb agreement errors', () => {
    const text = 'He go to the store and they was happy.'
    const issues = checkGrammar(text)

    expect(issues.some(i => i.originalText.toLowerCase().includes('he go'))).toBe(true)
    expect(issues.some(i => i.originalText.toLowerCase().includes('they was'))).toBe(true)
  })

  it('detects pronoun + is/are/am slips', () => {
    const text = 'I is learning and you is speaking.'
    const issues = checkGrammar(text)

    expect(issues.length).toBeGreaterThanOrEqual(2)
    const fixed = applyAllSuggestions(text, issues)
    expect(fixed).toContain('I am')
    expect(fixed).toContain('you are')
  })

  it('detects auxiliary verb tense errors (did + past)', () => {
    const text = 'I didn\'t went yesterday.'
    const issues = checkGrammar(text)

    expect(issues.length).toBe(1)
    expect(issues[0].suggestedReplacement.toLowerCase()).toBe("didn't go")
  })

  it('detects perfect tense participle errors', () => {
    const text = 'She has wrote three diary entries and have went home.'
    const issues = checkGrammar(text)

    expect(issues.some(i => i.suggestedReplacement.includes('written'))).toBe(true)
    expect(issues.some(i => i.suggestedReplacement.includes('gone'))).toBe(true)
  })

  it('detects article errors before vowel sounds', () => {
    const text = 'I ate a apple and saw a elephant.'
    const issues = checkGrammar(text)

    expect(issues.some(i => i.suggestedReplacement.includes('an apple'))).toBe(true)
    expect(issues.some(i => i.suggestedReplacement.includes('an elephant'))).toBe(true)
  })

  it('detects article errors before consonant sounds', () => {
    const text = 'This is an university with an car.'
    const issues = checkGrammar(text)

    expect(issues.some(i => i.suggestedReplacement.includes('a university'))).toBe(true)
    expect(issues.some(i => i.suggestedReplacement.includes('a car'))).toBe(true)
  })

  it('detects homophone confusion (your vs you\'re, better then)', () => {
    const text = 'Your welcome, it is better then yesterday.'
    const issues = checkGrammar(text)

    expect(issues.some(i => i.suggestedReplacement.toLowerCase().includes("you're welcome"))).toBe(true)
    expect(issues.some(i => i.suggestedReplacement.toLowerCase().includes('better than'))).toBe(true)
  })

  it('detects double negatives in speech', () => {
    const text = "I don't have no time today."
    const issues = checkGrammar(text)

    expect(issues.length).toBe(1)
    expect(issues[0].suggestedReplacement.toLowerCase()).toBe("don't have any")
  })

  it('detects common spelling mistakes', () => {
    const text = 'I definately recieved teh message.'
    const issues = checkGrammar(text)

    expect(issues.some(i => i.suggestedReplacement === 'definitely')).toBe(true)
    expect(issues.some(i => i.suggestedReplacement === 'received')).toBe(true)
    expect(issues.some(i => i.suggestedReplacement === 'the')).toBe(true)
  })

  it('applies a single suggestion at the exact offset', () => {
    const text = 'Yesterday he go home.'
    const issues = checkGrammar(text)
    const fixed = applySuggestion(text, issues[0])

    expect(fixed).toBe('Yesterday he goes home.')
  })

  it('applies all suggestions without offset corruption', () => {
    const text = 'I definately know that he go to school and they was there.'
    const issues = checkGrammar(text)
    const fixed = applyAllSuggestions(text, issues)

    expect(fixed).toContain('definitely')
    expect(fixed).toContain('he goes')
    expect(fixed).toContain('they were')
  })

  it('handles empty or clean sentences without false positives', () => {
    expect(checkGrammar('')).toEqual([])
    expect(checkGrammar('   ')).toEqual([])

    const clean = 'She went to the university and spoke with her friends yesterday.'
    const cleanIssues = checkGrammar(clean)
    expect(cleanIssues.length).toBe(0)
  })

  it('preserves the original text separately from corrected version', () => {
    const original = 'He go to the store and ate a apple.'
    const issues = checkGrammar(original)
    const corrected = applyAllSuggestions(original, issues)

    expect(original).toBe('He go to the store and ate a apple.')
    expect(corrected).toBe('He goes to the store and ate an apple.')
    expect(corrected).not.toBe(original)
  })

  it('filters overlapping issue offsets cleanly', () => {
    const issues: GrammarIssue[] = checkGrammar('I did went to an university.')
    // Verify no overlaps in returned issues
    for (let i = 0; i < issues.length - 1; i++) {
      expect(issues[i].offset + issues[i].length).toBeLessThanOrEqual(issues[i + 1].offset)
    }
  })
})
