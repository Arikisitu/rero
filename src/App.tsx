import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioLines, BookOpen, CalendarDays, Check, Clock3, Download, FileText,
  Flame, Headphones, Home, Mic, Moon, MoreHorizontal, Plus, Search, Settings,
  Sparkles, Sun, Trash2, Upload, Volume2, X, Pencil, ChartNoAxesColumn, Menu,
  GraduationCap
} from 'lucide-react'
import {
  type ActivityRecord,
  ACTIVITIES_STORE,
  calculateStreakStats,
  createWidgetSnapshot
} from './services/streak'
import { syncWidgetWithStats, checkInitialWidgetRoute } from './services/widgetBridge'
import {
  checkGrammar,
  applySuggestion,
  applyAllSuggestions,
  type GrammarIssue
} from './services/grammar'
import {
  startNativeAudioRecording,
  stopNativeAudioRecording,
  deleteNativeAudioFile
} from './services/audioRecorderBridge'

type Entry = {
  id: string
  title: string
  text: string
  originalText?: string
  date: string
  seconds: number
  expressions: string[]
  audioPath?: string
}
type Expression = { id: string; phrase: string; kind: string; learned: boolean; entryId?: string }
type Page = 'Dashboard' | 'Speaking Diary' | 'Lessons' | 'Expressions' | 'Timeline' | 'Progress' | 'Settings'

interface Lesson {
  id: string
  title: string
  level: string
  duration: string
  description: string
  prompt: string
  keyPhrases: string[]
  tips: string
}

const lessonsData: Lesson[] = [
  {
    id: 'lesson-1',
    title: 'Daily Reflection & Small Wins',
    level: 'Beginner friendly',
    duration: '2 min',
    description: 'Reflect on a small positive moment from your day and explain why it mattered.',
    prompt: 'What was a peaceful or satisfying moment from your day today? How did it make you feel?',
    keyPhrases: ['looking forward to', 'felt relaxed', 'make progress'],
    tips: 'Speak naturally. Don’t pause to fix minor grammar slips — focus on steady rhythm.'
  },
  {
    id: 'lesson-2',
    title: 'Expressing Nuance & Balance',
    level: 'Intermediate',
    duration: '3 min',
    description: 'Compare two perspectives or choices using transitional phrases.',
    prompt: 'Compare working from home versus going to an office, or reading physical books versus screens.',
    keyPhrases: ['on the other hand', 'as a result', 'in my opinion'],
    tips: 'Use contrasting connectors like "on the other hand" to show both sides smoothly.'
  },
  {
    id: 'lesson-3',
    title: 'Sharing a Meaningful Memory',
    level: 'Intermediate',
    duration: '3 min',
    description: 'Tell a short story about a place you visited or an unexpected conversation.',
    prompt: 'Describe a memorable trip, place, or conversation that stayed with you. What made it special?',
    keyPhrases: ['felt relaxed', 'as a result', 'looking forward to'],
    tips: 'Paint a picture using descriptive details about sounds, feelings, or sights.'
  },
  {
    id: 'lesson-4',
    title: 'Polite Requests & Practical Interactions',
    level: 'Practical',
    duration: '2 min',
    description: 'Practice natural, polite phrasing for daily life, cafes, and travel situations.',
    prompt: 'Imagine you are asking a coworker or hotel concierge for assistance with a schedule change.',
    keyPhrases: ['important task', 'manage my time', 'in my opinion'],
    tips: 'Use softening phrases like "would it be possible" or "could you please".'
  }
]

interface SpeechRecognitionResultLike {
  isFinal: boolean
  length: number
  [index: number]: {
    transcript: string
    confidence?: number
  }
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

interface SpeechRecognitionErrorEventLike {
  error?: string
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

const STORE = 'rero.entries.v1'
const EX_STORE = 'rero.expressions.v1'
const THEME_STORE = 'rero.theme.v1'
const starterEntries: Entry[] = []
const nav: { label: Page; icon: typeof Home }[] = [
  { label: 'Dashboard', icon: Home },
  { label: 'Speaking Diary', icon: Mic },
  { label: 'Lessons', icon: GraduationCap },
  { label: 'Expressions', icon: BookOpen },
  { label: 'Timeline', icon: CalendarDays },
  { label: 'Progress', icon: ChartNoAxesColumn },
  { label: 'Settings', icon: Settings }
]
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const day = () => new Date().toISOString().slice(0, 10)
const read = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}
const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return s > 0 ? `${m}m ${s}s` : `${m} min`
}
const formatTimer = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function appendFinalSegment(segments: string[], text: string): void {
  const clean = text.trim()
  if (!clean) return

  if (segments.length === 0) {
    segments.push(clean)
    return
  }

  const lastIndex = segments.length - 1
  const last = segments[lastIndex]

  // 1. Exact match with the last segment -> ignore duplicate
  if (last.toLowerCase() === clean.toLowerCase()) {
    return
  }

  // 2. The new segment is an expansion/superset of the last segment (starts with last segment)
  if (clean.toLowerCase().startsWith(last.toLowerCase())) {
    segments[lastIndex] = clean
    return
  }

  // 3. The last segment already ends with this new segment
  if (last.toLowerCase().endsWith(clean.toLowerCase())) {
    return
  }

  // 4. Overlapping words check at boundary (common on Android Chrome)
  const lastWords = last.split(/\s+/)
  const cleanWords = clean.split(/\s+/)
  let overlapCount = 0
  const maxOverlap = Math.min(lastWords.length, cleanWords.length, 8)

  for (let len = maxOverlap; len > 0; len--) {
    const lastSlice = lastWords.slice(-len).join(' ').toLowerCase()
    const cleanSlice = cleanWords.slice(0, len).join(' ').toLowerCase()
    if (lastSlice === cleanSlice) {
      overlapCount = len
      break
    }
  }

  if (overlapCount > 0) {
    const nonOverlapping = cleanWords.slice(overlapCount).join(' ')
    if (nonOverlapping) {
      segments[lastIndex] = `${last} ${nonOverlapping}`
    }
    return
  }

  segments.push(clean)
}

