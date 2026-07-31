const path = require("node:path");

const CONTROL_CHARACTER = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const FORMULA_PREFIX = /^[=+\-@]/;
const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bpostgres(?:ql)?:\/\//i,
  /\b(?:sk|sb_secret)_[A-Za-z0-9_-]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bservice[_-]?role\b.{0,20}\beyJ[A-Za-z0-9_-]+/i,
];

function csvError(source, row, column, message) {
  const error = new Error(`${source}: row ${row}, column ${column}: ${message}`);
  error.row = row;
  error.column = column;
  return error;
}

function parseCsv(input, expectedHeaders, source = "CSV") {
  if (typeof input !== "string") throw new TypeError("CSV input must be a string");
  const text = input.startsWith("\uFEFF") ? input.slice(1) : input;
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  let row = 1;
  let column = 1;
  for (let index = 0; index <= text.length; index += 1) {
    const character = index === text.length ? null : text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else if (character === null) {
        throw csvError(source, row, column, "unterminated quoted field");
      } else {
        field += character;
        if (character === "\n") row += 1;
      }
      continue;
    }
    if (closedQuote && character !== "," && character !== "\r" && character !== "\n" && character !== null) {
      throw csvError(source, row, column, "unexpected character after closing quote");
    }
    if (character === '"') {
      if (field.length !== 0 || closedQuote) throw csvError(source, row, column, "quote must begin a field");
      quoted = true;
      continue;
    }
    if (character === "," || character === "\r" || character === "\n" || character === null) {
      record.push(field);
      field = "";
      closedQuote = false;
      column += 1;
      if (character === ",") continue;
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      if (record.length > 1 || record[0] !== "" || records.length === 0) records.push(record);
      record = [];
      row += 1;
      column = 1;
      continue;
    }
    field += character;
  }
  if (records.length === 0) throw new Error(`${source}: CSV is empty`);
  const headers = records[0];
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicates.length) throw new Error(`${source}: duplicate header ${duplicates[0]}`);
  if (headers.length !== expectedHeaders.length || headers.some((header, index) => header !== expectedHeaders[index])) {
    throw new Error(`${source}: headers must exactly equal ${expectedHeaders.join(",")}`);
  }
  return records.slice(1).map((values, index) => {
    const recordNumber = index + 2;
    if (values.length !== headers.length) throw csvError(source, recordNumber, values.length + 1, `expected ${headers.length} columns, found ${values.length}`);
    const object = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex]]));
    Object.defineProperty(object, "__rowNumber", { value: recordNumber, enumerable: false });
    return object;
  });
}

function encodeCsv(headers, rows) {
  const encode = (value) => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `\uFEFF${[headers, ...rows].map((row) => row.map(encode).join(",")).join("\n")}\n`;
}

function validateAuthoredText(value, location, { required = true, max = 500 } = {}) {
  if (typeof value !== "string") throw new Error(`${location}: must be text`);
  if (required && value.length === 0) throw new Error(`${location}: must not be empty`);
  if (value.trim() !== value) throw new Error(`${location}: must not have surrounding whitespace`);
  if (value.length > max) throw new Error(`${location}: must be at most ${max} characters`);
  if (CONTROL_CHARACTER.test(value)) throw new Error(`${location}: contains a forbidden control character`);
  if (FORMULA_PREFIX.test(value)) throw new Error(`${location}: spreadsheet formula prefixes are forbidden`);
  if (SECRET_PATTERNS.some((pattern) => pattern.test(value))) throw new Error(`${location}: resembles a credential or connection string`);
  return value;
}

function resolveAllowedOutput(repositoryRoot, requestedPath, allowedDirectory, expectedFileName) {
  const root = path.resolve(repositoryRoot);
  const allowedRoot = path.resolve(root, allowedDirectory);
  const resolved = path.resolve(root, requestedPath);
  if (path.dirname(resolved) !== allowedRoot || path.basename(resolved) !== expectedFileName) {
    throw new Error(`output path must be ${path.join(allowedDirectory, expectedFileName)}`);
  }
  return resolved;
}

module.exports = { encodeCsv, parseCsv, resolveAllowedOutput, validateAuthoredText };
