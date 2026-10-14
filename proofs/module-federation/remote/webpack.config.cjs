const path = require("path")
const HtmlWebpackPlugin = require("html-webpack-plugin")
const { ModuleFederationPlugin } = require("webpack").container

const root = path.resolve(__dirname, "..")
const origin = process.env.FEDERATION_REMOTE_ORIGIN || "http://127.0.0.1:3101"

module.exports = {
  context: root,
  entry: "./remote/src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    publicPath: `${origin}/`,
    clean: true,
    uniqueName: "agentflow_remote",
  },
  resolve: {
    extensions: [".js", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.jsx$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: { presets: [["@babel/preset-react", { runtime: "automatic" }]] },
        },
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: "agentflow_remote",
      filename: "remoteEntry.js",
      exposes: {
        "./AgentHealthCard": "./remote/src/AgentHealthCard.jsx",
      },
      shared: {
        react: { singleton: true, requiredVersion: "^19.3.0" },
        "react-dom": { singleton: true, requiredVersion: "^19.3.0" },
      },
    }),
    new HtmlWebpackPlugin({ template: "./remote/index.html" }),
  ],
}