const suggestions = (text: string) => {
  const candidates = ['on the other hand', 'as a result', 'looking forward to', 'make progress', 'felt relaxed', 'in my opinion', 'important task', 'manage my time']
  return candidates.filter(p => text.toLowerCase().includes(p)).slice(0, 8)
}

function renderUnderlinedText(text: string, issues: GrammarIssue[]) {
  if (!issues.length || !text) return <>{text}</>

  const elements: (string | JSX.Element)[] = []
  let lastIndex = 0

  for (const issue of issues) {
    if (issue.offset > lastIndex) {
      elements.push(text.slice(lastIndex, issue.offset))
    }
    const spanText = text.slice(issue.offset, issue.offset + issue.length)
    elements.push(
      <span
        key={issue.id}
        className="grammar-error"
        title={issue.explanation}
      >
        {spanText}
      </span>
    )
    lastIndex = issue.offset + issue.length
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex))
  }

  return <>{elements}</>
}

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(() => read(STORE, starterEntries))
  const [expressions, setExpressions] = useState<Expression[]>(() => read(EX_STORE, []))
  const [page, setPage] = useState<Page>('Dashboard')
  const [dark, setDark] = useState<boolean>(() => {
    const saved = read<string | null>(THEME_STORE, null)
    if (saved !== null) return saved === 'dark'
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [title, setTitle] = useState('')
  const [recording, setRecording] = useState(false)
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)
  const [exprDraft, setExprDraft] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)

  const recognition = useRef<SpeechRecognitionInstance | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [mobileNav, setMobileNav] = useState(false)

  // Speech recognition and monotonic timer tracking refs
  const baseTextRef = useRef<string>('')
  const finalSegmentsRef = useRef<string[]>([])
  const interimRef = useRef<string>('')
  const timerRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const sessionSecondsRef = useRef<number>(0)

  // Grammar and audio recording tracking
  const [showGrammarReview, setShowGrammarReview] = useState(false)
  const [ignoredIssueIds, setIgnoredIssueIds] = useState<Set<string>>(new Set())
  const originalDraftRef = useRef<string>('')
  const lastAudioPathRef = useRef<string>('')

  const activeIssues = useMemo(() => {
    const all = checkGrammar(draft)
    return all.filter(issue => !ignoredIssueIds.has(issue.id))
  }, [draft, ignoredIssueIds])

  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(entries)) }, [entries])
  useEffect(() => { localStorage.setItem(EX_STORE, JSON.stringify(expressions)) }, [expressions])
  useEffect(() => {
    localStorage.setItem(THEME_STORE, dark ? 'dark' : 'light')
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])
  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(id)
  }, [notice])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      if (recognition.current) {
        try {
          recognition.current.onresult = null
          recognition.current.onerror = null
          recognition.current.onend = null
          recognition.current.stop()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  const [activities, setActivities] = useState<ActivityRecord[]>(() => read(ACTIVITIES_STORE, []))
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)

  useEffect(() => { localStorage.setItem(ACTIVITIES_STORE, JSON.stringify(activities)) }, [activities])

  const totalSeconds = entries.reduce((sum, e) => sum + e.seconds, 0)
  const streakStats = useMemo(() => {
    return calculateStreakStats(entries.map(e => e.date), activities, 1, day())
  }, [entries, activities])

  useEffect(() => {
    syncWidgetWithStats(createWidgetSnapshot(streakStats))
  }, [streakStats])

  useEffect(() => {
    checkInitialWidgetRoute().then(route => {
      if (route && nav.some(n => n.label === route)) {
        setPage(route as Page)
      }
    })
  }, [])

  function logActivity(type: 'speaking_session' | 'expression_practice' | 'lesson_completed', detail?: string) {
    const act: ActivityRecord = {
      id: uid(),
      type,
      date: day(),
      timestamp: Date.now(),
      detail
    }
    setActivities(old => [act, ...old])
  }

  function completeLesson(lesson: Lesson) {
    logActivity('lesson_completed', lesson.title)
    setNotice(`Lesson "${lesson.title}" completed! Daily streak updated.`)
  }

  const filteredEntries = entries.filter(e => `${e.title} ${e.text}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => b.date.localeCompare(a.date))
  const selected = entries.find(e => e.id === selectedEntry)

  function stopRecording(discard = false) {
    // 1. Stop timer and finalize elapsed monotonic duration
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (startTimeRef.current > 0) {
      const delta = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000))
      sessionSecondsRef.current += delta
      setElapsedSeconds(sessionSecondsRef.current)
      startTimeRef.current = 0
    }

    // 2. Commit any remaining interim text that didn't receive an isFinal event
    if (interimRef.current.trim() && !discard) {
      appendFinalSegment(finalSegmentsRef.current, interimRef.current.trim())
      interimRef.current = ''
      const parts = [
        baseTextRef.current.trim(),
        finalSegmentsRef.current.join(' ').trim()
      ].filter(Boolean)
      const finalized = parts.join(' ').trim()
      setDraft(finalized)
      if (!originalDraftRef.current) {
        originalDraftRef.current = finalized
      }
    } else {
      interimRef.current = ''
    }

    // 3. Stop native background audio recording service
    stopNativeAudioRecording(discard).then(res => {
      if (res.audioFilePath) {
        lastAudioPathRef.current = res.audioFilePath
      }
    })

    // 4. Clean up recognition instance and remove listeners to prevent duplicates
    if (recognition.current) {
      try {
        recognition.current.onresult = null
        recognition.current.onerror = null
        recognition.current.onend = null
        recognition.current.stop()
      } catch (error) {
        console.warn('Speech recognition stop warning:', error)
      }
      recognition.current = null
    }
    setRecording(false)

    // 5. Reveal grammar review suggestions only after recording ends
    if (!discard) {
      if (!originalDraftRef.current && draft.trim()) {
        originalDraftRef.current = draft.trim()
      }
      setShowGrammarReview(true)
    }
  }

  function startRecording() {
    stopRecording(true)

    originalDraftRef.current = draft.trim()
    setShowGrammarReview(false)
    setIgnoredIssueIds(new Set())

    // Also start native background audio recording service on Android
    startNativeAudioRecording().then(res => {
      if (res.audioFilePath) {
        lastAudioPathRef.current = res.audioFilePath
      }
    })

    const speechWin = window as unknown as SpeechWindow
    const SpeechRecognitionClass = speechWin.SpeechRecognition || speechWin.webkitSpeechRecognition
    if (!SpeechRecognitionClass) {
      setNotice('Online speech transcription is not available in this browser, but native background recording is active. You can speak or write below.')
      setPage('Speaking Diary')
      setRecording(true)
      return
    }

    try {
      const rec = new SpeechRecognitionClass()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'

      // Save user's current draft so manual typing is preserved
      baseTextRef.current = draft.trim()
      finalSegmentsRef.current = []
      interimRef.current = ''

      // Start elapsed timer
      startTimeRef.current = Date.now()
      setElapsedSeconds(sessionSecondsRef.current)
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = window.setInterval(() => {
        const now = Date.now()
        const delta = Math.floor((now - startTimeRef.current) / 1000)
        setElapsedSeconds(sessionSecondsRef.current + Math.max(0, delta))
      }, 500)

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        let currentInterim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i]
          const text = (res[0]?.transcript || '').trim()
          if (!text) continue

          if (res.isFinal) {
            appendFinalSegment(finalSegmentsRef.current, text)
          } else {
            const lastFinal = finalSegmentsRef.current[finalSegmentsRef.current.length - 1]
            if (!lastFinal || (!lastFinal.toLowerCase().endsWith(text.toLowerCase()) && !lastFinal.toLowerCase().includes(text.toLowerCase()))) {
              currentInterim += (currentInterim ? ' ' : '') + text
            }
          }
        }

        interimRef.current = currentInterim

        // Display combined text: base (typed earlier) + finalized segments + current interim
        const parts = [
          baseTextRef.current.trim(),
          finalSegmentsRef.current.join(' ').trim(),
          currentInterim.trim()
        ].filter(Boolean)
        setDraft(parts.join(' ').trim())
      }

      rec.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const err = event.error || ''
        if (err === 'no-speech') {
          setNotice('No speech detected. Speak a little closer to the microphone.')
        } else if (err === 'not-allowed' || err === 'service-not-allowed') {
          setNotice('Microphone permission was denied. Please allow microphone access in browser settings.')
        } else if (err === 'network') {
          setNotice('Speech recognition network disconnected, but background audio recording continues safely.')
        } else if (err !== 'aborted') {
          setNotice(`Microphone issue: ${err}`)
        }
        stopRecording(false)
      }

      rec.onend = () => {
        stopRecording(false)
      }

      recognition.current = rec
      rec.start()
      setRecording(true)
      setPage('Speaking Diary')
      setNotice('Listening… speak naturally. Background recording is active.')
    } catch {
      setNotice('Could not start the microphone. Check browser permissions.')
      stopRecording(true)
    }
  }

  function startNewEntry(presetTitle = '') {
    stopRecording(true)
    setDraft('')
    setTitle(presetTitle)
    setEditing(null)
    originalDraftRef.current = ''
    lastAudioPathRef.current = ''
    setShowGrammarReview(false)
    setIgnoredIssueIds(new Set())
    sessionSecondsRef.current = 0
    setElapsedSeconds(0)
    setPage('Speaking Diary')
  }

  function saveEntry() {
    if (!draft.trim()) { setNotice('Write or record something before saving.'); return }
    stopRecording(false)
    const existing = entries.find(e => e.id === editing)
    const actualSeconds = sessionSecondsRef.current > 0
      ? sessionSecondsRef.current
      : (existing?.seconds || 30)

    const item: Entry = {
      id: editing || uid(),
      title: title.trim() || draft.trim().split(/[.!?]/)[0].slice(0, 42) || 'Speaking practice',
      text: draft.trim(),
      originalText: originalDraftRef.current || draft.trim(),
      date: existing?.date || day(),
      seconds: actualSeconds,
      expressions: suggestions(draft),
      audioPath: lastAudioPathRef.current || existing?.audioPath
    }
    setEntries(old => existing ? old.map(e => e.id === editing ? item : e) : [item, ...old])
    logActivity('speaking_session', item.title)
    setExpressions(old => {
      const fresh = item.expressions.filter(p => !old.some(x => x.phrase.toLowerCase() === p.toLowerCase()))
      return [...old, ...fresh.map(phrase => ({ id: uid(), phrase, kind: 'Phrase', learned: false, entryId: item.id }))]
    })
    setDraft('')
    setTitle('')
    setEditing(null)
    originalDraftRef.current = ''
    lastAudioPathRef.current = ''
    sessionSecondsRef.current = 0
    setElapsedSeconds(0)
    setPage('Timeline')
    setSelectedEntry(item.id)
    setNotice(existing ? 'Entry updated.' : 'Entry saved. Your expressions were checked.')
  }

  function editEntry(entry: Entry) {
    stopRecording(true)
    setEditing(entry.id)
    setTitle(entry.title)
    setDraft(entry.text)
    originalDraftRef.current = entry.originalText || entry.text
    lastAudioPathRef.current = entry.audioPath || ''
    setShowGrammarReview(false)
    setIgnoredIssueIds(new Set())
    sessionSecondsRef.current = entry.seconds
    setElapsedSeconds(entry.seconds)
    setPage('Speaking Diary')
  }

  function deleteEntry(id: string) {
    const toDelete = entries.find(e => e.id === id)
    if (toDelete?.audioPath) {
      deleteNativeAudioFile(toDelete.audioPath)
    }
    setEntries(old => old.filter(e => e.id !== id))
    setExpressions(old => old.filter(e => e.entryId !== id))
    if (selectedEntry === id) setSelectedEntry(null)
    setNotice('Entry deleted.')
  }

  function handleApplySuggestion(issue: GrammarIssue) {
    setDraft(prev => applySuggestion(prev, issue))
  }

  function handleIgnoreSuggestion(issueId: string) {
    setIgnoredIssueIds(prev => new Set([...prev, issueId]))
  }

  function handleApplyAll() {
    setDraft(prev => applyAllSuggestions(prev, activeIssues))
    setNotice('All suggestions applied.')
  }

  function handleRevertToOriginal() {
    if (originalDraftRef.current) {
      setDraft(originalDraftRef.current)
      setNotice('Reverted to original transcript.')
    }
  }
  function addExpression() {
    if (!exprDraft.trim()) return
    const phrase = exprDraft.trim()
    setExpressions(old => [{ id: uid(), phrase, kind: 'My phrase', learned: false }, ...old])
    logActivity('expression_practice', phrase)
    setExprDraft(''); setNotice('Expression saved to your library.')
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), entries, expressions, activities }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `rero-backup-${day()}.json`; a.click(); URL.revokeObjectURL(url)
    setNotice('Backup downloaded.')
  }
  function importData(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        if (!Array.isArray(data.entries) || !Array.isArray(data.expressions)) throw new Error('Invalid backup')
        if (!window.confirm('Import this backup? Imported entries and expressions will be added to your current data.')) return
        const rawEntries = data.entries as Record<string, unknown>[]
        const rawExpressions = data.expressions as Record<string, unknown>[]

        const importedEntries: Entry[] = rawEntries
          .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && 'id' in x && 'text' in x)
          .map((x): Entry => ({
            id: String(x.id),
            title: typeof x.title === 'string' && x.title.trim() ? x.title : 'Speaking practice',
            text: String(x.text || ''),
            date: typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : day(),
            seconds: typeof x.seconds === 'number' && !isNaN(x.seconds) ? x.seconds : Math.max(30, String(x.text || '').trim().split(/\s+/).length * 3),
            expressions: Array.isArray(x.expressions) ? x.expressions.filter((s: unknown): s is string => typeof s === 'string') : []
          }))
          .filter((x: Entry) => Boolean(x.id && x.text.trim()))

        const importedExpressions: Expression[] = rawExpressions
          .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && 'id' in x && 'phrase' in x)
          .map((x): Expression => ({
            id: String(x.id),
            phrase: String(x.phrase || ''),
            kind: typeof x.kind === 'string' && x.kind.trim() ? x.kind : 'Phrase',
            learned: Boolean(x.learned),
            entryId: typeof x.entryId === 'string' ? x.entryId : undefined
          }))
          .filter((x: Expression) => Boolean(x.id && x.phrase.trim()))

        if (Array.isArray(data.activities)) {
          const rawActivities = data.activities as Record<string, unknown>[]
          const importedActs: ActivityRecord[] = rawActivities
            .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && 'id' in x && 'type' in x && 'date' in x)
            .map((x): ActivityRecord => ({
              id: String(x.id),
              type: (x.type === 'speaking_session' || x.type === 'expression_practice' || x.type === 'lesson_completed') ? x.type : 'speaking_session',
              date: typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : day(),
              timestamp: typeof x.timestamp === 'number' ? x.timestamp : Date.now(),
              detail: typeof x.detail === 'string' ? x.detail : undefined
            }))
            .filter((x: ActivityRecord) => Boolean(x.id))
          setActivities(old => [...importedActs.filter(x => !old.some(y => y.id === x.id)), ...old])
        }

        setEntries(old => [...importedEntries.filter(x => !old.some(y => y.id === x.id)), ...old])
        setExpressions(old => [...importedExpressions.filter(x => !old.some(y => y.id === x.id)), ...old])
        setNotice('Backup imported.')
      } catch { setNotice('That file is not a valid Rero backup.') }
    }
    reader.readAsText(file)
  }

  const sidebar = <aside className={`sidebar ${mobileNav ? 'show' : ''}`}>
    <div className="brand"><div className="brand-mark"><AudioLines size={22}/></div><div><strong>rero</strong><span>Speak · Learn · Grow</span></div><button className="icon-btn mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18}/></button></div>
    <div className="nav-label">YOUR SPACE</div>
    <nav>{nav.map(item => { const Icon = item.icon; return <button key={item.label} className={`nav-item ${page === item.label ? 'active' : ''}`} onClick={() => { setPage(item.label); setMobileNav(false) }}><Icon size={18}/><span>{item.label}</span>{item.label === 'Expressions' && expressions.length > 0 && <small>{expressions.length}</small>}</button> })}</nav>
    <div className="sidebar-bottom"><div className="quote-icon"><Sparkles size={17}/></div><p>Your voice.<br/>A better you.</p><span>One day at a time.</span><div className="privacy"><span className="privacy-dot"/> Private on this device</div></div>
  </aside>

  return <div className="app-shell">
    {sidebar}
    {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20}/></button><div className="breadcrumb">Your space <span>/</span> <b>{page}</b></div><div className="top-actions"><div className="date-chip"><CalendarDays size={15}/>{new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</div><button className="icon-btn" onClick={() => setDark(!dark)} title={dark ? 'Light theme' : 'Dark theme'}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><div className="avatar">R</div></div></header>
      <div className="page-wrap">
        {page === 'Dashboard' && <><div className="welcome-row"><div><div className="eyebrow">A LITTLE PROGRESS, EVERY DAY</div><h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'} 🌸</h1><p className="muted">Speak a little today. Progress happens in small moments.</p></div><div className="flower-art"><span>✿</span><i>✧</i></div></div>
          <div className="stats-grid"><Stat icon={Flame} label="Day streak" value={streakStats.currentStreak.toString()} hint={streakStats.todayCompleted ? 'Active today ✓' : `Best: ${streakStats.bestStreak} days`}/><Stat icon={Mic} label="Speaking minutes" value={Math.round(totalSeconds/60).toString()} hint="Total practice"/><Stat icon={BookOpen} label="Expressions saved" value={expressions.length.toString()} hint="Words worth keeping"/><Stat icon={FileText} label="Diary entries" value={entries.length.toString()} hint="Your story, collected"/></div>
          <div className="dashboard-grid"><section className="hero-card"><div className="hero-orb"><Mic size={28}/></div><div className="streak-badge-hero"><Flame size={14}/> {streakStats.currentStreak} day streak {streakStats.todayCompleted ? '· Active today ✓' : '· Goal: 1 practice'}</div><div className="eyebrow light">YOUR DAILY MOMENT</div><h2>Let’s speak today</h2><p>Share your thoughts, ideas, or anything from your day. No perfect sentences needed.</p><button className="btn btn-white" onClick={() => startNewEntry()}><Mic size={17}/> Start a diary entry <span>→</span></button><div className="hero-decoration">✳</div></section>
            <section className="panel recent-panel"><div className="section-head"><div><h3>Recent entries</h3><p className="muted small">Little moments from your life</p></div><button className="text-btn" onClick={() => setPage('Timeline')}>View all <span>→</span></button></div>{entries.length === 0 ? <Empty icon={Headphones} title="Your story starts here" text="Record or write your first speaking diary entry."/> : entries.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4).map(e=><EntryRow key={e.id} entry={e} onClick={() => {setSelectedEntry(e.id);setPage('Timeline')}}/>)}</section></div>
          <div className="bottom-grid"><section className="panel prompt-panel"><div className="prompt-icon"><Sparkles size={18}/></div><div><div className="eyebrow">TODAY’S SPEAKING PROMPT</div><h3>What is something small that made you happy recently?</h3><p className="muted small">Try speaking for 1–2 minutes without stopping to correct yourself.</p></div><button className="round-arrow" onClick={() => startNewEntry('Something that made me happy')}>↗</button></section><section className="panel mini-progress"><div className="section-head"><h3>Your journey</h3><button className="text-btn" onClick={() => setPage('Progress')}>Details →</button></div><div className="progress-line"><span style={{width: `${Math.min(100, entries.length*10)}%`}}/></div><p className="muted small">{entries.length === 0 ? 'Your first entry is the first step.' : `${entries.length} entries captured. Keep going at your own pace.`}</p></section></div>
        </>}
        {page === 'Speaking Diary' && <><PageHeading eyebrow="SPEAKING PRACTICE" title={editing ? 'Edit your entry' : 'Give your thoughts a voice'} subtitle="Talk naturally. You can tidy up your words afterward."/><div className="record-layout"><section className="panel record-card"><div className={`mic-circle ${recording ? 'is-recording' : ''}`}><Mic size={31}/></div><h2>{recording ? 'I’m listening…' : 'Ready when you are'}</h2><p className="muted">{recording ? 'Speak naturally. Background recording keeps your audio safe.' : 'There is no perfect way to begin.'}</p><div className="wave-bars">{Array.from({length:25},(_,i)=><i key={i} style={{height:`${recording ? 12+(i*7)%32 : 5+(i*3)%10}px`}}/>)}</div><div className={`recording-timer ${recording ? 'is-live' : ''}`}><Clock3 size={15}/><span>{formatTimer(elapsedSeconds)}</span></div>{recording ? <div style={{display:'flex',gap:'8px',flexWrap:'wrap',justifyContent:'center'}}><button className="btn btn-danger" onClick={() => stopRecording(false)}><span className="stop-square"/> Stop recording</button><button className="btn btn-secondary" onClick={() => stopRecording(true)}>Discard</button></div> : <button className="btn btn-primary" onClick={startRecording}><Mic size={17}/> Start recording</button>}<div className="record-note"><span className="privacy-dot"/>{' '}Your entries stay on this device</div></section>
          <section className="panel transcript-card"><div className="section-head"><div><h3>Your transcript</h3><p className="muted small">{recording ? 'Live transcription (errors underlined)' : 'Write or edit your words here'}</p></div><span className="live-tag">{recording && <i/>}{recording ? `LIVE · ${formatTimer(elapsedSeconds)}` : 'DRAFT'}</span></div><label className="field-label" htmlFor="entry-title">Entry title</label><input id="entry-title" className="text-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="A little moment from today"/><label className="field-label" htmlFor="entry-text">What’s on your mind?</label>{recording ? <div className="transcript-live-box"><div className="transcript-live-text">{draft ? renderUnderlinedText(draft, activeIssues) : <span className="muted">Listening for your speech…</span>}</div></div> : <textarea id="entry-text" className="transcript-input" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Start writing here, or tap Start recording and speak about your day…"/>}{!recording && activeIssues.length > 0 && <div className="grammar-review-box"><div className="grammar-review-head"><div className="grammar-review-title"><Sparkles size={16}/><span>Grammar &amp; Spelling ({activeIssues.length})</span></div><div className="grammar-review-actions"><button type="button" className="btn-grammar-apply" onClick={handleApplyAll}>Apply all</button><button type="button" className="btn-grammar-ignore" onClick={() => setShowGrammarReview(!showGrammarReview)}>{showGrammarReview ? 'Hide' : 'Review'}</button>{originalDraftRef.current && originalDraftRef.current !== draft && <button type="button" className="btn-grammar-ignore" onClick={handleRevertToOriginal}>Revert to original</button>}</div></div>{showGrammarReview && <div className="grammar-issue-list">{activeIssues.map(issue => <div key={issue.id} className="grammar-issue-card"><div className="grammar-issue-top"><span className={`grammar-issue-badge ${issue.category}`}>{issue.category}</span><div className="grammar-card-actions"><button type="button" className="btn-grammar-apply" onClick={() => handleApplySuggestion(issue)}>Apply</button><button type="button" className="btn-grammar-ignore" onClick={() => handleIgnoreSuggestion(issue.id)}>Dismiss</button></div></div><div className="grammar-diff"><span className="orig">{issue.originalText}</span><span>→</span><span className="repl">{issue.suggestedReplacement}</span></div><div className="grammar-explanation">{issue.explanation}</div></div>)}</div>}</div>}<div className="transcript-footer"><span className="muted small">{draft.trim() ? draft.trim().split(/\s+/).length : 0} words{elapsedSeconds > 0 ? ` · ${formatDuration(elapsedSeconds)}` : ''}</span><button className="btn btn-primary" onClick={saveEntry}><Check size={16}/>{editing ? 'Update entry' : 'Save entry'}</button></div></section></div><section className="tip-strip"><Sparkles size={18}/><div><strong>A gentle reminder</strong><p className="muted small">Fluency grows when you keep going, not when every sentence is perfect.</p></div></section></>}
        {page === 'Lessons' && <><PageHeading eyebrow="STRUCTURED SPEAKING PRACTICE" title="Guided Lessons" subtitle="Short, focused lessons designed to build fluency one small step at a time."/><div className="stats-grid"><Stat icon={GraduationCap} label="Lessons completed" value={activities.filter(a => a.type === 'lesson_completed').length.toString()} hint="All-time completed"/><Stat icon={Flame} label="Daily streak" value={streakStats.currentStreak.toString()} hint={streakStats.todayCompleted ? 'Active today ✓' : 'Complete a lesson to build'}/><Stat icon={Clock3} label="Practice time" value="2–3 min" hint="Bite-sized format"/><Stat icon={Sparkles} label="Daily goal" value={streakStats.todayCompleted ? 'Reached ✓' : '1 needed'} hint="Small daily steps"/></div><div className="lessons-grid">{lessonsData.map(lesson => { const isCompletedToday = activities.some(a => a.type === 'lesson_completed' && a.detail === lesson.title && a.date === day()); const isExpanded = activeLessonId === lesson.id; return <section key={lesson.id} className="panel lesson-card"><div className="lesson-top"><span className="pill">{lesson.level}</span><span className="muted small">{lesson.duration}</span>{isCompletedToday && <span className="pill pill-success">✓ Done today</span>}</div><h3>{lesson.title}</h3><p className="muted small">{lesson.description}</p><div className="chips">{lesson.keyPhrases.map(p => <span key={p} className="chip">{p}</span>)}</div>{isExpanded && <div className="lesson-expanded"><div className="prompt-box"><div className="prompt-label">PRACTICE PROMPT</div><p><strong>{lesson.prompt}</strong></p><p className="muted tiny">{lesson.tips}</p></div><div className="lesson-actions"><button className="btn btn-secondary" onClick={() => { startNewEntry(lesson.title); setDraft(`Prompt: ${lesson.prompt}\n\n`) }}><Mic size={15}/> Speak in diary ↗</button><button className="btn btn-primary" onClick={() => completeLesson(lesson)}><Check size={15}/> Complete lesson</button></div></div>}<div className="lesson-footer"><button className="text-btn" onClick={() => setActiveLessonId(isExpanded ? null : lesson.id)}>{isExpanded ? 'Hide details ↑' : 'Start lesson ↓'}</button></div></section> })}</div></>}
        {page === 'Timeline' && <><PageHeading eyebrow="YOUR PERSONAL ARCHIVE" title="My speaking timeline" subtitle="Look back at your journey and see how your expression grows over time."/><div className="toolbar"><div className="searchbox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your entries…"/></div><button className="btn btn-primary" onClick={() => startNewEntry()}><Plus size={17}/> New entry</button></div>{filteredEntries.length === 0 ? <div className="panel"><Empty icon={CalendarDays} title={search ? 'No matching entries' : 'Your timeline is waiting'} text={search ? 'Try another search term.' : 'Your diary entries will appear here after you save them.'}/></div> : <div className="timeline-layout"><div className="timeline-list"><div className="month-label">{new Date(`${filteredEntries[0].date}T12:00:00`).toLocaleDateString(undefined,{month:'long',year:'numeric'})}</div>{filteredEntries.map(e=><button key={e.id} className={`timeline-item ${selectedEntry===e.id?'selected':''}`} onClick={()=>setSelectedEntry(e.id)}><span className="timeline-dot"/><div className="timeline-date">{formatDate(e.date)} · {formatDuration(e.seconds)}</div><strong>{e.title}</strong><p>{e.text.slice(0,95)}{e.text.length>95?'…':''}</p></button>)}</div><div className="panel entry-detail">{selected ? <><div className="detail-top"><span className="pill">{formatDate(selected.date)} · {formatDuration(selected.seconds)}</span><div><button className="icon-btn" onClick={()=>editEntry(selected)} aria-label="Edit entry"><Pencil size={17}/></button><button className="icon-btn danger-icon" onClick={()=>{if(window.confirm('Delete this entry?')) deleteEntry(selected.id)}} aria-label="Delete entry"><Trash2 size={17}/></button></div></div><h2>{selected.title}</h2><p className="muted small">{new Date(`${selected.date}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p><div className="detail-section"><h4>Transcript</h4><p className="transcript-copy">{selected.text}</p></div>{selected.originalText && selected.originalText !== selected.text && <div className="detail-section"><details className="original-transcript-detail"><summary style={{cursor:'pointer',fontWeight:600,fontSize:'12px',color:'var(--purple-dark)'}}>View original spoken transcript</summary><p className="transcript-copy" style={{opacity:0.8,marginTop:'8px',fontStyle:'italic'}}>{selected.originalText}</p></details></div>}<div className="detail-section"><h4>Expressions noticed</h4><div className="chips">{selected.expressions.length ? selected.expressions.map(p=><span className="chip" key={p}>{p}</span>) : <span className="muted small">No automatic matches yet. You can add expressions manually in the library.</span>}</div></div></> : <Empty icon={FileText} title="Choose an entry" text="Select a moment from the timeline to read it here."/>}</div></div>}</>}
        {page === 'Expressions' && <><PageHeading eyebrow="YOUR PERSONAL PHRASEBOOK" title="Expression library" subtitle="Collect useful phrases and revisit them until they feel natural."/><div className="add-expression panel"><div className="prompt-icon"><BookOpen size={18}/></div><div className="add-expression-content"><h3>Save a phrase</h3><p className="muted small">Add a word, idiom, or expression you want to remember.</p><div className="inline-form"><input className="text-input" value={exprDraft} onChange={e=>setExprDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addExpression()} placeholder="e.g. I’m looking forward to…"/><button className="btn btn-primary" onClick={addExpression}><Plus size={16}/> Save</button></div></div></div><div className="toolbar"><div className="searchbox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find an expression…"/></div><span className="muted small">{expressions.filter(e=>e.learned).length} learned of {expressions.length}</span></div>{expressions.filter(e=>e.phrase.toLowerCase().includes(search.toLowerCase())).length === 0 ? <div className="panel"><Empty icon={BookOpen} title="Your phrasebook starts here" text="Save a phrase above, or save entries with expressions that match the built-in phrase list."/></div> : <div className="expression-grid">{expressions.filter(e=>e.phrase.toLowerCase().includes(search.toLowerCase())).map(e=><div className="expression-card panel" key={e.id}><div className="expression-card-top"><span className="pill">{e.kind}</span><button className="icon-btn" aria-label="Delete expression" onClick={()=>setExpressions(old=>old.filter(x=>x.id!==e.id))}><Trash2 size={16}/></button></div><h3>{e.phrase}</h3><div className="expression-bottom"><button className={`learn-toggle ${e.learned?'learned':''}`} onClick={()=>setExpressions(old=>old.map(x=>{if(x.id===e.id){if(!x.learned) logActivity('expression_practice', x.phrase);return {...x,learned:!x.learned}}return x}))}>{e.learned?<Check size={15}/>:<BookOpen size={15}/>} {e.learned?'Learned':'Mark learned'}</button><span className="muted tiny">{e.learned?'Nicely done':'Keep practicing'}</span></div></div>)}</div>}</>}
        {page === 'Progress' && <><PageHeading eyebrow="SMALL STEPS ADD UP" title="My progress" subtitle="A gentle look at your speaking practice and learning journey."/><div className="stats-grid"><Stat icon={Flame} label="Current streak" value={streakStats.currentStreak.toString()} hint={streakStats.todayCompleted ? 'Goal reached today ✓' : '1 activity to continue'}/><Stat icon={Sparkles} label="Best streak" value={streakStats.bestStreak.toString()} hint="All-time record"/><Stat icon={Clock3} label="Speaking minutes" value={Math.round(totalSeconds/60).toString()} hint="Estimated from practice"/><Stat icon={GraduationCap} label="Lessons completed" value={activities.filter(a => a.type === 'lesson_completed').length.toString()} hint="Structured lessons"/></div><div className="progress-page-grid"><section className="panel"><div className="section-head"><div><h3>Recent activity</h3><p className="muted small">Entries and practice by day</p></div><span className="pill">Last 7 days</span></div><div className="bar-chart">{Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const ds=d.toISOString().slice(0,10);const count=entries.filter(e=>e.date===ds).length+activities.filter(a=>a.date===ds).length;return <div className="bar-col" key={ds}><div className="bar-value">{count||''}</div><div className="bar-track"><div className="bar-fill" style={{height:`${Math.max(count?12:3,Math.min(100,count*28))}%`}}/></div><span>{d.toLocaleDateString(undefined,{weekday:'short'})}</span></div>})}</div><div className="weekly-strip">{streakStats.weeklyDays.map(d=><div key={d.date} className="weekly-dot-col"><span className="muted tiny">{d.dayShort}</span><span className={`weekly-dot ${d.completed?'active':''} ${d.isToday?'today':''}`} title={`${d.dayName} (${d.date}): ${d.completed?'Completed':'No activity'}`}/></div>)}</div></section><section className="panel insight-panel"><div className="prompt-icon"><Sparkles size={18}/></div><h3>Consistency over perfection</h3><p className="muted">You don’t need a long session to improve. A few minutes of speaking, a quick lesson, or learning a new expression keeps your momentum alive.</p><div className="insight-number">{streakStats.totalActiveDays}<span> active {streakStats.totalActiveDays===1?'day':'days'}</span></div></section></div></>}
        {page === 'Settings' && <><PageHeading eyebrow="YOUR SPACE, YOUR WAY" title="Settings" subtitle="Manage your data and make Rero feel like yours."/><div className="settings-stack"><section className="panel settings-card"><div className="settings-icon"><Download size={19}/></div><div className="settings-body"><h3>Export your data</h3><p className="muted small">Download your entries and expressions as a JSON backup.</p></div><button className="btn btn-secondary" onClick={exportData}>Export data</button></section><section className="panel settings-card"><div className="settings-icon"><Upload size={19}/></div><div className="settings-body"><h3>Import a backup</h3><p className="muted small">Restore data from a previous Rero JSON export.</p></div><button className="btn btn-secondary" onClick={()=>fileInput.current?.click()}>Choose file</button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={e=>{importData(e.target.files?.[0]); e.target.value = ''}}/></section><section className="panel settings-card"><div className="settings-icon"><Moon size={19}/></div><div className="settings-body"><h3>Appearance</h3><p className="muted small">Choose the look that feels right.</p></div><button className="btn btn-secondary" onClick={()=>setDark(!dark)}>{dark?'Switch to light':'Switch to dark'} mode</button></section><section className="panel settings-card"><div className="settings-icon"><Volume2 size={19}/></div><div className="settings-body"><h3>Voice support</h3><p className="muted small">Uses browser speech recognition and speech synthesis where supported.</p></div><button className="btn btn-secondary" onClick={()=>{if('speechSynthesis' in window){const u=new SpeechSynthesisUtterance('Hello. Welcome to Rero. Keep speaking, learning, and growing.');window.speechSynthesis.speak(u);setNotice('Playing a voice test.')}else setNotice('Speech synthesis is not supported in this browser.')}}>Test voice</button></section><section className="panel danger-zone"><div><h3>Clear all data</h3><p className="muted small">Permanently remove diary entries and expressions from this browser.</p></div><button className="btn btn-danger-outline" onClick={()=>{if(window.confirm('This permanently deletes all Rero entries and expressions stored in this browser. Export a backup first if you need one.')){setEntries([]);setExpressions([]);setActivities([]);setSelectedEntry(null);setNotice('All local data cleared.')}}}><Trash2 size={16}/> Clear data</button></section></div><p className="footnote">Rero v1.0 · Free, private, and ad-free. Your diary stays in this browser unless you export it.</p></>}
      </div>
      <footer className="app-footer"><span>Made for your growth <span className="heart">♥</span></span><span>Rero · Speak a little today</span></footer>
    </main>
    {notice && <div className="toast" role="status"><Check size={16}/>{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss"><X size={14}/></button></div>}
  </div>
}

function Stat({icon: Icon,label,value,hint}:{icon:typeof Flame,label:string,value:string,hint:string}) {
  return <div className="stat-card"><div className="stat-top"><span className="stat-icon"><Icon size={18}/></span><MoreHorizontal size={17} className="muted-icon"/></div><div className="stat-value">{value}</div><div className="stat-label">{label}</div><div className="stat-hint">{hint}</div></div>
}
function PageHeading({eyebrow,title,subtitle}:{eyebrow:string,title:string,subtitle:string}) { return <div className="page-heading"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="muted">{subtitle}</p></div> }
function Empty({icon: Icon,title,text}:{icon:typeof Home,title:string,text:string}) { return <div className="empty-state"><div className="empty-icon"><Icon size={23}/></div><h3>{title}</h3><p className="muted small">{text}</p></div> }
function EntryRow({entry,onClick}:{entry:Entry,onClick:()=>void}) { return <button className="recent-entry" onClick={onClick}><span className="entry-thumb"><FileText size={17}/></span><span className="entry-info"><strong>{entry.title}</strong><small>{formatDate(entry.date)} · {formatDuration(entry.seconds)}</small></span><span className="entry-arrow">↗</span></button> }
