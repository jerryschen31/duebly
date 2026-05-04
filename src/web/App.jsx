import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { taskModel, taskStorage } from './storage'

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

const RECURRING_MENU_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Repeat daily' },
  { value: 'weekly', label: 'Repeat weekly' },
]

const SWIPE_THRESHOLD = 70
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

const getSeriesId = (task) => task.originalTaskId || task.id

const getLabelByColor = (color) => {
  return LABELS.find((label) => label.color === color) || LABELS[0]
}

const toastVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
}

const syncService = {
  isAuthenticated: () => false,
  pullRemoteTasks: async () => [],
  pushMergedTasks: async () => {},
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
  const defaultTimeZone = getDefaultTimeZone()
  const [isReady, setIsReady] = useState(false)
  const [tasks, setTasks] = useState([])
  const [activeTab, setActiveTab] = useState(TAB_KEYS.notDone)
  const [menuTaskId, setMenuTaskId] = useState(null)
  const [labelSelectorTaskId, setLabelSelectorTaskId] = useState(null)
  const [isTimezoneMenuOpen, setIsTimezoneMenuOpen] = useState(false)
  const [selectedTimeZone, setSelectedTimeZone] = useState(defaultTimeZone)
  const [nowTick, setNowTick] = useState(() => taskModel.getNow())
  const [draftText, setDraftText] = useState('')
  const [draftDueDate, setDraftDueDate] = useState(() => toISODateInTimeZone(new Date(), defaultTimeZone))
  const [draftColor, setDraftColor] = useState(LABELS[0].color)
  const [isDraftDateAuto, setIsDraftDateAuto] = useState(true)
  const [isDraftLabelOpen, setIsDraftLabelOpen] = useState(false)
  const [isDraftRecurringMenuOpen, setIsDraftRecurringMenuOpen] = useState(false)
  const [draftRecurring, setDraftRecurring] = useState('none')
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [dragOffsets, setDragOffsets] = useState({})
  const [toasts, setToasts] = useState([])

  const toastTimeoutsRef = useRef(new Map())
  const longPressBubbleRef = useRef(null)
  const longPressTextRef = useRef(null)
  const textRefs = useRef(new Map())
  const mirrorLegacyRef = useRef(false)

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
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [])

  useEffect(() => {
    const toastTimeouts = toastTimeoutsRef.current
    return () => {
      toastTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
    }
  }, [])

  const pushToast = (message) => {
    const id = createId()
    setToasts((prev) => [...prev, { id, message }])

    const timeoutId = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
      toastTimeoutsRef.current.delete(id)
    }, TOAST_DURATION_MS)

    toastTimeoutsRef.current.set(id, timeoutId)
  }

  useEffect(() => {
    const syncOnReconnect = async () => {
      if (!syncService.isAuthenticated()) {
        return
      }

      try {
        const remoteTasks = await syncService.pullRemoteTasks()
        const merged = taskStorage.mergeForSync(tasks, remoteTasks, (localTask, remoteTask) => {
          if (import.meta.env.DEV) {
            console.warn('Equal timestamp conflict resolved with remote preference', {
              localTask,
              remoteTask,
            })
          }
        })

        setTasks(merged)
        await taskStorage.replaceAllTasks(merged, mirrorLegacyRef.current)
        await syncService.pushMergedTasks(merged)
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Deferred sync failed', error)
        }
      }
    }

    window.addEventListener('online', syncOnReconnect)
    return () => window.removeEventListener('online', syncOnReconnect)
  }, [tasks])

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
    return tasks
      .filter((task) => !task.isDone && task.dueDate > today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt)
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

    taskStorage.saveSettings(
      {
        timezone: selectedTimeZone,
        syncEnabled: false,
        statusIndicator: notDoneStatusStats,
      },
      mirrorLegacyRef.current,
    )
  }, [isReady, selectedTimeZone, notDoneStatusStats])

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

  const toggleTaskDone = (task, isDone) => {
    const updatedTask = updateTaskInState(task.id, (currentTask) => {
      if (isDone && currentTask.recurring !== 'none') {
        const days = currentTask.recurring === 'daily' ? 1 : 7
        return {
          ...currentTask,
          dueDate: addDaysToISODate(currentTask.dueDate, days),
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

    if (isDone && task.recurring !== 'none') {
      pushToast('Moved to next occurrence')
      setActiveTab(TAB_KEYS.notDone)
    }
  }

  const deleteTask = (taskId) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId))
    taskStorage.deleteTask(taskId, mirrorLegacyRef.current)
    setMenuTaskId(null)
    setLabelSelectorTaskId(null)
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
  }

  const beginEditTask = (task) => {
    setEditingTaskId(task.id)
    setEditingText(task.text)
    setMenuTaskId(null)
  }

  const saveEditTask = (taskId) => {
    const text = editingText.trim()
    if (!text) {
      setEditingTaskId(null)
      setEditingText('')
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

    setEditingTaskId(null)
    setEditingText('')
  }

  const cancelEditTask = () => {
    setEditingTaskId(null)
    setEditingText('')
  }

  const canSwipeRight = (task) => {
    return activeTab === TAB_KEYS.notDone && !task.isDone
  }

  const getSwipeTargetDate = (task) => {
    const days = task.recurring === 'weekly' ? 7 : 1
    return addDaysToISODate(today, days)
  }

  const getLaterToast = (targetDate) => {
    const label = targetDate === tomorrow ? 'tomorrow' : targetDate
    return `saving task for later (${label})`
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

  const onTaskSwipe = (task, offsetX) => {
    if (offsetX <= -SWIPE_THRESHOLD) {
      if (task.isDone) {
        deleteTask(task.id)
      } else {
        toggleTaskDone(task, true)
      }
      return
    }

    if (offsetX >= SWIPE_THRESHOLD && canSwipeRight(task)) {
      const targetDate = getSwipeTargetDate(task)
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
        pushToast(getLaterToast(targetDate))
      }
    }
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

    return task.recurring === 'weekly' ? '⏭ Later (+7d)' : '⏭ Later'
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

  if (!isReady) {
    return (
      <div className="app-shell loading-shell">
        <p>Loading Duedly…</p>
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
            Duedly
          </button>
          <ProgressRing completed={notDoneStatusStats.completed} total={notDoneStatusStats.total} />
        </div>
        <div className="top-right">
          <button
            type="button"
            className="ghost-button"
            onClick={() => window.alert('Login is not part of this MVP yet.')}
          >
            Login
          </button>
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
                  <div className="recurring-menu">
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
              <span>Label</span>
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

          {visibleTasks.map((task) => {
              const dragOffset = dragOffsets[task.id] || 0
              const swipeAction = dragOffset > 10 ? 'right' : dragOffset < -10 ? 'left' : null
              const label = getLabelByColor(task.color)

              return (
                <div key={task.id} className="task-row-shell">
                  <div className={`swipe-hint ${swipeAction ? `show ${swipeAction}` : ''}`}>
                    {swipeAction === 'left' ? (
                      <span>{task.isDone ? '🗑 Delete' : '✅ Done'}</span>
                    ) : null}
                    {swipeAction === 'right' && canSwipeRight(task) ? <span>{swipeRightHintLabel(task)}</span> : null}
                  </div>

                  <motion.article
                    className="task-row"
                    drag="x"
                    dragDirectionLock
                    dragConstraints={{ left: -110, right: 110 }}
                    dragElastic={0.25}
                    dragMomentum={false}
                    onDrag={(event, info) => {
                      setDragOffsets((prev) => ({
                        ...prev,
                        [task.id]: info.offset.x,
                      }))
                    }}
                    onDragEnd={(event, info) => {
                      setDragOffsets((prev) => {
                        const next = { ...prev }
                        delete next[task.id]
                        return next
                      })
                      onTaskSwipe(task, info.offset.x)
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
                      onTouchStart={() => {
                        longPressBubbleRef.current = window.setTimeout(() => {
                          pushToast(label.name)
                        }, 450)
                      }}
                      onTouchEnd={() => {
                        if (longPressBubbleRef.current) {
                          window.clearTimeout(longPressBubbleRef.current)
                        }
                      }}
                    />

                    <div className="task-main">
                      {editingTaskId === task.id ? (
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
                        onClick={() => setMenuTaskId((prev) => (prev === task.id ? null : task.id))}
                        aria-label={`Open menu for ${task.text}`}
                      >
                        ⋯
                      </button>
                      {menuTaskId === task.id ? (
                        <div className="task-menu">
                          <button type="button" onClick={() => beginEditTask(task)}>
                            Edit task
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLabelSelectorTaskId(task.id)
                              setMenuTaskId(null)
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
                </div>
              )
            })}
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
    </div>
  )
}

export default App
