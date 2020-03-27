import postcss from 'rollup-plugin-postcss-independed';
import autoprefixer from 'autoprefixer';
import json from 'rollup-plugin-json';
import babel from 'rollup-plugin-simple-babel';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import iconv from 'iconv-lite';
import postcssSvgo from 'postcss-svgo';
import * as fs from 'fs';
import resolvePackageModule from './utils/resolve-package-module';
import {getEncoding} from './tools/build/adjust-encoding';
import postcssBackgroundUrl from './plugins/postcss/postcss-backbround-url';
import rollupFiles from './plugins/rollup/rollup-plugin-files';

export default function rollupConfig({
	input,
	output,
	context,
	plugins = {},
	cssImages = {},
	resolveFilesImport = {},
}) {
	const enabledPlugins = [];
	const isLoaded = (id) => !!enabledPlugins.find((item) => {
		return item.name === id;
	});

	if (Array.isArray(plugins.custom))
	{
		plugins.custom.forEach((item) => {
			enabledPlugins.push(item);
		});
	}

	if (plugins.resolve && !isLoaded('node-resolve'))
	{
		enabledPlugins.push(resolve({
			browser: true,
		}));
	}

	if (!isLoaded('json'))
	{
		enabledPlugins.push(json());
	}

	if (!isLoaded('postcss'))
	{
		enabledPlugins.push(postcss({
			extract: output.css || true,
			sourceMap: false,
			plugins: [
				postcssBackgroundUrl(
					cssImages,
					output.css,
					context,
				),
				(() => {
					if (cssImages.svgo !== false)
					{
						return postcssSvgo({
							encode: true,
						});
					}

					return undefined;
				})(),
				autoprefixer({
					overrideBrowserslist: [
						'ie >= 11',
						'last 4 version',
					],
				}),
			],
		}));
	}

	if (plugins.babel !== false)
	{
		enabledPlugins.push(babel(plugins.babel || {
			sourceMaps: true,
			presets: [
				[
					resolvePackageModule('@babel/preset-env'),
					{
						targets: {
							ie: '11',
						},
					},
				],
			],
			plugins: [
				resolvePackageModule('@babel/plugin-external-helpers'),
				resolvePackageModule('@babel/plugin-proposal-object-rest-spread'),
				resolvePackageModule('@babel/plugin-transform-flow-strip-types'),
				resolvePackageModule('@babel/plugin-proposal-class-properties'),
				resolvePackageModule('@babel/plugin-proposal-private-methods'),
				resolvePackageModule('@babel/plugin-transform-classes'),
			],
		}));
	}

	if (plugins.resolve && !isLoaded('commonjs'))
	{
		enabledPlugins.push(commonjs({
			sourceMap: false,
		}));
	}

	return {
		input: {
			input: input.input,
			external: [
				'BX',
			],
			treeshake: input.treeshake !== false,
			plugins: [
				(() => {
					if (!isLoaded('url') && resolveFilesImport !== false)
					{
						return rollupFiles({
							resolveFilesImport,
							context,
							input: input.input,
							output: output.js,
						});
					}

					return undefined;
				})(),
				{
					load(id) {
						if (!fs.existsSync(id))
						{
							return null;
						}

						const file = fs.readFileSync(id);
						const fileEncoding = getEncoding(file);

						const decoded = iconv.decode(file, fileEncoding);
						const encoded = iconv.encode(decoded, 'utf-8');

						return encoded.toString('utf-8');
					},
				},
				...enabledPlugins,
			],
			onwarn: () => {},
		},
		output: {
			file: output.js,
			name: output.name || 'window',
			format: 'iife',
			sourcemap: true,
			extend: true,
			exports: 'named',
			globals: {
				BX: 'BX',
				window: 'window',
				...output.globals,
			},
		},
	};
}