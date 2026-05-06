import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { taskModel, taskStorage } from './storage'
import { useAuth } from './auth/authContext'
import { appEnv } from './config/env'
import { createGoogleDriveClient } from './sync/googleDriveClient'
import { createSyncEngine } from './sync/syncEngine'

const TAB_KEYS = {
  notDone: 'not-done',
  done: 'done',
  planned: 'planned',
}

const LABELS = [
  { id: 'general', name: 'General', color: '#374151' },
  { id: 'priority', name: 'Priority', color: '#ef4444' },
  { id: 'work', name: 'Work', color: '#2563eb' },
  { id: 'life', name: 'Life', color: '#f97316' },
  { id: 'health', name: 'Health', color: '#16a34a' },
  { id: 'finance', name: 'Finance', color: '#eab308' },
  { id: 'family', name: 'Family', color: '#f472b6' },
  { id: 'home', name: 'Home', color: '#a3e635' },
  { id: 'errands', name: 'Errands', color: '#38bdf8' },
  { id: 'school', name: 'School', color: '#a855f7' },
  { id: 'event', name: 'Event', color: '#db2777' },
  { id: 'travel', name: 'Travel', color: '#a16207' },
]

const TIMEZONE_OPTIONS = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
]

const REPEAT_WEEKDAYS_SHORT_LABEL = 'M-F'
const RECURRING_MENU_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Repeat daily' },
  { value: 'weekly', label: 'Repeat weekly' },
  { value: 'weekdays', label: `Repeat ${REPEAT_WEEKDAYS_SHORT_LABEL}` },
]

const SWIPE_THRESHOLD = 70
const SWIPE_COMMIT_DELAY_MS = 170
const TOAST_DURATION_MS = 1800

