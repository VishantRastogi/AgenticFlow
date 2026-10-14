import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(path.resolve(root, "../../apps/web/package.json"))

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" })
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`))
    })
  })
}

function serve(directory, port) {
  const child = spawn(process.execPath, ["scripts/static.mjs", directory, String(port)], {
    cwd: root,
    stdio: ["ignore", "pipe", "inherit"],
  })
  return new Promise((resolve, reject) => {
    let settled = false
    child.stdout.on("data", (chunk) => {
      if (!settled && String(chunk).includes(`:${port}`)) {
        settled = true
        resolve(child)
      }
    })
    child.on("exit", (code) => {
      if (!settled) reject(new Error(`static server on ${port} exited ${code}`))
    })
  })
}

function stop(child) {
  child.kill()
}

const remotePort = 3101
const hostPort = 3100

await run(process.execPath, [path.join(root, "node_modules/webpack/bin/webpack.js"), "--config", "remote/webpack.config.cjs", "--mode", "production"])
await run(process.execPath, [path.join(root, "node_modules/webpack/bin/webpack.js"), "--config", "host/webpack.config.cjs", "--mode", "production"])

const { readdir } = await import("node:fs/promises")
const hostFiles = (await readdir(path.join(root, "host/dist"))).filter((file) => file.endsWith(".js"))
if (hostFiles.length === 0) throw new Error("Host bundle was not emitted.")
const hostBundle = (
  await Promise.all(hostFiles.map((file) => readFile(path.join(root, "host/dist", file), "utf8")))
).join("\n")

if (hostBundle.includes("Orbit health")) {
  throw new Error("The host bundle contains the remote feature text. The remote is not independently deployed.")
}

if (!hostBundle.includes("Loading the remote feature")) {
  throw new Error("The host bundle is missing the remote loading fallback.")
}

const remote = await serve("remote/dist", remotePort)
const host = await serve("host/dist", hostPort)

try {
  const { chromium } = require("playwright")
  const browser = await chromium.launch()
  const page = await browser.newPage()

  const loading = page.getByRole("status").waitFor()
  await page.goto(`http://127.0.0.1:${hostPort}`, { waitUntil: "commit" })
  await loading
  await page.getByRole("heading", { name: "Orbit health" }).waitFor()
  const remoteVersion = await page.locator("[data-react-version]").innerText()
  const hostVersion = await page.locator("[data-host-react]").innerText()
  if (remoteVersion !== hostVersion) {
    throw new Error(`React was not shared. Host ${hostVersion}, remote ${remoteVersion}.`)
  }
  await page.getByRole("button", { name: "Mark unchecked" }).click()
  await page.getByText("Runtime status: unchecked").waitFor()

  const remotePage = await browser.newPage()
  await remotePage.goto(`http://127.0.0.1:${remotePort}`)
  await remotePage.getByRole("heading", { name: "Orbit health" }).waitFor()
  await remotePage.close()

  const failed = await browser.newPage()
  await failed.route("http://127.0.0.1:3101/remoteEntry.js", (route) => route.abort())
  await failed.goto(`http://127.0.0.1:${hostPort}`)
  await failed.getByRole("alert").waitFor()
  if (!(await failed.getByRole("alert").innerText()).includes("could not be loaded")) {
    throw new Error("The host did not show the remote error fallback.")
  }

  await browser.close()
  process.stdout.write("Federation proof passed.\n")
} finally {
  stop(remote)
  stop(host)
}
