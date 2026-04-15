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
