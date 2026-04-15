# TSRPC Server

## Usage
### Local dev server

Dev server would restart automatically when code changed.

```
npm run dev
```

Runtime settings are loaded from local `config.json`. If it is absent, the server falls back to `config.example.json`.

The admin web panel is enabled by default and listens on the `admin.port` from config.

For better throughput, the server now defaults to lightweight logging:
`server.logging.logReqBody=false`, `logResBody=false`, `logMsg=false`, `logConnect=false`.
You can override these fields in `config.json` when you need more diagnostics.

### Build
```
npm run build
```

### Local load test
Default command starts an in-memory local server and runs a mixed benchmark:

```shell
npm run loadtest
```

Examples:

```shell
npm run loadtest -- --scenario profile --clients 64 --duration 20 --warmup 5
npm run loadtest -- --scenario storage-get --clients 128 --duration 20 --warmup 5
npm run loadtest -- --scenario storage-save --clients 128 --duration 20 --warmup 5
npm run loadtest -- --scenario room-sync --clients 40 --room-size 4
npm run loadtest -- --no-start-server --host 127.0.0.1 --port 23414 --scenario storage-save
```

Supported scenarios: `profile`, `storage-save`, `storage-get`, `room-sync`, `mixed`

### Generate API document

Generate API document in swagger/openapi and markdown format.

```shell
npm run doc
```

### Run unit Test
Execute `npm run dev` first, then execute:
```
npm run test
```

---
