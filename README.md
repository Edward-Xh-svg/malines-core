# Malines Community Platform â€” Full Project Context

## Project Overview
**Malines** is an Arabic-language community platform hosted at `malines.ivanova.sbs` on Vercel. It's a roleplay/geopolitical simulation community with a forum, archive, stock exchange, council of nations, and direct/group messaging.

**Tech Stack:**
- Backend: Node.js + Express.js (`server.js`)
- Database: Turso (SQLite cloud) via `@libsql/client`
- Auth: JWT (`jsonwebtoken`) â€” stateless, works with Vercel serverless
- Image upload: imgbb API
- Deployment: Vercel (serverless functions)
- Frontend: Vanilla JS + Vue 3 (wiki only) â€” NO React/Next.js
- Arabic fonts: Cairo + Noto Naskh Arabic

---

## Environment Variables (Vercel)
```
TURSO_DATABASE_URL=libsql://malines-edward-xh-svg.aws-ap-northeast-1.turso.io
TURSO_AUTH_TOKEN=<turso_token>
IMGBB_API_KEY=<imgbb_key>
JWT_SECRET=<random_secret_string>
```

---

## File Structure
```
/
â”œâ”€â”€ server.js          # Main Express server + all API routes
â”œâ”€â”€ database.js        # Turso DB client + all queries + initDB()
â”œâ”€â”€ package.json       # dependencies
â”œâ”€â”€ vercel.json        # Vercel config
â””â”€â”€ public/
    â”œâ”€â”€ index.html     # Landing page
    â”œâ”€â”€ wiki.html      # Article archive (Vue 3) â†’ /wiki
    â”œâ”€â”€ stock.html     # Stock exchange â†’ /stock
    â”œâ”€â”€ council.html   # Council of nations â†’ /council
    â”œâ”€â”€ hostaka.html   # Hostaka platform â†’ /hostaka
    â”œâ”€â”€ records.html   # Forum/posts â†’ /records
    â”œâ”€â”€ chat.html      # DM + group chat list â†’ /chat
    â”œâ”€â”€ group.html     # Group chat room â†’ /group?g=ID
    â”œâ”€â”€ profile.html   # User profile â†’ /profile OR /profile?u=username
    â”œâ”€â”€ admin.html     # Admin panel â†’ /admin
    â””â”€â”€ style.css
```

---

## Database Schema (Turso/SQLite)

