# Security

## Report a Vulnerability

To report a security issue, please email **camilomova@unisabana.edu.co** with details of the vulnerability. Do not open a public GitHub issue.

## Security Measures

### Authentication
- JWT-based authentication with RS256-like signing via `jsonwebtoken`
- Tokens expire after 7 days (configurable via `JWT_EXPIRES_IN`)
- Token must be included as `Authorization: Bearer <token>` header
- No fallback to unsigned token parsing — all tokens **must** be verified

### Authorization
- Role-based access control: `is_admin` flag gates admin endpoints
- `adminAuth` middleware double-checks admin status on every protected route
- Admin actions are audit-logged to `backend/audit-logs/`

### Input Validation
- All user input validated via **Zod schemas** before processing
- XSS sanitization via `xss` package — strips HTML tags from all request bodies
- Request body limited to **1 MB** (prevents DoS via large payloads)

### Rate Limiting
| Scope | Limit | Window |
|---|---|---|
| Global API | 200 requests | 15 minutes |
| Auth endpoints | 10 requests | 15 minutes |
| Per authenticated user | 60 requests | 1 minute |

### Security Headers
| Header | Value |
|---|---|
| `Content-Security-Policy` | Restricted to `self`, Google APIs, Cloudinary |
| `Strict-Transport-Security` | 2 years, include subdomains (production only) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Camera, microphone, geolocation, payment, USB — all denied |

### Database
- All queries use **Prisma ORM** — parameterized queries prevent SQL injection
- Connection string uses password authentication
- Local PostgreSQL port bound to `127.0.0.1` only

### File Upload
- Image uploads go through **Cloudinary** (external service) when configured
- Local fallback stores uploads under `backend/uploads/` (gitignored)
- File size limited by Express body parser (1 MB)

### CORS
- Strict origin whitelist configured via `CORS_ORIGINS` env var
- Only `GET`, `POST`, `PATCH`, `PUT`, `DELETE`, `OPTIONS` methods allowed
- Only `Content-Type`, `Authorization` headers allowed

### Secrets Management
- All secrets injected via environment variables — never in code
- `.env.example` documents all required variables without real values
- Production secrets: `JWT_SECRET`, `DATABASE_URL`, `SENDGRID_API_KEY`, `CLOUDINARY_*`
- **Never commit `.env` files** — they are gitignored

## Running in Production

```bash
# 1. Generate a strong JWT secret
openssl rand -hex 64

# 2. Set restrictive CORS
CORS_ORIGINS=https://tudominio.com

# 3. Enable HSTS (already on for NODE_ENV=production)
NODE_ENV=production

# 4. Use HTTPS behind a reverse proxy (nginx/Caddy)
# See docker-compose.prod.yml and nginx.conf

# 5. Keep dependencies updated
npm audit        # check for vulnerabilities
npm update       # update safe patches
```

## Dependency Auditing

```bash
# Check for vulnerabilities
npm audit

# Fix automatically
npm audit fix

# CI will fail on critical vulnerabilities
# See .github/workflows/ci.yml → audit step
```
