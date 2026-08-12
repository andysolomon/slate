# Slate

A local-first drawing/diagramming whiteboard: shape tools, binding arrows, freedraw with
shape recognition, sticky notes, frames, images, web embeds, an offline Mermaid flowchart
importer, Excalidraw file/library interop, multi-scene management with a gallery, dark
mode, and optional account sync to Amazon S3.

The canonical behavioural reference is `reference/Whiteboard.dc.html` — a fully working
HTML prototype. This app is a faithful port of it to React 18 + TypeScript + Vite.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

Signed out, the app is 100 % local: every scene lives in this browser's IndexedDB
(`slate-whiteboard` database), and no network calls are made (fonts aside). The only
localStorage keys used are `slate.theme` and `slate.auth`.

## Cloud sync (optional)

The signed-in gallery stores each scene as JSON in one S3 bucket under a per-user prefix:

```
users/{cognito-identity-id}/scenes/{sceneId}.json
users/{cognito-identity-id}/meta.json          ← gallery index
```

Sign-in is "Continue with Google" (Google Identity Services). The Google ID token is
exchanged for scoped AWS credentials through a **Cognito Identity Pool** — no server of
your own is involved.

### Setup

1. **Google OAuth client** — In [Google Cloud console](https://console.cloud.google.com/apis/credentials)
   create an *OAuth client ID* of type *Web application*. Add your origins
   (e.g. `http://localhost:5173` and your production origin) to *Authorized JavaScript
   origins*. Copy the client ID.

2. **S3 bucket** — Create a private bucket (block all public access). Add a CORS policy
   so the browser can call it:

   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "DELETE"],
       "AllowedOrigins": ["http://localhost:5173", "https://your-app.example"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

3. **Cognito Identity Pool** — Create an identity pool (classic flow), **no unauthenticated
   access**, with *Google* as an identity provider using the OAuth client ID from step 1.
   Give the **authenticated role** this policy, which scopes every user to their own
   prefix (`${cognito-identity.amazonaws.com:sub}` is the user's identity id):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::YOUR_BUCKET/users/${cognito-identity.amazonaws.com:sub}/*"
       }
     ]
   }
   ```

4. **Environment** — copy `.env.example` to `.env` and fill in:

   ```
   VITE_GOOGLE_CLIENT_ID=…apps.googleusercontent.com
   VITE_AWS_REGION=us-east-1
   VITE_COGNITO_IDENTITY_POOL_ID=us-east-1:…
   VITE_S3_BUCKET=your-bucket
   ```

Leave the variables unset and the Sign in flow reports that sync is not configured while
everything else keeps working locally.

### Sync semantics

- On first sign-in, the local scenes upload to the account gallery, and scenes already in
  the account download into the local cache.
- **Sync as I draw** (default on): every autosave also uploads. Off: a scene uploads when
  you close or switch away from it.
- **Keep an offline copy** (default on): scenes are cached in IndexedDB so they open
  without a connection. Off: nothing new is written to IndexedDB and existing cached
  scenes are cleared (the session keeps in-memory copies).
- Signing out clears the cached copies from this browser and returns it to local-only
  storage; the account gallery is untouched.
- Sessions ride on Google ID tokens (~1 hour). The app renews them silently via Google
  One Tap where the browser allows it; if renewal fails, drawing continues locally and
  the next upload retries.

## Configuration

`src/config.ts` exposes the four behaviour switches and the accent colour:

| Key           | Default    | Meaning                                            |
| ------------- | ---------- | -------------------------------------------------- |
| `grid`        | `'dots'`   | `'dots' \| 'lines' \| 'none'` canvas grid          |
| `snapToGrid`  | `false`    | snap geometry to a 10 px grid                      |
| `bindArrows`  | `true`     | arrows attach to shapes and follow them            |
| `stickyTools` | `false`    | keep the drawing tool active after each shape      |
| `accentColor` | `'#9747FF'`| single constant every accent-coloured UI state and the selection overlay derive from |

## Scene format

Export/import uses `{ "type": "slate-scene", "version": 1, "name", "elements" }` — fully
interchangeable with the prototype. Excalidraw scenes (`.json`) and libraries
(`.excalidrawlib`) are converted on import.