### users
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
username TEXT NOT NULL UNIQUE,
email TEXT NOT NULL UNIQUE,
password TEXT NOT NULL,          -- bcrypt hashed
role TEXT DEFAULT 'user',        -- 'user' | 'admin'
avatar TEXT DEFAULT '',          -- imgbb URL
bio TEXT DEFAULT '',
game_id TEXT DEFAULT '',
display_name TEXT DEFAULT '',
cover TEXT DEFAULT '',           -- profile cover photo URL
verified INTEGER DEFAULT 0,      -- 0 | 1
created_at TEXT DEFAULT (datetime('now'))
```

### sessions â€” NOT USED (JWT is stateless)

### articles
```sql
id, slug TEXT UNIQUE, title, category DEFAULT 'ط¹ط§ظ…',
content TEXT,   -- HTML content
image TEXT DEFAULT '',
published INTEGER DEFAULT 1,
author_id REFERENCES users(id),
created_at, updated_at
```

### countries
```sql
id, name TEXT UNIQUE, flag TEXT, description TEXT,
type TEXT DEFAULT 'both',   -- 'both' | 'council' | 'stock'
council_data TEXT,           -- Markdown content for council records
created_at, updated_at
```

### stock_companies
```sql
id, country_id REFERENCES countries(id) ON DELETE CASCADE,
name TEXT, market_value TEXT, growth TEXT, sort_order INTEGER, updated_at
```

### records (forum posts)
```sql
id, user_id REFERENCES users(id),
publisher TEXT,      -- display name at time of posting
user_role TEXT DEFAULT 'Member',   -- 'Member' | 'Admin'
user_avatar TEXT DEFAULT '',
content TEXT,        -- HTML rich text (contenteditable)
image TEXT DEFAULT '',   -- imgbb URL (JPG/JPEG only)
created_at
```

### record_reactions
```sql
id, record_id REFERENCES records(id) ON DELETE CASCADE,
user_id REFERENCES users(id) ON DELETE CASCADE,
emoji TEXT DEFAULT 'like',   -- 'like'|'heart'|'haha'|'sad'|'angry'
UNIQUE(record_id, user_id)
```

### record_comments
```sql
id, record_id REFERENCES records(id) ON DELETE CASCADE,
user_id, username TEXT, display_name TEXT, avatar TEXT,
user_role TEXT DEFAULT 'Member', content TEXT, created_at
```

### messages (DMs)
```sql
id, from_id REFERENCES users(id) ON DELETE CASCADE,
to_id REFERENCES users(id) ON DELETE CASCADE,
from_name TEXT, to_name TEXT, content TEXT,
image TEXT DEFAULT '',   -- imgbb URL
read INTEGER DEFAULT 0, created_at
```

### message_reactions
```sql
id, message_id REFERENCES messages(id) ON DELETE CASCADE,
user_id REFERENCES users(id) ON DELETE CASCADE,
emoji TEXT DEFAULT 'heart',
UNIQUE(message_id, user_id)
```

### groups
```sql
id, name TEXT, description TEXT, avatar TEXT,
theme TEXT DEFAULT 'default',
created_by REFERENCES users(id), created_at
```

### group_members
```sql
id, group_id REFERENCES groups(id) ON DELETE CASCADE,
user_id REFERENCES users(id) ON DELETE CASCADE,
nickname TEXT DEFAULT '',
role TEXT DEFAULT 'member',   -- 'admin' | 'moderator' | 'member'
joined_at,
UNIQUE(group_id, user_id)
```

### group_messages
```sql
id, group_id REFERENCES groups(id) ON DELETE CASCADE,
user_id REFERENCES users(id) ON DELETE CASCADE,
from_name TEXT, from_avatar TEXT, content TEXT,
image TEXT DEFAULT '', created_at
```

### group_message_reactions
```sql
id, message_id REFERENCES group_messages(id) ON DELETE CASCADE,
user_id REFERENCES users(id) ON DELETE CASCADE,
emoji TEXT DEFAULT 'heart',
UNIQUE(message_id, user_id)
```

### verify_requests
```sql
id, user_id REFERENCES users(id) ON DELETE CASCADE,
username TEXT, status TEXT DEFAULT 'pending',   -- 'pending'|'approved'|'rejected'
created_at, UNIQUE(user_id)
```

---

## Auth System

**JWT â€” stateless, no DB sessions.**

```javascript
// Login response
{ success: true, token: "<JWT>", username, role, avatar, id }

// Frontend stores in localStorage:
localStorage.setItem('malines_token', token)
localStorage.setItem('malines_user', JSON.stringify({username, role, avatar, id}))

// Every API request sends:
Authorization: Bearer <JWT>

// JWT payload contains:
{ id, username, role, avatar }
// Verified with JWT_SECRET env var, expires in 30d

// Fast check (no DB): GET /api/auth/me â†’ returns JWT payload
// Full check (with DB): GET /api/me â†’ returns full user row
```

---

## All API Routes

### Auth
```
POST /api/login          { email, password } â†’ { token, username, role, avatar, id }
POST /api/register       { username, email, password } â†’ { token, ... }
GET  /api/auth/me        (Bearer) â†’ JWT payload (fast, no DB)
GET  /api/me             (Bearer) â†’ full user from DB
POST /api/logout         (Bearer) â†’ { success }
```

### Profile & Users
```
GET  /api/profile/:username           â†’ public profile
PUT  /api/profile                     (Bearer) { display_name, bio, game_id, avatar, cover }
GET  /api/users                       â†’ all users list (public)
GET  /api/users/search?q=             (Bearer) â†’ search users
GET  /api/user/:username/posts        â†’ user's posts
```

### Upload
```
POST /api/upload   (Bearer) { image: "base64dataURL" } â†’ { url: "imgbb_url" }
     Accepts JPEG only for posts/covers, any image for avatars
