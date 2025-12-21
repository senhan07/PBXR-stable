# PBXR - Prometheus Blackbox Manager

A comprehensive management suite for Prometheus Blackbox Exporter targets, probers, and metrics with persistent SQLite storage.

## Features
- **Centralized Management**: Manage targets, probers, and groups in one place.
- **Persistent Storage**: All configuration is saved to a local SQLite database (`.db` file).
- **Dockerized**: Easy deployment with persistent volumes.
- **Visual Dashboard**: Statistics and event logging.

## Prerequisites
- **Node.js** (v18+) for local development.
- **Docker** for containerized deployment.

---

## 🚀 Running on Docker (Recommended)

To run PBXR with persistent data storage, use a Docker volume mount mapping to `/app/data`.

### 1. Build the Image
```bash
docker build -t pbxr .
```

### 2. Run the Container
Run the container, mounting a local folder to persist the database file.

**Linux / Mac:**
```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/usr/src/app/data \
  --name pbxr \
  pbxr
```

**Windows (PowerShell):**
```powershell
docker run -d `
  -p 3000:3000 `
  -v ${PWD}/data:/usr/src/app/data `
  --name pbxr `
  pbxr
```

The application will be available at [http://localhost:3000](http://localhost:3000).
All data will be stored in your local `./data/pbxr.db` file.

---

## 💻 Running Locally (Windows/Linux)

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Frontend
```bash
npm run build
```

### 3. Start Server
```bash
npm start
```

The server will start on port 3000. Data will be stored in `data/pbxr.db` within the project folder.

### Development Mode
To run the frontend with hot-reload and proxy to backend:
1. Start backend: `node server.js`
2. In another terminal, start frontend: `npm run dev`

---

## 📁 Data Persistence
The application uses **SQLite** for storage.
- **Location**: `data/pbxr.db` inside the container (mapped to host).
- **Format**: JSON blob stored in `kv_store` table.
- **Backup**: Simply copy the `.db` file to back up your entire configuration.
