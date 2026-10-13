const Module = require("module")
const path = require("path")

const typescriptEntry = require.resolve("typescript", {
  paths: [path.join(__dirname, "..")],
})

const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "typescript") {
    return typescriptEntry
  }

  return resolveFilename.call(this, request, parent, isMain, options)
}
