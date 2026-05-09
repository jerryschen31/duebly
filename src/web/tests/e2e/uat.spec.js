import { test, expect } from '@playwright/test'

const taskText = {
  notDoneNonRecurring: 'e2e non recurring task',
  doneDeleteTarget: 'e2e done delete target',
  recurringDaily: 'e2e recurring daily task',
  markDoneViaMenu: 'e2e mark done via menu',
  editViaMenu: 'e2e edit via menu',
}

const ensureComposerOpen = async (page) => {
  const descriptionInput = page.getByRole('textbox', { name: /Task description/i })
  if ((await descriptionInput.count()) === 0) {
    const collapsedToggle = page.locator('.composer-toggle-button.collapsed')
    if (await collapsedToggle.count()) {
      await collapsedToggle.first().click()
    } else {
      await page.getByRole('button', { name: /Expand Add Task|Add Task/i }).first().click()
    }
  }

  await expect(descriptionInput.first()).toBeVisible()
  return descriptionInput.first()
}

const addTask = async (page, text) => {
  const descriptionInput = await ensureComposerOpen(page)
  await descriptionInput.fill(text)
  await page.getByRole('button', { name: /^Add Task$/i }).click()
  await expect(page.getByText(text)).toBeVisible()
}

const setComposerTimeRange = async (page, startTime, endTime) => {
  await ensureComposerOpen(page)
  await page.locator('.composer-date-trigger').click()
  const dialog = page.getByRole('dialog', { name: /Due date/i })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('combobox', { name: /Start time/i }).fill(startTime)
  await dialog.getByRole('combobox', { name: /End time/i }).fill(endTime)
  await (await ensureComposerOpen(page)).click()
}

const setRecurringDaily = async (page) => {
  await page.getByRole('button', { name: /Set recurring rule/i }).click()
  await page.getByRole('button', { name: /Repeat daily/i }).click()
}

const openTaskMenuFor = async (page, text) => {
  await page.getByRole('button', { name: `Open menu for ${text}`, exact: true }).click()
}

const getTaskRow = (page, text) => page.locator('.task-row', { hasText: text }).first()

const swipeTaskRow = async (page, rowLocator, direction) => {
  const box = await rowLocator.boundingBox()
  expect(box).toBeTruthy()
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  const deltaX = direction === 'left' ? -520 : 520

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + deltaX, startY, { steps: 12 })
  await page.mouse.up()
}

const assertVisibleElementWithinViewport = async (locator, page) => {
  if (!(await locator.isVisible())) {
    return
  }

  const box = await locator.boundingBox()
  if (!box) {
    return
  }

  const viewport = page.viewportSize()
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.y).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual((viewport?.width || 9999) + 1)
  expect(box.y + box.height).toBeLessThanOrEqual((viewport?.height || 9999) + 1)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = function SpeechRecognition() {}
    window.webkitSpeechRecognition = window.SpeechRecognition
  })
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
    return new Promise((resolve) => {
      const deleteRequest = indexedDB.deleteDatabase('duebly-db')
      deleteRequest.onsuccess = () => resolve()
      deleteRequest.onerror = () => resolve()
      deleteRequest.onblocked = () => resolve()
    })
  })
  await page.reload()
  await expect(page.getByText(/Loading Duebly/i)).toBeHidden()
})

test('UAT 1: With 10 tasks, menus and pickers stay on-screen (no cutoff)', async ({ page }) => {
  for (let i = 1; i <= 10; i += 1) {
    await addTask(page, `overflow task ${i}`)
  }

  // Open nav menu and timezone submenu.
  await page.getByRole('button', { name: 'Open menu', exact: true }).click()
  await page.getByRole('button', { name: /Set Time Zone/i }).click()
  await assertVisibleElementWithinViewport(page.locator('.menu-popover-top'), page)
  await assertVisibleElementWithinViewport(page.locator('.menu-submenu'), page)
  await page.getByRole('button', { name: 'Open menu', exact: true }).click()

  // Open composer date/time picker and a time options list.
  await ensureComposerOpen(page)
  await page.locator('.composer-date-trigger').click()
  const dateDialog = page.getByRole('dialog', { name: /Due date/i })
  await dateDialog.getByRole('combobox', { name: /Start time/i }).click()
  await assertVisibleElementWithinViewport(page.locator('.date-time-picker'), page)
  await assertVisibleElementWithinViewport(page.locator('.time-options').first(), page)
  await page.keyboard.press('Escape')

  // Open task menu and secondary frequency submenu.
  await openTaskMenuFor(page, 'overflow task 1')
  await page.getByRole('button', { name: /Change frequency/i }).click()
  await assertVisibleElementWithinViewport(page.locator('.task-menu').first(), page)
  await assertVisibleElementWithinViewport(page.locator('.task-frequency-submenu').first(), page)
  await page.mouse.click(8, 8)

  // Open label selector from menu.
  await openTaskMenuFor(page, 'overflow task 1')
  await page.getByRole('button', { name: /Change label/i }).click()
  await assertVisibleElementWithinViewport(page.locator('.task-label-selector').first(), page)
})

