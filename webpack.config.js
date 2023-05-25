const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const glob = require('glob');

var entry = {};
glob.sync('./src/examples/**/*.ts', {
    ignore: ['./src/examples/**/*helper*.*', './src/examples/**/*common*.*', './src/examples/**/*data*.*']
}).map(f => {    
    let mf = f.split('/');
    let len = mf.length;
    if(mf[len-2].includes('sc')){
        let en = mf[len-2] + "-" + mf[len-1].slice(0, -3);
        entry[en] = f;
    } else {
        let en = mf[len-1].slice(0, -3);
        entry[en] = f;
    }    
})

module.exports = {
    entry,
    output: {
        clean: true,
        path: path.resolve(__dirname, "dist"),
        assetModuleFilename: (pth) => {
        const fpath = path
            .dirname(pth.filename)
            .split("/")
            .slice(1)
            .join("/");
        return `${fpath}/[hash][ext][query]`;
        },
    },
    target: 'web',
    performance:{
        hints: false,
    },
    mode: "development",
    devtool: "inline-source-map",
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\.(png|jpg|jpeg|ttf)$/i,
                type: "asset/resource",
            },
            {
                // set shader files 
                test: /\.(wgsl|glsl|vs|fs)$/,
                type: "asset/source",
            },
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            }
        ]
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    plugins:[
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: 'src/html/index.html',
            inject: false,
        }),
    ]
};