```

### Articles (Archive)
```
GET  /api/articles                    â†’ published articles list
GET  /api/articles/:slug              â†’ single article
GET  /api/admin/articles              (Admin) â†’ all articles
POST /api/admin/articles              (Admin) { slug, title, category, content, image, published }
PUT  /api/admin/articles/:slug        (Admin) { title, category, content, image, published }
DEL  /api/admin/articles/:slug        (Admin)
```

### Countries & Stock
```
GET  /api/nbn/list                    â†’ council country names[]
GET  /api/nbn/data/:name              â†’ { council_data, description }
GET  /api/inc/list                    â†’ stock country names[]
GET  /api/inc/data/:name              â†’ { companies[], values[], growth[] }
GET  /api/admin/countries             (Admin) â†’ all countries + companies
POST /api/admin/countries             (Admin) { name, flag, description, type, council_data }
PUT  /api/admin/countries/:id         (Admin)
DEL  /api/admin/countries/:id         (Admin)
POST /api/admin/companies             (Admin) { country_id, name, market_value, growth, sort_order }
PUT  /api/admin/companies/:id         (Admin)
DEL  /api/admin/companies/:id         (Admin)
```

### Forum Posts (Records)
```
GET  /api/records                     â†’ all posts + reactions + comments (enriched)
POST /api/records                     (Bearer) { content: HTML, image: "" }
DEL  /api/records/:id                 (Bearer, own or admin)
POST /api/records/:id/react           (Bearer) { emoji } â†’ toggles reaction
GET  /api/records/:id/comments        â†’ comments list
POST /api/records/:id/comments        (Bearer) { content }
DEL  /api/comments/:id                (Bearer, own or admin)
```

Post URL format: `/records?p=POST_ID` â€” post highlights when opened via link.

### Verification
```
POST /api/verify/request              (Bearer) â†’ sends verify request
GET  /api/verify/status               (Bearer) â†’ { verified, status }
GET  /api/admin/verify                (Admin) â†’ pending requests[]
PUT  /api/admin/verify/:userId        (Admin) { action: 'approve'|'reject' }
```

### Direct Messages
```
GET  /api/messages/conversations      (Bearer) â†’ conversation list
GET  /api/messages/unread             (Bearer) â†’ { count }
GET  /api/messages/:username          (Bearer) â†’ messages with user
POST /api/messages/:username          (Bearer) { content, image }
POST /api/messages/react/:id          (Bearer) { emoji } â†’ toggles reaction
```

### Groups
```
GET  /api/groups                      (Bearer) â†’ user's groups
POST /api/groups                      (Bearer) { name, description, avatar, theme, members: [uid] }
GET  /api/groups/:id                  (Bearer, member only) â†’ group + members
PUT  /api/groups/:id                  (Bearer, admin/mod) { name, description, avatar, theme }
DEL  /api/groups/:id                  (Bearer, admin only)
POST /api/groups/:id/members          (Bearer, admin/mod) { user_id, role }
DEL  /api/groups/:id/members/:uid     (Bearer, admin/mod or self)
PUT  /api/groups/:id/members/:uid/role     (Bearer, admin) { role }
PUT  /api/groups/:id/members/:uid/nickname (Bearer) { nickname }
GET  /api/groups/:id/messages         (Bearer, member) â†’ messages[]
POST /api/groups/:id/messages         (Bearer, member) { content, image }
POST /api/groups/:gid/messages/:mid/react (Bearer) { emoji }
```

### Admin
```
GET  /api/admin/users                 (Admin) â†’ all users
PUT  /api/admin/users/:id/role        (Admin) { role: 'user'|'admin' }
DEL  /api/admin/users/:id             (Admin)
```

---

## Admin Credentials
```
Email:    misha@malines.nc
Password: 60dbedfd4f3247bfa11fc32bb2acd9
```
These are set/reset automatically on every server start in `initDB()`.

---

## Key Frontend Patterns

### Token handling (ALL pages)
```javascript
const getToken = () => localStorage.getItem('malines_token') || '';

