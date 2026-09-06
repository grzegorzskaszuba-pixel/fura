import { spawn, spawnSync } from 'node:child_process'

const apiPort = Number(process.env.AUTH_API_PORT ?? 8787)
const webPort = Number(process.env.VITE_PORT ?? 5173)
const host = process.env.VITE_HOST ?? '0.0.0.0'
const RESTART_DELAY_MS = 1200
const MAX_RESTARTS_PER_MINUTE = 8
const COOLDOWN_MS = 30_000

let shuttingDown = false

function killProcessOnPort(port) {
  if (process.platform === 'win32') {
    const psCommand = [
      `$conn = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue`,
      'if ($conn) {',
      '  $owners = $conn | Select-Object -ExpandProperty OwningProcess -Unique',
      '  foreach ($procId in $owners) { Stop-Process -Id $procId -Force }',
      '}',
    ].join('; ')

    spawnSync('powershell', ['-NoProfile', '-Command', psCommand], { stdio: 'ignore' })
    return
  }

  const lsof = spawnSync('bash', ['-lc', `lsof -ti tcp:${port}`], { encoding: 'utf8' })

  if (lsof.status !== 0 || !lsof.stdout.trim()) {
    return
  }

  for (const pid of lsof.stdout.split(/\s+/).filter(Boolean)) {
    spawnSync('kill', ['-9', pid], { stdio: 'ignore' })
  }
}

function startProcess(command, args, label, env = process.env) {
  const child = spawn(command, args, {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  return child
}

function shutdown(managedProcesses) {
  shuttingDown = true

  for (const managed of managedProcesses) {
    if (!managed.child?.killed) {
      managed.child.kill('SIGTERM')
    }
  }
}

killProcessOnPort(apiPort)
killProcessOnPort(webPort)

const managedProcesses = [
  {
    label: 'api',
    command: 'node',
    args: ['server/auth-server.mjs'],
    env: process.env,
    child: null,
    restartTimestamps: [],
  },
  {
    label: 'web',
    command: 'node',
    args: ['node_modules/vite/bin/vite.js', '--host', host, '--port', String(webPort), '--strictPort', '--mode', 'remote'],
    env: {
      ...process.env,
      VITE_AUTH_MODE: process.env.VITE_AUTH_MODE ?? 'remote',
    },
    child: null,
    restartTimestamps: [],
  },
]

function pruneRestarts(timestamps, now) {
  return timestamps.filter((timestamp) => now - timestamp < 60_000)
}

function startManagedProcess(managed) {
  const child = startProcess(managed.command, managed.args, managed.label, managed.env)
  managed.child = child

  child.on('error', (error) => {
    if (shuttingDown) {
      return
    }

    console.error(`[${managed.label}] failed to start: ${error.message}. Retrying in ${RESTART_DELAY_MS}ms...`)
    setTimeout(() => {
      if (!shuttingDown) {
        startManagedProcess(managed)
      }
    }, RESTART_DELAY_MS)
  })

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return
    }

    const now = Date.now()
    managed.restartTimestamps = pruneRestarts(managed.restartTimestamps, now)

    if (managed.restartTimestamps.length >= MAX_RESTARTS_PER_MINUTE) {
      console.error(
        `[${managed.label}] crashed too often (${MAX_RESTARTS_PER_MINUTE}/min). Entering ${COOLDOWN_MS}ms cooldown before next restart.`,
      )

      managed.restartTimestamps = []

      setTimeout(() => {
        if (!shuttingDown) {
          startManagedProcess(managed)
        }
      }, COOLDOWN_MS)

      return
    }

    managed.restartTimestamps.push(now)
    console.error(`[${managed.label}] exited (code=${code ?? 'null'}, signal=${signal ?? 'none'}). Restarting in ${RESTART_DELAY_MS}ms...`)

    setTimeout(() => {
      if (!shuttingDown) {
        startManagedProcess(managed)
      }
    }, RESTART_DELAY_MS)
  })
}

for (const managed of managedProcesses) {
  startManagedProcess(managed)
}

console.log(`\nDev stack ready:`)
console.log(`- API: http://localhost:${apiPort}`)
console.log(`- Web: http://localhost:${webPort}`)

process.on('SIGINT', () => {
  shutdown(managedProcesses)
  process.exit(0)
})

process.on('SIGTERM', () => {
  shutdown(managedProcesses)
  process.exit(0)
})
