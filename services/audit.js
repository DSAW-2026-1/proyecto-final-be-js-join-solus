// Auditoria de seguridad — registra operaciones sensibles en el logger y opcionalmente en archivo JSON
import { appendFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOG_DIR = join(__dirname, '..', 'audit-logs')

let _logger = null

export function setLogger(logger) {
  _logger = logger
}

async function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    await mkdir(LOG_DIR, { recursive: true })
  }
}

export const LOG_ACTIONS = {
  LOGIN: 'LOGIN',
  ADMIN_STATS: 'ADMIN_STATS',
  ADMIN_UPDATE_USER: 'ADMIN_UPDATE_USER',
  ADMIN_MODERATE_PRODUCT: 'ADMIN_MODERATE_PRODUCT',
  PRODUCT_CREATE: 'PRODUCT_CREATE',
  PRODUCT_UPDATE: 'PRODUCT_UPDATE',
  PRODUCT_DELETE: 'PRODUCT_DELETE',
  ORDER_CHECKOUT: 'ORDER_CHECKOUT',
  ORDER_UPDATE_STATUS: 'ORDER_UPDATE_STATUS',
  USER_ONBOARDING: 'USER_ONBOARDING',
  USER_SELLER_ACTIVATE: 'USER_SELLER_ACTIVATE',
  REPORT_CREATE: 'REPORT_CREATE',
}

export async function auditLog({ action, userId, userEmail, details, ip, metadata }) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    userId: userId || 'anonymous',
    userEmail: userEmail || 'unknown',
    details: details || {},
    ip: ip || 'unknown',
  }

  // Structured log via pino
  if (_logger) {
    _logger.info({ audit: entry }, `AUDIT ${action}`)
  } else {
    process.stdout.write(JSON.stringify({ level: 'info', msg: `AUDIT ${action}`, audit: entry }) + '\n')
  }

  // File logging (best-effort, does not block)
  try {
    await ensureLogDir()
    const date = new Date().toISOString().split('T')[0]
    const filePath = join(LOG_DIR, `audit-${date}.jsonl`)
    await appendFile(filePath, JSON.stringify(entry) + '\n')
  } catch (err) {
    if (_logger) {
      _logger.warn({ err: err.message }, 'Audit file log failed')
    }
  }
}

export function auditMiddleware(action) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res)
    res.json = function (body) {
      auditLog({
        action,
        userId: req.userId,
        userEmail: req.userEmail,
        details: { method: req.method, path: req.path, statusCode: res.statusCode },
        ip: req.ip || req.connection?.remoteAddress,
      }).catch(() => {})
      return originalJson(body)
    }
    next()
  }
}
