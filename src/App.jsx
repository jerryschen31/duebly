import { useEffect, useMemo, useState } from 'react'
import './App.css'

const TASKS_STORAGE_KEY = 'duedly.tasks.v1'
const TIMEZONE_STORAGE_KEY = 'duedly.timezone.v1'
const getTimestamp = () => new Date().getTime()

const TAB_KEYS = {
  notDone: 'not-done',
  done: 'done',
  planned: 'planned',
}

const COLORS = [
  '#374151',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
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

const toISODateInTimeZone = (date, timeZone) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

const getDefaultTimeZone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

const normalizeTask = (task) => {
  if (!task || typeof task !== 'object') {
    return null
  }

  if (!task.id || !task.text || !task.dueDate) {
    return null
  }

  return {
    id: task.id,
    text: String(task.text),
    dueDate: String(task.dueDate),
    isDone: Boolean(task.isDone),
    color: COLORS.includes(task.color) ? task.color : COLORS[0],
    createdAt: Number.isFinite(task.createdAt) ? task.createdAt : getTimestamp(),
    completedAt: Number.isFinite(task.completedAt) ? task.completedAt : null,
  }
}

const loadTasks = () => {
  try {
    const raw = window.localStorage.getItem(TASKS_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map(normalizeTask).filter(Boolean)
  } catch {
    return []
  }
}

const loadTimeZone = () => {
  try {
    const saved = window.localStorage.getItem(TIMEZONE_STORAGE_KEY)
    if (!saved) {
      return getDefaultTimeZone()
    }

    return TIMEZONE_OPTIONS.includes(saved) ? saved : getDefaultTimeZone()
  } catch {
    return getDefaultTimeZone()
  }
}

function App() {
  const [tasks, setTasks] = useState(loadTasks)
  const [activeTab, setActiveTab] = useState(TAB_KEYS.notDone)
  const [menuTaskId, setMenuTaskId] = useState(null)
  const [taskColorPickerId, setTaskColorPickerId] = useState(null)
  const [isTimezoneMenuOpen, setIsTimezoneMenuOpen] = useState(false)
  const [selectedTimeZone, setSelectedTimeZone] = useState(loadTimeZone)
  const [nowTick, setNowTick] = useState(() => getTimestamp())
  const [draft, setDraft] = useState(() => ({
    text: '',
    dueDate: toISODateInTimeZone(new Date(), loadTimeZone()),
    color: COLORS[0],
  }))

  useEffect(() => {
    window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    window.localStorage.setItem(TIMEZONE_STORAGE_KEY, selectedTimeZone)
  }, [selectedTimeZone])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(getTimestamp())
    }, 60_000)

    return () => window.clearInterval(timer)
  }, [])

  const today = useMemo(() => {
    return toISODateInTimeZone(new Date(nowTick), selectedTimeZone)
  }, [nowTick, selectedTimeZone])

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

  const resetDraftDate = (timeZone) => {
    setDraft((prev) => ({ ...prev, dueDate: toISODateInTimeZone(new Date(), timeZone) }))
  }

  const addTask = (event) => {
    event.preventDefault()

    const text = draft.text.trim()
    if (!text || !draft.dueDate) {
      return
    }

    const newTask = {
      id: crypto.randomUUID(),
      text,
      dueDate: draft.dueDate,
      isDone: false,
      color: draft.color,
      createdAt: getTimestamp(),
      completedAt: null,
    }

    setTasks((prev) => [newTask, ...prev])
    setDraft((prev) => ({
      ...prev,
      text: '',
      dueDate: toISODateInTimeZone(new Date(), selectedTimeZone),
      color: COLORS[0],
    }))

    if (newTask.dueDate > today) {
      setActiveTab(TAB_KEYS.planned)
    } else {
      setActiveTab(TAB_KEYS.notDone)
    }
  }

  const updateTask = (taskId, updates) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) {
          return task
        }

        return { ...task, ...updates }
      }),
    )
  }

  const toggleTaskDone = (taskId, isDone) => {
    updateTask(taskId, {
      isDone,
      completedAt: isDone ? getTimestamp() : null,
    })
  }

  const deleteTask = (taskId) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId))
    setMenuTaskId(null)
    setTaskColorPickerId(null)
  }

  const updateTaskDate = (taskId, date) => {
    if (!date) {
      return
    }

    updateTask(taskId, { dueDate: date })
  }

  const setTaskColor = (taskId, color) => {
    updateTask(taskId, { color })
    setTaskColorPickerId(null)
  }

  const switchTab = (tabKey) => {
    setActiveTab(tabKey)
    setMenuTaskId(null)
    setTaskColorPickerId(null)
  }

  const renderEmptyMessage = () => {
    if (activeTab === TAB_KEYS.done) {
      return "No completed tasks yet."
    }

    if (activeTab === TAB_KEYS.planned) {
      return 'Nothing planned for the future.'
    }

    return "You're all caught up!"
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
                    const nextTimeZone = event.target.value
                    setSelectedTimeZone(nextTimeZone)
                    resetDraftDate(nextTimeZone)
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
        </div>
        <div className="top-right">
          <button type="button" className="ghost-button" onClick={() => window.alert('Share is coming soon.')}>Share</button>
          <button type="button" className="ghost-button" onClick={() => window.alert('Login is not part of this MVP yet.')}>Login</button>
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
            <input
              type="text"
              placeholder="Task description"
              value={draft.text}
              onChange={(event) => setDraft((prev) => ({ ...prev, text: event.target.value }))}
              maxLength={200}
              required
            />
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) => setDraft((prev) => ({ ...prev, dueDate: event.target.value }))}
              required
            />
            <div className="draft-color-picker">
              <span>Color</span>
              <div className="color-options">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-dot ${draft.color === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setDraft((prev) => ({ ...prev, color }))}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>
            <button type="submit" className="primary-button" disabled={!draft.text.trim() || !draft.dueDate}>
              Add Task
            </button>
          </form>
          <p className="today-label">
            Today ({selectedTimeZone}): <strong>{today}</strong>
          </p>
        </section>

        <section className="task-list" aria-live="polite">
          {visibleTasks.length === 0 ? <p className="empty-state">{renderEmptyMessage()}</p> : null}

          {visibleTasks.map((task) => (
            <article key={task.id} className="task-row">
              <input
                type="checkbox"
                checked={task.isDone}
                onChange={(event) => toggleTaskDone(task.id, event.target.checked)}
                aria-label={`Mark ${task.text} as done`}
              />

              <input
                className="task-date"
                type="date"
                value={task.dueDate}
                onChange={(event) => updateTaskDate(task.id, event.target.value)}
                aria-label={`Change date for ${task.text}`}
              />

              <div className="task-color-wrap">
                <button
                  type="button"
                  className="task-color"
                  style={{ backgroundColor: task.color }}
                  onClick={() =>
                    setTaskColorPickerId((prev) => (prev === task.id ? null : task.id))
                  }
                  aria-label={`Change color for ${task.text}`}
                />
                {taskColorPickerId === task.id ? (
                  <div className="task-color-menu">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="color-dot"
                        style={{ backgroundColor: color }}
                        onClick={() => setTaskColor(task.id, color)}
                        aria-label={`Set color ${color}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              <p className={`task-text ${task.isDone ? 'done' : ''}`}>{task.text}</p>

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
                    <button type="button" onClick={() => deleteTask(task.id)}>
                      Delete task
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}

export default App
