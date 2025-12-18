import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@rslib/core";

class RspackDtsCopyPlugin {
	/**
	 *
	 * @param {import('@rspack/core').Compiler} compiler
	 */
	apply(compiler) {
		const projectDir = compiler.context;

		compiler.hooks.emit.tapPromise("RspackDtsCopyPlugin", async (compilation) => {
			const srcDir = path.join(projectDir, "src");

			const copyDts = (rootDir) => {
				const dtsFiles = fs.readdirSync(rootDir, "utf8").filter((v) => v.endsWith(".d.ts"));

				const createSource = (filepath, isModule) => {
					let content = fs.readFileSync(filepath, "utf8");

					// TODO: 更加完善的处理方法应该是使用 AST 进行处理，而不是简单的正则替换
					if (isModule) {
						// 替换导入的模块路径为对应的模块类型，把 .js 的模块导入，替换成为 .mts
						content = content.replace(/(from\s+['"].+?)\.js(['"])/g, "$1.mts$2");
					} else {
						// 替换导入的模块路径为对应的模块类型，把 .js 的模块导入，替换成为 .cts
						content = content.replace(/(from\s+['"].+?)\.js(['"])/g, "$1.cts$2");
					}

					return new compiler.webpack.sources.RawSource(content);
				};

				for (const file of dtsFiles) {
					const absolutePath = path.join(rootDir, file);
					const relativePath = path.relative(srcDir, absolutePath);

					compilation.emitAsset("esm/" + relativePath.replace(/\.d\.ts$/, ".d.mts"), createSource(absolutePath, true));
					compilation.emitAsset("cjs/" + relativePath.replace(/\.d\.ts$/, ".d.cts"), createSource(absolutePath, false));
				}
			};

			copyDts(path.join(projectDir, "src"));
		});
	}
}

export default defineConfig({
	source: {
		entry: {
			index: "src/index.js",
		},
	},
	lib: [
		{
			format: "esm",
			syntax: "es5",
			output: {
				sourceMap: true,
				filename: {
					js: "[name].mjs",
				},
				distPath: {
					js: "esm",
				},
			},
		},
		{
			format: "cjs",
			syntax: "es5",
			output: {
				sourceMap: true,
				filename: {
					js: "[name].cjs",
				},
				distPath: {
					js: "cjs",
				},
			},
		},
	],
	output: {
		target: "node",
	},
	tools: {
		rspack: {
			plugins: [new RspackDtsCopyPlugin()],
		},
	},
});
