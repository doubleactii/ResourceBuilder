import babel from '@rollup/plugin-babel';
import replace from 'rollup-plugin-replace';
import terser from '@rollup/plugin-terser';
import { cleandir } from 'rollup-plugin-cleandir';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import packageJson from './package.json' assert { type: 'json' };

const fileName = packageJson.name;

// Add a banner at the top of the minified code
const banner = [
  `/*!`,
  ` * ${packageJson.name}@${packageJson.version} ${packageJson.repository ? packageJson.repository.url : ''}`,
  ` * Compiled ${new Date().toUTCString().replace(/GMT/g, 'UTC')}`,
  ` *`,
  ` * ${packageJson.name} is licensed under the MIT License.`,
  ` * http://www.opensource.org/licenses/mit-license`,
  ` */`,
].join('\n');

/**
 * Generates output configurations for Rollup.
 * @param {boolean} pMinify - Whether to generate minified configurations.
 * @returns {Object[]} An array of output configurations.
 */
const generateOutputConfigs = (pMinify) => {
  const outputFormats = ['iife', 'es', 'cjs'];

  return outputFormats.map((pFormat) => {
    const isMinified = pMinify ? '.min' : '';
    const isCJS = pFormat === 'cjs' ? '.cjs': '';
    const fileExtension = pFormat === 'es' ? 'mjs' : 'js';
	// Uppercase library name for global IIFE represeting this bindle. [LibraryNameBundle].bundleInstance.foo
	const iifeName = pFormat === 'iife' ? `ResourceBuilderBundle` : undefined;

    return {
      file: `dist/${pFormat}/${fileName}${isCJS}${isMinified}.${fileExtension}`,
      format: pFormat,
      name: pFormat === 'iife' ? iifeName : undefined,
      sourcemap: true,
      banner: pMinify ? undefined : banner,
      plugins: pMinify
        ? [
            terser({
              mangle: {
                // Exclude the bundle name from mangling
                reserved: iifeName ? [iifeName] : [],
              },
              module: iifeName ? false : true,
              toplevel: iifeName ? false : true,
              keep_classnames: iifeName ? false : true,
              format: {
                comments: 'some',
                preamble: banner,
              },
            }),
          ]
        : [],
    };
  });
};

const config = {
  input: `src/${fileName}.js`,
  output: [
    // Build regular
    ...generateOutputConfigs(false),
    // Build minified
    ...generateOutputConfigs(true),
  ],
  plugins: [
    // Clean the directory first
    cleandir('./dist'),
    // Replace version in source with package.json version
    replace({ ['VERSION_REPLACE_ME']: packageJson.version }),
    commonjs(),
    resolve()
  ],
};

export default [config];