const createId = () => {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const toISODateInTimeZone = (date, timeZone) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

const getSupportedTimeZone = (timeZoneCandidate) => {
  return TIMEZONE_OPTIONS.includes(timeZoneCandidate)
    ? timeZoneCandidate
    : TIMEZONE_OPTIONS[0]
}

const getDefaultTimeZone = () => {
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return getSupportedTimeZone(browserTimeZone)
}

const getISODateFromTimestampInTimeZone = (timestamp, timeZone) => {
  if (!Number.isFinite(timestamp)) {
    return null
  }

  return toISODateInTimeZone(new Date(timestamp), timeZone)
}

const addDaysToISODate = (isoDate, daysToAdd) => {
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  date.setUTCDate(date.getUTCDate() + daysToAdd)
  return date.toISOString().slice(0, 10)
}

const parseISODate = (isoDate) => {
  const date = new Date(`${isoDate}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

const getNextWeekdayISODate = (isoDate) => {
  const date = parseISODate(isoDate)
  if (!date) {
    return isoDate
  }

  for (let attempt = 0; attempt < 7; attempt += 1) {
    date.setUTCDate(date.getUTCDate() + 1)
    const day = date.getUTCDay()
    if (day !== 0 && day !== 6) {
      return date.toISOString().slice(0, 10)
    }
  }

  return isoDate
}

const getNextRecurringDate = (isoDate, recurringRule) => {
  if (recurringRule === 'daily') {
    return addDaysToISODate(isoDate, 1)
  }

  if (recurringRule === 'weekly') {
    return addDaysToISODate(isoDate, 7)
  }

  if (recurringRule === 'weekdays') {
    return getNextWeekdayISODate(isoDate)
  }

  return isoDate
}

const getSeriesId = (task) => task.originalTaskId || task.id

const getLabelByColor = (color) => {
  return LABELS.find((label) => label.color === color) || LABELS[0]
}

const toastVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
}

const SYNC_STATUS_LABELS = {
  idle: 'Sync idle',
  syncing: 'Syncing…',
  success: 'Synced',
  error: 'Sync error',
  offline: 'Offline',
}

const ProgressRing = ({ completed, total }) => {
  const size = 36
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="progress-ring" aria-label={`Not Done progress ${completed} out of ${total}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span>{completed}/{total}</span>
    </div>
  )
}

function App() {
  const {
    authEnabled,
    isAuthenticated,
    user,
    loading: authLoading,
    error: authError,
    login,
    logout,
    getGoogleAccessToken,
  } = useAuth()
  const defaultTimeZone = getDefaultTimeZone()
  const [isReady, setIsReady] = useState(false)
  const [tasks, setTasks] = useState([])
  const [activeTab, setActiveTab] = useState(TAB_KEYS.notDone)
  const [menuTaskId, setMenuTaskId] = useState(null)
  const [labelSelectorTaskId, setLabelSelectorTaskId] = useState(null)
  const [isTimezoneMenuOpen, setIsTimezoneMenuOpen] = useState(false)
  const [selectedTimeZone, setSelectedTimeZone] = useState(defaultTimeZone)
  const [nowTick, setNowTick] = useState(() => taskModel.getNow())
  const [viewportWidth, setViewportWidth] = useState(() => {
    if (typeof window === 'undefined') {
      return 390
    }

    return window.innerWidth
  })
  const [draftText, setDraftText] = useState('')
  const [draftDueDate, setDraftDueDate] = useState(() => toISODateInTimeZone(new Date(), defaultTimeZone))
  const [draftColor, setDraftColor] = useState(LABELS[0].color)
  const [isDraftDateAuto, setIsDraftDateAuto] = useState(true)
  const [isDraftLabelOpen, setIsDraftLabelOpen] = useState(false)
  const [isDraftRecurringMenuOpen, setIsDraftRecurringMenuOpen] = useState(false)
  const [draftRecurring, setDraftRecurring] = useState('none')
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [editingModalAnchor, setEditingModalAnchor] = useState(null)
  const [frequencySelectorTaskId, setFrequencySelectorTaskId] = useState(null)
  const [isTaskMenuOpenUp, setIsTaskMenuOpenUp] = useState(false)
  const [isFrequencyMenuOpenUp, setIsFrequencyMenuOpenUp] = useState(false)
  const [swipeIntentByTaskId, setSwipeIntentByTaskId] = useState({})
  const [swipeCommitByTaskId, setSwipeCommitByTaskId] = useState({})
  const [toasts, setToasts] = useState([])
  const [swatchHint, setSwatchHint] = useState(null)
  const [syncStatus, setSyncStatus] = useState('idle')
  const isMobileViewport = viewportWidth <= 640

  const toastTimeoutsRef = useRef(new Map())
  const longPressBubbleRef = useRef(null)
  const swatchHintTimeoutRef = useRef(null)
  const longPressTextRef = useRef(null)
  const taskMenuButtonRefs = useRef(new Map())
  const editModalInputRef = useRef(null)
  const swipeCommitTimeoutsRef = useRef(new Map())
  const textRefs = useRef(new Map())
  const mirrorLegacyRef = useRef(false)
  const localStateRef = useRef({ tasks: [], timezone: defaultTimeZone, statusIndicator: null })
  const syncEngineRef = useRef(null)
  const syncReadyRef = useRef(false)

  const cancelEditTask = useCallback(() => {
    setEditingTaskId(null)
    setEditingText('')
    setEditingModalAnchor(null)
  }, [])

  const getShouldOpenUp = (anchorElement, estimatedHeight = 240) => {
    if (!anchorElement) {
      return false
    }

    const rect = anchorElement.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const canFitBelow = spaceBelow >= estimatedHeight
    return !canFitBelow
  }

  useEffect(() => {
    let isMounted = true

    const initialize = async () => {
      const result = await taskStorage.initialize(defaultTimeZone)
      if (!isMounted) {
        return
      }

      mirrorLegacyRef.current = result.fallbackActive
      setTasks(result.tasks)
      setSelectedTimeZone(getSupportedTimeZone(result.settings.timezone || defaultTimeZone))
      setIsReady(true)
    }

    initialize()

    return () => {
      isMounted = false
    }
  }, [defaultTimeZone])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(taskModel.getNow())
    }, 60_000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) {
        return
      }

      if (!target.closest('.menu-wrap')) {
        setIsTimezoneMenuOpen(false)
      }

      if (!target.closest('.task-menu-wrap')) {
        setMenuTaskId(null)
        setFrequencySelectorTaskId(null)
        setIsTaskMenuOpenUp(false)
        setIsFrequencyMenuOpenUp(false)
      }

      if (!target.closest('.label-select-wrap')) {
        setIsDraftLabelOpen(false)
      }

      if (!target.closest('.recurring-menu-wrap')) {
        setIsDraftRecurringMenuOpen(false)
      }

      if (!target.closest('.task-label-selector-wrap')) {
        setLabelSelectorTaskId(null)
      }

      if (isMobileViewport && editingTaskId && !target.closest('.task-edit-modal')) {
        cancelEditTask()
      }

    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [cancelEditTask, editingTaskId, isMobileViewport])

  useEffect(() => {
    const toastTimeouts = toastTimeoutsRef.current
    const swipeCommitTimeouts = swipeCommitTimeoutsRef.current
    return () => {
      toastTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
      if (swatchHintTimeoutRef.current) {
        window.clearTimeout(swatchHintTimeoutRef.current)
      }
      swipeCommitTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
    }
  }, [])

  useEffect(() => {
    if (!isMobileViewport || !editingTaskId || !editModalInputRef.current) {
      return
    }

    const input = editModalInputRef.current
    window.requestAnimationFrame(() => {
      input.focus()
      const end = input.value.length
      input.setSelectionRange(end, end)
    })
  }, [isMobileViewport, editingTaskId])

  const pushToast = (message) => {
    const id = createId()
    setToasts((prev) => [...prev, { id, message }])

    const timeoutId = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
      toastTimeoutsRef.current.delete(id)
    }, TOAST_DURATION_MS)

    toastTimeoutsRef.current.set(id, timeoutId)
  }

  const showSwatchHint = (message, anchorRect) => {
    if (!anchorRect) {
      return
    }

    setSwatchHint({
      id: createId(),
      message,
      left: anchorRect.left + anchorRect.width / 2,
      top: Math.max(8, anchorRect.top - 8),
    })

    if (swatchHintTimeoutRef.current) {
      window.clearTimeout(swatchHintTimeoutRef.current)
    }

    swatchHintTimeoutRef.current = window.setTimeout(() => {
      setSwatchHint(null)
      swatchHintTimeoutRef.current = null
    }, 1300)
  }

  useEffect(() => {
    if (!appEnv.authEnabled || !appEnv.remoteSyncEnabled || syncEngineRef.current) {
      return
    }

    const driveClient = createGoogleDriveClient({ getAccessToken: getGoogleAccessToken })
    syncEngineRef.current = createSyncEngine({
      taskStorage,
      driveClient,
      getLocalState: () => localStateRef.current,
      applyLocalState: ({ tasks: mergedTasks, timezone }) => {
        setTasks(mergedTasks)
        setSelectedTimeZone(getSupportedTimeZone(timezone || defaultTimeZone))
      },
      onStatusChange: setSyncStatus,
    })
  }, [defaultTimeZone, getGoogleAccessToken])

  useEffect(() => {
    if (!isReady || !syncEngineRef.current) {
      return
    }

    let isMounted = true
    syncReadyRef.current = false

    syncEngineRef.current.start(Boolean(isAuthenticated))
      .then((bootstrapped) => {
        if (isMounted) {
          syncReadyRef.current = Boolean(bootstrapped)
        }
      })

    return () => {
      isMounted = false
      syncReadyRef.current = false
      syncEngineRef.current?.stop()
    }
  }, [isAuthenticated, isReady])

  useEffect(() => {
    return () => {
      if (syncEngineRef.current) {
        syncEngineRef.current.destroy()
        syncEngineRef.current = null
      }
    }
  }, [])

  const today = useMemo(() => {
    return toISODateInTimeZone(new Date(nowTick), selectedTimeZone)
  }, [nowTick, selectedTimeZone])
  const tomorrow = useMemo(() => addDaysToISODate(today, 1), [today])

  const effectiveDraftDueDate = isDraftDateAuto ? today : draftDueDate

  const notDoneTasks = useMemo(() => {
    return tasks
      .filter((task) => !task.isDone && task.dueDate <= today)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.createdAt - a.createdAt)
  }, [tasks, today])

  const doneTasks = useMemo(() => {
    return tasks
      .filter((task) => task.isDone)
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
  }, [tasks])

  const plannedTasks = useMemo(() => {
    const recurringSeriesSeen = new Set()
    return tasks
      .filter((task) => !task.isDone && task.dueDate > today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt)
      .filter((task) => {
        if (task.recurring === 'none') {
          return true
        }

        const seriesId = getSeriesId(task)
        if (recurringSeriesSeen.has(seriesId)) {
          return false
        }

        recurringSeriesSeen.add(seriesId)
        return true
      })
  }, [tasks, today])

  const visibleTasks = useMemo(() => {
    if (activeTab === TAB_KEYS.done) {
      return doneTasks
    }

    if (activeTab === TAB_KEYS.planned) {
      return plannedTasks
    }

    return notDoneTasks
  }, [activeTab, doneTasks, notDoneTasks, plannedTasks])

  const tabCounts = {
    [TAB_KEYS.notDone]: notDoneTasks.length,
    [TAB_KEYS.done]: doneTasks.length,
    [TAB_KEYS.planned]: plannedTasks.length,
  }

  const notDoneStatusStats = useMemo(() => {
    const completedTodayInScope = tasks.filter((task) => {
      if (!task.isDone || task.dueDate > today) {
        return false
      }

      return getISODateFromTimestampInTimeZone(task.completedAt, selectedTimeZone) === today
    }).length

    return {
      date: today,
      completed: completedTodayInScope,
      total: notDoneTasks.length + completedTodayInScope,
    }
  }, [tasks, today, selectedTimeZone, notDoneTasks.length])

  useEffect(() => {
    if (!isReady) {
      return
    }

    const syncEnabled = appEnv.remoteSyncEnabled && authEnabled && isAuthenticated
    taskStorage.saveSettings(
      {
        timezone: selectedTimeZone,
        syncEnabled,
        statusIndicator: notDoneStatusStats,
      },
      mirrorLegacyRef.current,
    )
  }, [authEnabled, isAuthenticated, isReady, notDoneStatusStats, selectedTimeZone])

  useEffect(() => {
    localStateRef.current = {
      tasks,
      timezone: selectedTimeZone,
      statusIndicator: notDoneStatusStats,
    }
  }, [notDoneStatusStats, selectedTimeZone, tasks])

  useEffect(() => {
    if (!isReady || !syncReadyRef.current || !syncEngineRef.current) {
      return
    }

    syncEngineRef.current.schedulePush()
  }, [isReady, selectedTimeZone, tasks])

  const persistTask = (task) => {
    taskStorage.saveTask(task, mirrorLegacyRef.current)
  }

  const updateTaskInState = (taskId, updater) => {
    let nextTask = null
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) {
          return task
        }

        nextTask = updater(task)
        return nextTask
      }),
    )

    return nextTask
  }

  const addTask = (event) => {
    event.preventDefault()

    const text = draftText.trim()
    if (!text || !effectiveDraftDueDate) {
      return
    }

    const newTask = {
      id: createId(),
      text,
      dueDate: effectiveDraftDueDate,
      isDone: false,
      color: draftColor,
      createdAt: taskModel.getNow(),
      completedAt: null,
      recurring: taskModel.recurringValues.includes(draftRecurring) ? draftRecurring : 'none',
      originalTaskId: null,
      last_updated: taskModel.getNowIso(),
    }

    setTasks((prev) => [newTask, ...prev])
    persistTask(newTask)

    setDraftText('')
    setDraftDueDate(today)
    setDraftColor(LABELS[0].color)
    setDraftRecurring('none')
    setIsDraftDateAuto(true)
    setIsDraftLabelOpen(false)
    setIsDraftRecurringMenuOpen(false)

    if (newTask.dueDate > today) {
      setActiveTab(TAB_KEYS.planned)
    } else {
      setActiveTab(TAB_KEYS.notDone)
    }
  }

  const getRecurringTargetDate = (recurringRule) => {
    return getNextRecurringDate(today, recurringRule)
  }

  const getLaterToast = (targetDate) => {
    return targetDate === tomorrow ? 'Moved to tomorrow' : `Moved to ${targetDate}`
  }

  const toggleTaskDone = (task, isDone, options = {}) => {
    const { suppressRecurringToast = false } = options
    const updatedTask = updateTaskInState(task.id, (currentTask) => {
      if (isDone && currentTask.recurring !== 'none') {
        return {
          ...currentTask,
          dueDate: getNextRecurringDate(currentTask.dueDate, currentTask.recurring),
          isDone: false,
          completedAt: null,
          last_updated: taskModel.getNowIso(),
        }
      }

      return {
        ...currentTask,
        isDone,
        completedAt: isDone ? taskModel.getNow() : null,
        last_updated: taskModel.getNowIso(),
      }
    })

    if (updatedTask) {
      persistTask(updatedTask)
    }

    if (isDone && task.recurring !== 'none' && updatedTask && !suppressRecurringToast) {
      pushToast('Moved to next occurrence')
      setActiveTab(TAB_KEYS.notDone)
    }
  }

  const deleteTask = (taskId) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId))
    setSwipeCommitByTaskId((prev) => {
      if (!prev[taskId]) {
        return prev
      }

      const next = { ...prev }
      delete next[taskId]
      return next
    })
    const commitTimeoutId = swipeCommitTimeoutsRef.current.get(taskId)
    if (commitTimeoutId) {
      window.clearTimeout(commitTimeoutId)
      swipeCommitTimeoutsRef.current.delete(taskId)
    }
    taskStorage.deleteTask(taskId, mirrorLegacyRef.current)
    setMenuTaskId(null)
    setLabelSelectorTaskId(null)
    setFrequencySelectorTaskId(null)
  }

  const updateTaskDate = (taskId, date) => {
    if (!date) {
      return
    }

    const updatedTask = updateTaskInState(taskId, (task) => ({
      ...task,
      dueDate: date,
      last_updated: taskModel.getNowIso(),
    }))

    if (updatedTask) {
      persistTask(updatedTask)
    }
  }

  const setTaskColor = (taskId, color) => {
    const updatedTask = updateTaskInState(taskId, (task) => ({
      ...task,
      color,
      last_updated: taskModel.getNowIso(),
    }))

    if (updatedTask) {
      persistTask(updatedTask)
    }

    setLabelSelectorTaskId(null)
    setMenuTaskId(null)
  }

  const switchTab = (tabKey) => {
    setActiveTab(tabKey)
    setMenuTaskId(null)
    setLabelSelectorTaskId(null)
    setFrequencySelectorTaskId(null)
    setIsTaskMenuOpenUp(false)
    setIsFrequencyMenuOpenUp(false)
  }

  const beginEditTask = (task) => {
    setEditingTaskId(task.id)
    setEditingText(task.text)
    setMenuTaskId(null)
    setFrequencySelectorTaskId(null)

    if (isMobileViewport) {
      const menuButton = taskMenuButtonRefs.current.get(task.id)
      if (menuButton) {
        const rect = menuButton.getBoundingClientRect()
        const modalWidth = Math.min(360, viewportWidth - 16)
        const modalLeft = Math.max(8, Math.min(rect.right - modalWidth, viewportWidth - modalWidth - 8))
        setEditingModalAnchor({
          left: modalLeft,
          top: Math.max(10, rect.top - 10),
          width: modalWidth,
        })
      }
    }
  }

  const saveEditTask = (taskId) => {
    const text = editingText.trim()
    if (!text) {
      cancelEditTask()
      return
    }

    const updatedTask = updateTaskInState(taskId, (task) => ({
      ...task,
      text,
      last_updated: taskModel.getNowIso(),
    }))

    if (updatedTask) {
      persistTask(updatedTask)
    }

    cancelEditTask()
  }

  const canSwipeRight = (task) => {
    return (activeTab === TAB_KEYS.notDone && !task.isDone) || (activeTab === TAB_KEYS.done && task.isDone)
  }

  const getSwipeTargetDate = (recurringRule) => {
    if (recurringRule === 'none') {
      return tomorrow
    }

    return getRecurringTargetDate(recurringRule)
  }

  const hasRecurringDuplicateAtDate = (task, targetDate) => {
    const taskSeriesId = getSeriesId(task)
    return tasks.some((candidate) => {
      if (candidate.id === task.id || candidate.isDone || candidate.dueDate !== targetDate) {
        return false
      }

      if (candidate.recurring !== task.recurring) {
        return false
      }

      return getSeriesId(candidate) === taskSeriesId
    })
  }

  const onTaskSwipe = (task, swipeDirection) => {
    if (swipeDirection === 'left') {
      if (task.isDone) {
        deleteTask(task.id)
        pushToast('Task Deleted')
      } else {
        toggleTaskDone(task, true, { suppressRecurringToast: true })
        pushToast('Moved to Done')
      }
      return
    }

    if (swipeDirection === 'right' && canSwipeRight(task)) {
      if (activeTab === TAB_KEYS.done && task.isDone) {
        const updatedTask = updateTaskInState(task.id, (currentTask) => ({
          ...currentTask,
          isDone: false,
          completedAt: null,
          last_updated: taskModel.getNowIso(),
        }))

        if (updatedTask) {
          persistTask(updatedTask)
        }
        return
      }

      const targetDate = getSwipeTargetDate(task.recurring)
      if (task.recurring !== 'none' && hasRecurringDuplicateAtDate(task, targetDate)) {
        pushToast(getLaterToast(targetDate))
        return
      }

      const updatedTask = updateTaskInState(task.id, (currentTask) => ({
        ...currentTask,
        dueDate: targetDate,
        last_updated: taskModel.getNowIso(),
      }))

      if (updatedTask) {
        persistTask(updatedTask)
        pushToast('Saved for tomorrow')
      }
    }
  }

  const getSwipeCommitThreshold = () => {
    return Math.max(SWIPE_THRESHOLD, Math.floor(viewportWidth / 3))
  }

  const startSwipeCommit = (task, swipeDirection) => {
    setSwipeCommitByTaskId((prev) => {
      if (prev[task.id]) {
        return prev
      }

      return {
        ...prev,
        [task.id]: swipeDirection,
      }
    })

    setSwipeIntentByTaskId((prev) => ({
      ...prev,
      [task.id]: swipeDirection,
    }))

    const timeoutId = window.setTimeout(() => {
      swipeCommitTimeoutsRef.current.delete(task.id)
      onTaskSwipe(task, swipeDirection)
      setSwipeCommitByTaskId((prev) => {
        if (!prev[task.id]) {
          return prev
        }

        const next = { ...prev }
        delete next[task.id]
        return next
      })
      setSwipeIntentByTaskId((prev) => {
        if (!prev[task.id]) {
          return prev
        }

        const next = { ...prev }
        delete next[task.id]
        return next
      })
    }, SWIPE_COMMIT_DELAY_MS)

    swipeCommitTimeoutsRef.current.set(task.id, timeoutId)
  }

  const onTaskTextLongPress = (taskId) => {
    const textElement = textRefs.current.get(taskId)
    if (!textElement) {
      return
    }

    const textNode = textElement.firstChild
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      return
    }

    const textValue = textNode.textContent || ''
    if (!textValue) {
      return
    }

    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, textValue.length)

    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  const swipeRightHintLabel = (task) => {
    if (!canSwipeRight(task)) {
      return null
    }

    if (activeTab === TAB_KEYS.done) {
      return 'Undo'
    }

    return 'Save for Later'
  }

  const rowShellMotionProps = isMobileViewport
    ? {
      initial: false,
      transition: { duration: 0 },
    }
    : {
      initial: false,
      exit: { opacity: 0, height: 0, marginBottom: 0 },
      transition: { duration: 0.18, ease: 'easeOut' },
    }

  const persistTaskBatch = ({ save = [], deleteIds = [] }) => {
    save.forEach((task) => {
      taskStorage.saveTask(task, mirrorLegacyRef.current)
    })
    deleteIds.forEach((taskId) => {
      taskStorage.deleteTask(taskId, mirrorLegacyRef.current)
    })
  }

  const changeTaskFrequency = (task, nextRecurring) => {
    const seriesId = getSeriesId(task)
    const nowIso = taskModel.getNowIso()
    const nowMs = taskModel.getNow()
    const nextDueDate = getRecurringTargetDate(nextRecurring)
    const futureSeriesTasks = tasks.filter((candidate) => {
      if (candidate.id === task.id || candidate.isDone) {
        return false
      }
      if (candidate.dueDate <= today) {
        return false
      }
      return getSeriesId(candidate) === seriesId
    })
    const deleteIds = futureSeriesTasks.map((candidate) => candidate.id)
    const deleteIdsSet = new Set(deleteIds)
    let nextTasks = tasks.filter((candidate) => !deleteIdsSet.has(candidate.id))
    const selectedTask = nextTasks.find((candidate) => candidate.id === task.id)
    if (!selectedTask) {
      setMenuTaskId(null)
      setFrequencySelectorTaskId(null)
      return
    }

    const updatedSelectedTask = {
      ...selectedTask,
      recurring: nextRecurring,
      originalTaskId: nextRecurring === 'none' ? null : seriesId,
      last_updated: nowIso,
    }

    nextTasks = nextTasks.map((candidate) => {
      if (candidate.id !== task.id) {
        return candidate
      }
      return updatedSelectedTask
    })

    const save = [updatedSelectedTask]
    if (nextRecurring !== 'none' && updatedSelectedTask.dueDate <= today) {
      const nextOccurrence = {
        id: createId(),
        text: updatedSelectedTask.text,
        dueDate: nextDueDate,
        isDone: false,
        color: updatedSelectedTask.color,
        createdAt: nowMs,
        completedAt: null,
        recurring: nextRecurring,
        originalTaskId: seriesId,
        last_updated: nowIso,
      }
      nextTasks = [nextOccurrence, ...nextTasks]
      save.push(nextOccurrence)
    }

    setTasks(nextTasks)
    persistTaskBatch({ save, deleteIds })
    setMenuTaskId(null)
    setFrequencySelectorTaskId(null)
  }

  const toggleTaskMenu = (taskId, triggerElement) => {
    setMenuTaskId((prev) => {
      if (prev === taskId) {
        setFrequencySelectorTaskId(null)
        setIsTaskMenuOpenUp(false)
        setIsFrequencyMenuOpenUp(false)
        return null
      }

      setFrequencySelectorTaskId(null)
      setIsTaskMenuOpenUp(getShouldOpenUp(triggerElement, 240))
      setIsFrequencyMenuOpenUp(false)
      return taskId
    })
  }

  const renderEmptyMessage = () => {
    if (activeTab === TAB_KEYS.done) {
      return 'No completed tasks yet.'
    }

    if (activeTab === TAB_KEYS.planned) {
      return 'Nothing planned for the future.'
    }

    return "You're all caught up!"
  }

  if (authEnabled && authLoading) {
    return (
      <div className="app-shell loading-shell">
        <p>Loading Duebly...</p>
      </div>
    )
  }

  if (authEnabled && !isAuthenticated) {
    return (
      <div className="app-shell loading-shell">
        <div className="auth-gate-card">
          <h1>Sign in to Duebly</h1>
          <p>Use your Google account via Kinde to enable secure task sync.</p>
          <button type="button" className="primary-button" onClick={() => login()}>
            Sign in with Google
          </button>
          {authError ? <p className="sync-status error">{authError}</p> : null}
        </div>
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="app-shell loading-shell">
        <p>Loading Duebly...</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="top-left">
          <div className="menu-wrap">
            <button
              type="button"
              className="icon-button"
              onClick={() => setIsTimezoneMenuOpen((prev) => !prev)}
              aria-label="Open menu"
            >
              ☰
            </button>
            {isTimezoneMenuOpen ? (
              <div className="menu-popover">
                <label htmlFor="timezone-select">Set Time Zone</label>
                <select
                  id="timezone-select"
                  value={selectedTimeZone}
                  onChange={(event) => {
                    setSelectedTimeZone(event.target.value)
                  }}
                >
                  {TIMEZONE_OPTIONS.map((timeZone) => (
                    <option key={timeZone} value={timeZone}>
                      {timeZone}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <button type="button" className="brand-button" onClick={() => switchTab(TAB_KEYS.notDone)}>
            Duebly
          </button>
          <ProgressRing completed={notDoneStatusStats.completed} total={notDoneStatusStats.total} />
        </div>
        <div className="top-right">
          {appEnv.remoteSyncEnabled && authEnabled ? (
            <span className={`sync-status ${syncStatus === 'error' ? 'error' : ''}`}>
              {SYNC_STATUS_LABELS[syncStatus] || SYNC_STATUS_LABELS.idle}
            </span>
          ) : null}
          {authEnabled ? (
            <>
              {user?.email ? <span className="user-chip">{user.email}</span> : null}
              <button type="button" className="ghost-button" onClick={() => logout()}>
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ghost-button"
              onClick={() => window.alert('Login is not part of this MVP yet.')}
            >
              Login
            </button>
          )}
        </div>
      </header>

      <nav className="tab-bar" aria-label="Task list tabs">
        <button
          type="button"
          className={`tab-button ${activeTab === TAB_KEYS.notDone ? 'active' : ''}`}
          onClick={() => switchTab(TAB_KEYS.notDone)}
        >
          Not Done ({tabCounts[TAB_KEYS.notDone]})
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === TAB_KEYS.done ? 'active' : ''}`}
          onClick={() => switchTab(TAB_KEYS.done)}
        >
          Done ({tabCounts[TAB_KEYS.done]})
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === TAB_KEYS.planned ? 'active' : ''}`}
          onClick={() => switchTab(TAB_KEYS.planned)}
        >
          Planned ({tabCounts[TAB_KEYS.planned]})
        </button>
      </nav>

      <main className="content">
        <section className="composer-card">
          <h1>Add Task</h1>
          <form className="composer" onSubmit={addTask}>
            <div className="composer-text-row">
              <div className="recurring-menu-wrap">
                <button
                  type="button"
                  className={`icon-button recurring-trigger ${draftRecurring !== 'none' ? 'active' : ''}`}
                  aria-label="Set recurring rule"
                  onClick={() => setIsDraftRecurringMenuOpen((prev) => !prev)}
                >
                  ☰
                </button>
                {isDraftRecurringMenuOpen ? (
                  <div className="task-menu recurring-menu">
                    {RECURRING_MENU_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={draftRecurring === option.value ? 'active' : ''}
                        aria-pressed={draftRecurring === option.value}
                        onClick={() => {
                          setDraftRecurring(option.value)
                          setIsDraftRecurringMenuOpen(false)
                        }}
                      >
                        <span>{option.label}</span>
                        <span className="recurring-option-check" aria-hidden="true">
                          {draftRecurring === option.value ? '✓' : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <label className="sr-only" htmlFor="new-task-text">
                Task description
              </label>
              <input
                id="new-task-text"
                type="text"
                placeholder="Task description"
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                maxLength={200}
                required
              />
            </div>
            <label className="sr-only" htmlFor="new-task-date">
              Due date
            </label>
            <div className="composer-meta-row">
              <input
                id="new-task-date"
                type="date"
                value={effectiveDraftDueDate}
                onChange={(event) => {
                  setDraftDueDate(event.target.value)
                  setIsDraftDateAuto(false)
                }}
                required
              />
              <div className="label-select-wrap">
                <button
                  type="button"
                  className="label-trigger"
                  onClick={() => setIsDraftLabelOpen((prev) => !prev)}
                >
                  <span className="label-dot" style={{ backgroundColor: draftColor }} />
                  <span>{getLabelByColor(draftColor).name}</span>
                </button>
                {isDraftLabelOpen ? (
                  <div className="label-dropdown">
                    {LABELS.map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        className="label-option"
                        onClick={() => {
                          setDraftColor(label.color)
                          setIsDraftLabelOpen(false)
                        }}
                      >
                        <span className="label-dot" style={{ backgroundColor: label.color }} />
                        <span>{label.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <button type="submit" className="primary-button" disabled={!draftText.trim() || !effectiveDraftDueDate}>
              Add Task
            </button>
          </form>
          <p className="today-label">
            Today ({selectedTimeZone}): <strong>{today}</strong>
          </p>
        </section>

        <section className="task-list" aria-live="polite">
          {visibleTasks.length === 0 ? <p className="empty-state">{renderEmptyMessage()}</p> : null}

            <AnimatePresence initial={false}>
            {visibleTasks.map((task) => {
              const label = getLabelByColor(task.color)
              const commitDirection = swipeCommitByTaskId[task.id] || null
              const swipeIntent = swipeIntentByTaskId[task.id] || null
              const isCommitInProgress = Boolean(commitDirection)
              const swipeDragLimit = Math.max(100, getSwipeCommitThreshold() + 20)
              const activeSwipe = commitDirection || swipeIntent
              const swipeClass = activeSwipe === 'left'
                ? task.isDone
                  ? 'delete'
                  : 'move-done'
                : activeSwipe === 'right'
                  ? activeTab === TAB_KEYS.done
                    ? 'undo'
                    : 'save-later'
                  : ''
              const swipeText = activeSwipe === 'left'
                ? task.isDone
                  ? 'Delete'
                  : 'Mark as Done'
                : activeSwipe === 'right' && canSwipeRight(task)
                  ? swipeRightHintLabel(task)
                  : ''
              const rowShellClassName =
                menuTaskId === task.id || frequencySelectorTaskId === task.id || labelSelectorTaskId === task.id
                  ? 'task-row-shell menu-open'
                  : 'task-row-shell'

              return (
                <motion.div
                  key={task.id}
                  className={rowShellClassName}
                  {...rowShellMotionProps}
                >
                  <div className={`swipe-hint ${activeSwipe ? 'show' : ''} ${swipeClass}`}>
                    <span>{swipeText}</span>
                  </div>

                  <motion.article
                    className="task-row"
                    drag={isCommitInProgress ? false : 'x'}
                    dragDirectionLock
                    dragConstraints={{ left: -swipeDragLimit, right: swipeDragLimit }}
                    dragElastic={0.08}
                    dragMomentum={false}
                    dragSnapToOrigin
                    dragTransition={{ bounceStiffness: 700, bounceDamping: 38 }}
                    style={{ touchAction: 'pan-y' }}
                    animate={
                      commitDirection === 'left'
                        ? { x: `-${Math.max(320, viewportWidth)}px`, opacity: 0 }
                        : commitDirection === 'right'
                          ? { x: `${Math.max(320, viewportWidth)}px`, opacity: 0 }
                          : { x: 0, opacity: 1 }
                    }
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    onDragEnd={(event, info) => {
                      setSwipeIntentByTaskId((prev) => {
                        if (!prev[task.id]) {
                          return prev
                        }

                        const next = { ...prev }
                        delete next[task.id]
                        return next
                      })

                      if (isCommitInProgress) {
                        return
                      }

                      const commitThreshold = getSwipeCommitThreshold()
                      const absOffset = Math.abs(info.offset.x)
                      if (absOffset < commitThreshold) {
                        return
                      }

                      const swipeDirection = info.offset.x < 0 ? 'left' : 'right'
                      if (swipeDirection === 'right' && !canSwipeRight(task)) {
                        return
                      }

                      startSwipeCommit(task, swipeDirection)
                    }}
                    onDrag={(event, info) => {
                      if (isCommitInProgress) {
                        return
                      }

                      const nextIntent = info.offset.x <= -12 ? 'left' : info.offset.x >= 12 && canSwipeRight(task) ? 'right' : null
                      setSwipeIntentByTaskId((prev) => {
                        const current = prev[task.id] || null
                        if (current === nextIntent) {
                          return prev
                        }

                        if (!nextIntent) {
                          if (!prev[task.id]) {
                            return prev
                          }

                          const next = { ...prev }
                          delete next[task.id]
                          return next
                        }

                        return {
                          ...prev,
                          [task.id]: nextIntent,
                        }
                      })
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={task.isDone}
                      onChange={(event) => toggleTaskDone(task, event.target.checked)}
                      aria-label={`Mark ${task.text} as done`}
                    />

                    <input
                      className="task-date"
                      type="date"
                      value={task.dueDate}
                      onChange={(event) => updateTaskDate(task.id, event.target.value)}
                      aria-label={`Change date for ${task.text}`}
                    />

                    <button
                      type="button"
                      className="task-color"
                      title={label.name}
                      style={{ backgroundColor: task.color }}
                      aria-label={`Label ${label.name}`}
                      onTouchStart={(event) => {
                        const swatchRect = event.currentTarget.getBoundingClientRect()
                        longPressBubbleRef.current = window.setTimeout(() => {
                          showSwatchHint(label.name, swatchRect)
                        }, 450)
                      }}
                      onTouchEnd={() => {
                        if (longPressBubbleRef.current) {
                          window.clearTimeout(longPressBubbleRef.current)
                          longPressBubbleRef.current = null
                        }
                      }}
                      onTouchCancel={() => {
                        if (longPressBubbleRef.current) {
                          window.clearTimeout(longPressBubbleRef.current)
                          longPressBubbleRef.current = null
                        }
                      }}
                    />

                    <div className="task-main">
                      {editingTaskId === task.id && !isMobileViewport ? (
                        <input
                          className="task-edit-input"
                          value={editingText}
                          onChange={(event) => setEditingText(event.target.value)}
                          onBlur={() => saveEditTask(task.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              saveEditTask(task.id)
                            }
                            if (event.key === 'Escape') {
                              cancelEditTask()
                            }
                          }}
                          ref={(element) => {
                            if (!element) {
                              return
                            }
                            window.requestAnimationFrame(() => {
                              element.focus()
                              const end = element.value.length
                              element.setSelectionRange(end, end)
                            })
                          }}
                        />
                      ) : (
                        <p
                          className={`task-text ${task.isDone ? 'done' : ''}`}
                          ref={(element) => {
                            if (element) {
                              textRefs.current.set(task.id, element)
                            } else {
                              textRefs.current.delete(task.id)
                            }
                          }}
                          onPointerDown={() => {
                            longPressTextRef.current = window.setTimeout(() => {
                              onTaskTextLongPress(task.id)
                            }, 450)
                          }}
                          onPointerUp={() => {
                            if (longPressTextRef.current) {
                              window.clearTimeout(longPressTextRef.current)
                            }
                          }}
                          onPointerLeave={() => {
                            if (longPressTextRef.current) {
                              window.clearTimeout(longPressTextRef.current)
                            }
                          }}
                        >
                          {task.text}
                          {task.recurring !== 'none' ? (
                            <span className="recurring-badge" aria-label="Recurring task">
                              {' '}↻ (recurring)
                            </span>
                          ) : null}
                        </p>
                      )}
                    </div>

                    <div className="task-menu-wrap">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={(event) => toggleTaskMenu(task.id, event.currentTarget)}
                        aria-label={`Open menu for ${task.text}`}
                        ref={(element) => {
                          if (element) {
                            taskMenuButtonRefs.current.set(task.id, element)
                          } else {
                            taskMenuButtonRefs.current.delete(task.id)
                          }
                        }}
                      >
                        ⋯
                      </button>
                      {menuTaskId === task.id ? (
                        <div className={`task-menu ${isTaskMenuOpenUp ? 'open-up' : ''}`}>
                          <button type="button" onClick={() => beginEditTask(task)}>
                            Edit task
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              setFrequencySelectorTaskId((prev) => {
                                const next = prev === task.id ? null : task.id
                                setIsFrequencyMenuOpenUp(next ? getShouldOpenUp(event.currentTarget, 200) : false)
                                return next
                              })
                            }}
                          >
                            Change frequency
                          </button>
                          {frequencySelectorTaskId === task.id ? (
                            <div className={`task-frequency-submenu ${isFrequencyMenuOpenUp ? 'open-up' : ''}`}>
                              {RECURRING_MENU_OPTIONS.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => changeTaskFrequency(task, option.value)}
                                >
                                  <span>{option.label}</span>
                                  <span className="recurring-option-check" aria-hidden="true">
                                    {task.recurring === option.value ? '✓' : ''}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setLabelSelectorTaskId(task.id)
                              setMenuTaskId(null)
                              setFrequencySelectorTaskId(null)
                            }}
                          >
                            Change label
                          </button>
                          <button type="button" onClick={() => deleteTask(task.id)}>
                            Delete task
                          </button>
                        </div>
                      ) : null}
                    </div>

                  </motion.article>

                  {labelSelectorTaskId === task.id ? (
                    <div className="task-label-selector-wrap">
                      <div className="task-label-selector">
                        {LABELS.map((item) => (
                          <button key={item.id} type="button" onClick={() => setTaskColor(task.id, item.color)}>
                            <span className="label-dot" style={{ backgroundColor: item.color }} />
                            <span>{item.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              )
            })}
            </AnimatePresence>
        </section>
      </main>

      <div className="toast-layer" aria-live="polite" aria-atomic="true">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className="toast"
              variants={toastVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.16 }}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {swatchHint ? (
          <motion.div
            key={swatchHint.id}
            className="swatch-hint"
            style={{ left: swatchHint.left, top: swatchHint.top }}
            variants={toastVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.14 }}
            aria-hidden="true"
          >
            {swatchHint.message}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isMobileViewport && editingTaskId ? (
        <div
          className="task-edit-modal"
          style={
            editingModalAnchor
              ? {
                left: editingModalAnchor.left,
                top: editingModalAnchor.top,
                width: editingModalAnchor.width,
              }
              : undefined
          }
        >
          <label className="sr-only" htmlFor="task-edit-modal-input">
            Edit task description
          </label>
          <input
            id="task-edit-modal-input"
            ref={editModalInputRef}
            className="task-edit-modal-input"
            value={editingText}
            onChange={(event) => setEditingText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                saveEditTask(editingTaskId)
              }
              if (event.key === 'Escape') {
                cancelEditTask()
              }
            }}
          />
          <div className="task-edit-modal-actions">
            <button type="button" className="ghost-button" onClick={cancelEditTask}>
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={() => saveEditTask(editingTaskId)}>
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
