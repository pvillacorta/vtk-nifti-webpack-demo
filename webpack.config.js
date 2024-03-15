const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { ProgressPlugin } = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    return {
        entry: './src/index.js',
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        output: {
            filename: '[name].[contenthash].js',
            path: path.resolve(__dirname, 'dist'),
        },
        optimization: {
            minimize: isProduction,
            minimizer: [new TerserPlugin()],
        },
        plugins: [
            new ProgressPlugin(),
            new CleanWebpackPlugin(),
            new HtmlWebpackPlugin({
                template: 'src/index.html',
            }),
            new CopyPlugin({
                patterns: [
                    { from: 'public', to: 'public' },
                    { from: 'node_modules/@itk-wasm/image-io/dist/pipelines/*.{js,wasm,wasm.zst}', to: 'pipelines/[name][ext]' }
                ],
            }),
        ],
        devServer: {
            static: {
                directory: './public',
                publicPath: '/public',
            }
        },
        devtool: 'source-map',
    };
};
