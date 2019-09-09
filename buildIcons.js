const { compose, toPairs, map, camelCase, upperFirst, sortBy } = require('lodash/fp');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { transform } = require('babel-core');
const writeFile = promisify(fs.writeFile);
const { getIcons } = require('./icons');
const pascalCase = compose(
    upperFirst,
    camelCase
);
const outputPath = path.resolve(__dirname, 'dist');
const outputPathTypings = path.resolve(__dirname, 'types');

getAllIcons()
    .then(write)
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

async function getAllIcons() {
    const [customIcons] = await Promise.all([getIcons()]);
    const makePascalCase = map(([name, icon]) => [pascalCase('icon-' + name), icon]);
    const mapTemplate = templateFn => map(([name, icon]) => [name, templateFn(name, icon)]);

    return compose(sortBy(([name]) => name))([
        ...compose(
            mapTemplate(template),
            makePascalCase,
            toPairs
        )({
            ...customIcons,
        }),
    ]);
}

function template(name, icon) {
    return `import React from 'react';
import style from '../style';

export default function ${name}(props) {
    return (
        <svg style={props.customStyle || style} className={props.className} width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" preserveAspectRatio="xMaxYMid slice" focusable="false" data-cabanaico>
            ${icon}
        </svg>
    );
}
`;
}

function write(icons) {
    return Promise.all([writeTypings(map(i => i[0], icons)), writeIndex(icons), ...map(writeIcon, icons)]);
}

function writeIndex(icons) {
    const fileName = 'index.js';
    const imports = map(([name]) => `export ${name} from './${name}';`)(icons);
    const { code } = transform([...imports, '\n'].join('\n'), { plugins: ['transform-export-extensions'] });
    const { code: codeEs5 } = transform(code, { plugins: ['transform-es2015-modules-commonjs'] });
    return Promise.all([
        writeFile(path.resolve(outputPath, fileName), code),
        writeFile(path.resolve(outputPath, fileName), codeEs5),
    ]);
}

function writeIcon([name, icon]) {
    const fileName = name + '.js';
    const { code } = transform(icon, { presets: ['react'] });
    const { code: codeEs5 } = transform(code, { plugins: ['transform-es2015-modules-commonjs'] });
    return Promise.all([
        writeFile(path.resolve(outputPath, fileName), code),
        writeFile(path.resolve(outputPath, fileName), codeEs5),
    ]);
}

function writeTypings(names) {
    const exports = map(n => `export var ${n}: React.ComponentType<Cabanaico>`, names).join('\n');
    const typings = `import * as React from 'react'

export type Cabanaico = {
    small?: boolean,
    className?: string
}

${exports}
 `;

    return writeFile(path.resolve(outputPathTypings, 'index.d.ts'), typings);
}