// Auth check on page load (fast):
const r = await fetch('/api/auth/me', { headers: {'Authorization': 'Bearer ' + getToken()} });
const user = await r.json();
if (!user || user.error) { /* show not logged in */ }

// API calls:
async function apiFetch(url, method='GET', body=null) {
  const token = localStorage.getItem('malines_token') || '';
  const opts = { method, headers: {'Content-Type':'application/json','Authorization':'Bearer '+token} };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
}
```

### Image upload pattern
```javascript
// Convert file to base64, send to /api/upload
const reader = new FileReader();
reader.onload = ev => { base64 = ev.target.result; };
reader.readAsDataURL(file);

// Upload:
const up = await apiFetch('/api/upload', 'POST', { image: base64 });
const imageUrl = up.url;
```

### Profile link pattern
```
/profile          â†’ my own profile
/profile?u=misha  â†’ public profile of user "misha"
```

### Post share link
```
/records?p=123    â†’ opens records page and highlights post #123
```

### Group chat link
```
/group?g=5        â†’ opens group chat #5
```

### Chat with user link
```
/chat?with=misha  â†’ opens DM with misha
```

---

## Verified Badge
- Blue shield SVG shown next to username in posts/profile
- Stored as `users.verified = 1`
- Users request via POST `/api/verify/request`
- Admin approves/rejects in admin panel â†’ "ط§ظ„طھظˆط«ظٹظ‚" section
- Shows badge count in admin nav

---

## Design System
- **Dark theme only** â€” background: `#050505`
- **Primary color**: `#c0392b` (red)
- **Accent**: `#d4af37` (gold)
- **Border**: `#232325`
- **Muted text**: `#8d8d8d`
- **Font**: Cairo (UI) + Noto Naskh Arabic (content/posts)
- **RTL** â€” all pages `dir="rtl"` `lang="ar"`
- **NO emojis** â€” use SVG icons only
- **Mobile-first** â€” sidebar collapses on mobile

---

## Known Issues / TODO
1. Stock page (`stock.html`) and Council page (`council.html`) â€” data loads from DB correctly via `/api/inc/*` and `/api/nbn/*` but pages may have rendering issues with old fallback code
2. Group chat themes (8 color themes defined in `group.html`) â€” stored in DB but CSS variable injection not fully implemented
3. Nickname feature in groups â€” stored in DB but not shown in UI yet
4. Message read receipts â€” `messages.read` column exists but no UI indicator

---

## Important Notes for AI Assistants

1. **Vercel serverless** â€” No persistent memory between requests. JWT is stateless by design. Never use in-memory Maps/Sets for sessions.

2. **Turso migrations** â€” When adding new columns, always add `ALTER TABLE` in the migrations array in `initDB()`. Existing tables won't get new columns from `CREATE TABLE IF NOT EXISTS`.

3. **N+1 queries** â€” `/api/records` uses bulk queries (`getAllReactions()`, `getAllComments()`) to avoid per-post DB calls. Follow this pattern.

4. **Image format** â€” Posts and covers accept JPG/JPEG only (lighter). Avatars accept any image format. Always validate `file.type.match('image/jpeg')` on frontend.

5. **Arabic content** â€” All user-facing text is Arabic. Admin panel uses Arabic labels. Keep RTL layout.

6. **`publisher_verified` vs `user_verified`** â€” In records query, the JOIN returns `COALESCE(u.verified, 0) as publisher_verified`. Use `p.publisher_verified` in frontend to show verified badge on posts.

7. **Global connection cache** â€” `database.js` uses `global._tursoClient` to reuse the Turso connection across Vercel function invocations.