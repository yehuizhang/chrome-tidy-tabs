const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production"

  return {
    entry: {
      popup: './src/core/popup.ts',
      background: './src/core/background.ts'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js']
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "src/core/*.html",
            to: "[name][ext]"
          },
          {
            from: 'src/core/styles.css',
            to: 'styles.css'
          },
          {
            from: 'assets',
            to: 'assets'
          },
          {
            from: 'manifest.json',
            to: 'manifest.json'
          }
        ]
      })
    ],
    devtool: isProduction ? false : 'cheap-module-source-map',
    optimization: {
      minimize: isProduction
    }
  };
} 