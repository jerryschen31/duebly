import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App.jsx'

const deleteDb = () => {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('duebly-db')
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

const waitForAppReady = async () => {
  await waitFor(() => {
    expect(screen.queryByText(/Loading Duebly/i)).not.toBeInTheDocument()
  })
}

const addTaskViaComposer = async ({ user, text, recurring = null }) => {
  const descriptionInput = screen.getByRole('textbox', { name: /Task description/i })
  await user.clear(descriptionInput)
  await user.type(descriptionInput, text)

  if (recurring === 'daily') {
    await user.click(screen.getByRole('button', { name: /Set recurring rule/i }))
    await user.click(screen.getByRole('button', { name: /Repeat daily/i }))
  }

  await user.click(screen.getByRole('button', { name: /^Add Task$/i }))
}

beforeEach(async () => {
  await deleteDb()
})

describe('Desktop UAT (Vitest)', () => {
  test('Add Task: adding a non-recurring task is successful', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitForAppReady()

    await addTaskViaComposer({ user, text: 'vitest non recurring task' })

    expect(screen.getByText('vitest non recurring task')).toBeInTheDocument()
  })

  test('Add Task: adding a daily recurring task is successful', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitForAppReady()

    await addTaskViaComposer({ user, text: 'vitest recurring daily task', recurring: 'daily' })

    const recurringText = screen.getByText('vitest recurring daily task')
    expect(recurringText).toBeInTheDocument()
    expect(screen.getByText(/\(recurring\)/i)).toBeInTheDocument()
  })

  test('Task menu: Mark as Done moves a non-recurring Not Done task to Done', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitForAppReady()

    const taskText = 'vitest mark-as-done task'
    await addTaskViaComposer({ user, text: taskText })

    await user.click(screen.getByRole('button', { name: new RegExp(`Open menu for ${taskText}`) }))
    await user.click(screen.getByRole('button', { name: /Mark as Done/i }))

    await user.click(screen.getByRole('button', { name: /^Done \(/i }))
    expect(screen.getByText(taskText)).toBeInTheDocument()
  })

  test('Task menu: Edit task opens task description input in focus for editing', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitForAppReady()

    const taskText = 'vitest edit task focus'
    await addTaskViaComposer({ user, text: taskText })

    await user.click(screen.getByRole('button', { name: new RegExp(`Open menu for ${taskText}`) }))
    const editButtons = screen.getAllByRole('button', { name: /Edit task/i })
    await user.click(editButtons.at(-1))

    const editInput = screen.getByDisplayValue(taskText)
    await waitFor(() => {
      expect(editInput).toHaveFocus()
    })
  })
})
