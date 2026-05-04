import initSqlJs, { Database } from 'sql.js';
// sql-wasm.wasm is served from /node_modules/sql.js/dist/ via Vite's public copy
// We fall back to CDN only if the local path fails (e.g. non-Vite environments)
const WASM_PATHS = [
  '/node_modules/sql.js/dist/sql-wasm.wasm',          // Vite dev server
  '/assets/sql-wasm.wasm',                             // Vite production (after copy)
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm', // CDN fallback
];

const IDB_DB_NAME  = 'nexus-localdb';
const IDB_STORE    = 'sqlite';
const IDB_KEY      = 'db';

// ── Persist / restore the SQLite binary via IndexedDB (no 5 MB localStorage limit) ──
async function idbSave(data: Uint8Array): Promise<void> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(data, IDB_KEY);
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    };
    req.onerror = () => rej(req.error);
  });
}

async function idbLoad(): Promise<Uint8Array | null> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => {
      const tx  = req.result.transaction(IDB_STORE, 'readonly');
      const get = tx.objectStore(IDB_STORE).get(IDB_KEY);
      get.onsuccess = () => res(get.result ?? null);
      get.onerror   = () => rej(get.error);
    };
    req.onerror = () => rej(req.error);
  });
}

export class LocalDB {
  private static instance: LocalDB;
  private db: Database | null = null;
  private initializing: Promise<void> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {}

  public static getInstance(): LocalDB {
    if (!LocalDB.instance) LocalDB.instance = new LocalDB();
    return LocalDB.instance;
  }

  public async init() {
    if (this.db) return;
    if (this.initializing) return this.initializing;

    this.initializing = (async () => {
      let wasmBinary: ArrayBuffer | null = null;

      for (const url of WASM_PATHS) {
        try {
          const r = await fetch(url);
          if (r.ok) { wasmBinary = await r.arrayBuffer(); break; }
        } catch { /* try next */ }
      }

      if (!wasmBinary) throw new Error('Could not load sql-wasm.wasm from any source.');

      const SQL = await initSqlJs({ wasmBinary });

      // Prefer IDB; fall back to legacy localStorage data on first migration
      let saved: Uint8Array | null = await idbLoad();
      if (!saved) {
        const legacy = localStorage.getItem('nexus_sqlite_db');
        if (legacy) {
          saved = new Uint8Array(JSON.parse(legacy));
          localStorage.removeItem('nexus_sqlite_db'); // migrate once
        }
      }

      this.db = saved ? new SQL.Database(saved) : new SQL.Database();
      this.createTables();
    })();

    return this.initializing;
  }

  private createTables() {
    if (!this.db) return;
    this.db.run(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, phone TEXT, case_number TEXT, court TEXT,
        next_date TEXT, purpose TEXT,
        opp_advocate_name TEXT, opp_advocate_phone TEXT,
        documents TEXT, is_archived INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS consultations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER, transcript TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT, content TEXT, engine TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, content TEXT, case_facts TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_archived INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS scanned_docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, content TEXT, image_base64 TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_archived INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS knowledge_docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, type TEXT, data TEXT, size TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_archived INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS instructions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT, active INTEGER DEFAULT 1,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Safe column migrations
    const migrations = [
      "ALTER TABLE clients ADD COLUMN opp_advocate_name TEXT",
      "ALTER TABLE clients ADD COLUMN opp_advocate_phone TEXT",
      "ALTER TABLE clients ADD COLUMN documents TEXT",
      "ALTER TABLE clients ADD COLUMN is_archived INTEGER DEFAULT 0",
      "ALTER TABLE drafts ADD COLUMN is_archived INTEGER DEFAULT 0",
      "ALTER TABLE scanned_docs ADD COLUMN is_archived INTEGER DEFAULT 0",
      "ALTER TABLE knowledge_docs ADD COLUMN is_archived INTEGER DEFAULT 0",
    ];
    for (const m of migrations) { try { this.db.run(m); } catch { /* already exists */ } }

    this.save();
  }

  // Debounced save — avoids thrashing IDB on every keystroke
  public save() {
    if (!this.db) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      if (!this.db) return;
      try {
        await idbSave(this.db.export());
      } catch (e) {
        console.error('Nexus: DB save failed', e);
      }
    }, 300);
  }

  public run(sql: string, params?: any[]) {
    if (!this.db) return null;
    try {
      this.db.run(sql, params);
      this.save();
      const res = this.db.exec('SELECT last_insert_rowid()');
      return res[0].values[0][0] as number;
    } catch (e) {
      console.error('Nexus: SQL Run Error:', e, sql);
      return null;
    }
  }

  public query(sql: string, params?: any[]) {
    if (!this.db) return [];
    try {
      const res = this.db.exec(sql, params);
      if (res.length === 0) return [];
      const columns = res[0].columns;
      return res[0].values.map(row => {
        const obj: any = {};
        columns.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
      });
    } catch (e) {
      console.error('Nexus: SQL Query Error:', e, sql);
      return [];
    }
  }

  public getConfig(key: string): string | null {
    const res = this.query('SELECT value FROM config WHERE key = ?', [key]);
    return res.length > 0 ? res[0].value : null;
  }

  public setConfig(key: string, value: string) {
    this.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value]);
  }
}
