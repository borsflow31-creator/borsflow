const fs = require('fs');
const path = require('path');

const stitchDir = path.join(__dirname, 'stitch');
const appDir = path.join(__dirname, 'src', 'app');

const folders = fs.readdirSync(stitchDir).filter(f => fs.statSync(path.join(stitchDir, f)).isDirectory());

const allColors = new Set();

folders.forEach(folder => {
    const htmlPath = path.join(stitchDir, folder, 'code.html');
    if (!fs.existsSync(htmlPath)) return;

    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Extract tailwind config
    let colors = {};
    const tailwindMatch = htmlContent.match(/colors:\s*({[^}]*})/);
    if (tailwindMatch) {
        try {
            const colorsStr = tailwindMatch[1].replace(/(\w+):/g, '"$1":').replace(/"DEFAULT"/g, 'DEFAULT');
            // evaluate colors safely
            colors = eval(`(${tailwindMatch[1]})`);
            Object.keys(colors).forEach(k => allColors.add(k));
        } catch (e) {
            console.error('Error parsing colors for', folder, e);
        }
    }

    // Extract body content
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (!bodyMatch) return;
    let bodyContent = bodyMatch[1];
    let bodyClassMatch = htmlContent.match(/<body[^>]*class="([^"]*)"/i);
    let bodyClass = bodyClassMatch ? bodyClassMatch[1] : '';

    // Convert HTML to JSX
    bodyContent = bodyContent
        .replace(/class="/g, 'className="')
        .replace(/for="/g, 'htmlFor="')
        .replace(/stroke-width="/g, 'strokeWidth="')
        .replace(/stroke-linejoin="/g, 'strokeLinejoin="')
        .replace(/stroke-linecap="/g, 'strokeLinecap="')
        .replace(/viewbox="/g, 'viewBox="')
        .replace(/fill-rule="/g, 'fillRule="')
        .replace(/clip-rule="/g, 'clipRule="')
        .replace(/stroke-dasharray="/g, 'strokeDasharray="')
        .replace(/stroke-dashoffset="/g, 'strokeDashoffset="')
        .replace(/<!--[\s\S]*?-->/g, '') // remove comments
        .replace(/<img([^>]*)>/g, (match, attrs) => {
            if (!attrs.endsWith('/')) {
                return `<img${attrs}/>`;
            }
            return match;
        })
        .replace(/<input([^>]*)>/g, (match, attrs) => {
            if (!attrs.endsWith('/')) {
                return `<input${attrs}/>`;
            }
            return match;
        })
        .replace(/<br>/g, '<br/>')
        .replace(/<hr>/g, '<hr/>');

    // Some inline SVG properties might still need camelCase, but regex handles the most common

    const cssVars = Object.entries(colors).map(([k, v]) => `'--${k}': '${v}'`).join(', ');

    const pageComponent = `import React from 'react';

export default function Page() {
    return (
        <div style={{ ${cssVars} } as React.CSSProperties} className="${bodyClass}">
            ${bodyContent}
        </div>
    );
}
`;

    const pageDir = path.join(appDir, folder.replace(/_/g, '-'));
    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(path.join(pageDir, 'page.tsx'), pageComponent, 'utf8');
    console.log('Created page for', folder);
});

// Create new tailwind config overriding colors
const colorExt = Array.from(allColors).map(k => `"${k}": "var(--${k})"`).join(',\n      ');

const twConfig = `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./stitch/**/*.{js,ts,jsx,tsx,mdx,html}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ${colorExt}
      },
    },
  },
  plugins: [],
};
export default config;
`;

fs.writeFileSync(path.join(__dirname, 'tailwind.config.ts'), twConfig, 'utf8');
console.log('Configured tailwind.config.ts');
