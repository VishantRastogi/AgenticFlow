const path = require("path")
const HtmlWebpackPlugin = require("html-webpack-plugin")
const { ModuleFederationPlugin } = require("webpack").container

const root = path.resolve(__dirname, "..")
const origin = process.env.FEDERATION_REMOTE_ORIGIN || "http://127.0.0.1:3101"

module.exports = {
  context: root,
  entry: "./host/src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    publicPath: "auto",
    clean: true,
    uniqueName: "agentflow_host",
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
      name: "agentflow_host",
      remotes: {
        agentflow_remote: `agentflow_remote@${origin}/remoteEntry.js`,
      },
      shared: {
        react: { singleton: true, requiredVersion: "^19.3.0" },
        "react-dom": { singleton: true, requiredVersion: "^19.3.0" },
      },
    }),
    new HtmlWebpackPlugin({ template: "./host/index.html" }),
  ],
}
