// lib/processor.js — Extract text from PDFs/DOCX and chunk it

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const CHUNK_SIZE = 500;   // words per chunk
const CHUNK_OVERLAP = 50; // words overlap between chunks

// Extract raw text from a file buffer
async function extractText(buffer, filename) {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === 'docx' || ext === 'doc') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === 'txt') {
    return buffer.toString('utf-8');
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

// Clean extracted text
function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

// Detect a rough page/chapter hint from text position
function getPageHint(text, position, totalLength) {
  const percent = Math.floor((position / totalLength) * 100);
  // Try to find chapter heading near this position
  const nearby = text.substring(Math.max(0, position - 200), position);
  const chapterMatch = nearby.match(/chapter\s+(\d+|[ivxlc]+)/i);
  if (chapterMatch) return `Chapter ${chapterMatch[1]}`;
  return `~${percent}% through document`;
}

// Split text into overlapping word-based chunks
function chunkText(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    const chunkWords = words.slice(i, i + CHUNK_SIZE);
    const content = chunkWords.join(' ');
    chunks.push({
      index: chunks.length,
      content,
      pageHint: getPageHint(text, text.indexOf(chunkWords[0]), text.length),
    });
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

// Full pipeline: buffer → cleaned chunks ready for embedding
async function processDocument(buffer, filename) {
  const rawText = await extractText(buffer, filename);
  const cleanedText = cleanText(rawText);

  if (cleanedText.length < 100) {
    throw new Error('Document appears to be empty or unreadable');
  }

  const chunks = chunkText(cleanedText);
  return { chunks, wordCount: cleanedText.split(/\s+/).length };
}

module.exports = { processDocument };
