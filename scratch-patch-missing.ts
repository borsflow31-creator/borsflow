import fs from 'fs';

const locales = ['en', 'ar', 'de', 'es', 'fr'];

function main() {
  for (const lang of locales) {
    let c = fs.readFileSync(`src/i18n/messages/${lang}.ts`, 'utf-8');

    // 1. isEditing
    if (lang === 'en') {
      c = c.replace(/export interface Messages {[\s\S]*?workspace: {/, match => match + '\n    isEditing: string;');
      c = c.replace(/const en: Messages = {[\s\S]*?workspace: {/, match => match + '\n    isEditing: \'{name} is editing\',');
    } else {
      c = c.replace(new RegExp(`const ${lang}: Messages = {[\\s\\S]*?workspace: {`), match => match + '\n    isEditing: \'{name} is editing\',');
    }

    // 2. products.picker
    if (lang === 'en') {
      c = c.replace(/export interface Messages {[\s\S]*?products: {/, match => match + '\n    picker: { close: string; searchPlaceholder: string; };');
      c = c.replace(/const en: Messages = {[\s\S]*?products: {/, match => match + '\n    picker: { close: \'Close product picker\', searchPlaceholder: \'Search by product name, SKU, or description\' },');
    } else {
      c = c.replace(new RegExp(`const ${lang}: Messages = {[\\s\\S]*?products: {`), match => match + '\n    picker: { close: \'Close product picker\', searchPlaceholder: \'Search by product name, SKU, or description\' },');
    }

    // 3. templates.picker
    if (lang === 'en') {
      c = c.replace(/export interface Messages {[\s\S]*?templates: {/, match => match + '\n    picker: { searchPlaceholder: string; };');
      c = c.replace(/const en: Messages = {[\s\S]*?templates: {/, match => match + '\n    picker: { searchPlaceholder: \'Search templates…\' },');
    } else {
      c = c.replace(new RegExp(`const ${lang}: Messages = {[\\s\\S]*?templates: {`), match => match + '\n    picker: { searchPlaceholder: \'Search templates…\' },');
    }

    fs.writeFileSync(`src/i18n/messages/${lang}.ts`, c);
    console.log(`Patched ${lang}.ts`);
  }
}

main();