test('UAT 2 and 3: Add non-recurring and daily recurring tasks with start/end time', async ({ page }) => {
  await (await ensureComposerOpen(page)).fill('time range non recurring')
  await setComposerTimeRange(page, '2:30 pm', '4:30 pm')
  await page.getByRole('button', { name: /^Add Task$/i }).click()
  const nonRecurringRow = getTaskRow(page, 'time range non recurring')
  await expect(nonRecurringRow).toBeVisible()
  await expect(nonRecurringRow).toContainText(/2:30\s*pm\s*[–-]\s*4:30\s*pm/i)

  await (await ensureComposerOpen(page)).fill('time range daily recurring')
  await setRecurringDaily(page)
  await setComposerTimeRange(page, '9:00 am', '10:00 am')
  await page.getByRole('button', { name: /^Add Task$/i }).click()
  const recurringRow = getTaskRow(page, 'time range daily recurring')
  await expect(recurringRow).toBeVisible()
  await expect(recurringRow).toContainText(/9:00\s*am\s*[–-]\s*10:00\s*am/i)
  await expect(recurringRow).toContainText(/\(recurring\)/i)
})

test('UAT 4: Swipe left on Not Done non-recurring task moves it to Done', async ({ page }) => {
  await addTask(page, taskText.notDoneNonRecurring)
  await swipeTaskRow(page, getTaskRow(page, taskText.notDoneNonRecurring), 'left')

  await page.getByRole('button', { name: /^Done \(\d+\)$/ }).click()
  await expect(page.getByText(taskText.notDoneNonRecurring)).toBeVisible()
})

test('UAT 5: Swipe right on Not Done non-recurring task moves it to Planned', async ({ page }) => {
  await addTask(page, 'e2e swipe-right planned')
  await swipeTaskRow(page, getTaskRow(page, 'e2e swipe-right planned'), 'right')

  await page.getByRole('button', { name: /^Planned \(\d+\)$/ }).click()
  await expect(page.getByText('e2e swipe-right planned')).toBeVisible()
})

test('UAT 6 and 7: Swipe left on Done deletes, swipe right on Done undoes', async ({ page }) => {
  const undoTarget = 'e2e done undo target'
  await addTask(page, taskText.doneDeleteTarget)
  await addTask(page, undoTarget)

  await swipeTaskRow(page, getTaskRow(page, taskText.doneDeleteTarget), 'left')
  await swipeTaskRow(page, getTaskRow(page, undoTarget), 'left')

  await page.getByRole('button', { name: /^Done \(\d+\)$/ }).click()

  await swipeTaskRow(page, getTaskRow(page, taskText.doneDeleteTarget), 'left')
  await expect(page.getByText(taskText.doneDeleteTarget)).toHaveCount(0)

  await swipeTaskRow(page, getTaskRow(page, undoTarget), 'right')
  await expect(page.getByText(undoTarget)).toHaveCount(0)

  await page.getByRole('button', { name: /^Not Done \(\d+\)$/ }).click()
  await expect(page.getByText(undoTarget)).toBeVisible()
})

test('UAT 8: Swipe left on Not Done recurring task moves to next occurrence in Planned', async ({ page }) => {
  await (await ensureComposerOpen(page)).fill(taskText.recurringDaily)
  await setRecurringDaily(page)
  await page.getByRole('button', { name: /^Add Task$/i }).click()
  await expect(page.getByText(taskText.recurringDaily)).toBeVisible()

  await swipeTaskRow(page, getTaskRow(page, taskText.recurringDaily), 'left')

  await page.getByRole('button', { name: /^Planned \(\d+\)$/ }).click()
  await expect(page.getByText(taskText.recurringDaily)).toBeVisible()
})

test('UAT 9: Mark as Done in task menu moves non-recurring Not Done task to Done', async ({ page }) => {
  await addTask(page, taskText.markDoneViaMenu)
  await openTaskMenuFor(page, taskText.markDoneViaMenu)
  await page.locator('.task-menu').last().getByRole('button', { name: /Mark as Done/i }).click()

  await page.getByRole('button', { name: /^Done \(\d+\)$/ }).click()
  await expect(page.getByText(taskText.markDoneViaMenu)).toBeVisible()
})

test('UAT 10: Edit task in task menu focuses task description editor', async ({ page }) => {
  await addTask(page, taskText.editViaMenu)
  await openTaskMenuFor(page, taskText.editViaMenu)
  await page.locator('.task-menu').last().getByRole('button', { name: /Edit task/i }).click()

  const editInput = page.locator(`input[value="${taskText.editViaMenu}"]`).first()
  await expect(editInput).toBeFocused()
})

test('UAT Mobile 1: On mobile, mic button focuses task description input', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Only run where mobile emulation project is available')

  const viewport = page.viewportSize()
  test.skip(!(viewport && viewport.width <= 640), 'Mobile-only test')

  await ensureComposerOpen(page)
  await page.getByRole('button', { name: /Start speech to text/i }).click()
  await expect(page.getByRole('textbox', { name: /Task description/i })).toBeFocused()
})
