import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import path from "node:path"

const directory = path.resolve(process.argv[2] || "")
const port = Number(process.argv[3] || 0)

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${port}`)
  const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "")
  const file = path.resolve(directory, relative)

  response.setHeader("access-control-allow-origin", "*")

  if (!file.startsWith(`${directory}${path.sep}`) && file !== directory) {
    response.writeHead(403)
    response.end("Forbidden")
    return
  }

  try {
    const body = await readFile(file)
    response.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" })
    response.end(body)
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
    response.end("Not found")
  }
})

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`serving ${directory} at http://127.0.0.1:${port}\n`)
})
