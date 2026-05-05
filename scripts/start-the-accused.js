/**
 * Sakura Shield — Start The Accused dev server on port 3001
 * Used by Playwright webServer config.
 */
'use strict'

const { spawn } = require('child_process')
const path      = require('path')

const dir = path.resolve('C:\\Users\\L\\Desktop\\The Accused - Skolvex\\the-accused')

console.log('[shield] Starting The Accused on http://localhost:3001')
console.log('[shield] CWD:', dir)

const proc = spawn('npm', ['run', 'dev', '--', '--port', '3001'], {
  cwd:   dir,
  stdio: 'inherit',
  shell: true,
})

proc.on('error', err => {
  console.error('[shield] Failed to start The Accused:', err.message)
  process.exit(1)
})

proc.on('exit', code => {
  if (code !== 0 && code !== null) process.exit(code)
})
