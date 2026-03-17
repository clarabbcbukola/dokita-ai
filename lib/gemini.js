// lib/gemini.js — Gemini AI utilities for Dokita AI

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Get embedding vector for a text string (768 dimensions)
async function embedText(text) {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// Generate a medical answer from retrieved context chunks
async function generateAnswer({ query, chunks, mode = 'chat', language = 'en' }) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
  });

  const contextText = chunks
    .map((c, i) => `[Source ${i + 1}: ${c.book_title}${c.page_hint ? ', ' + c.page_hint : ''}]\n${c.content}`)
    .join('\n\n---\n\n');

  const languageInstruction =
    language === 'yo' ? 'Respond in Yoruba language.' :
    language === 'pcm' ? 'Respond in Nigerian Pidgin English.' :
    'Respond in clear English.';

  const modeInstructions = {
    chat: `Answer the medical question clearly and thoroughly. Use headings, bullet points, and bold key terms for readability. Always cite which source you used.`,
    symptom: `The user has described symptoms. List the top 3-5 possible differential diagnoses in order of likelihood. For each: name the condition, key distinguishing features, and first-line management. Format each diagnosis clearly.`,
    drug: `Check for interactions between the drugs mentioned. State: (1) whether an interaction exists, (2) the severity (minor/moderate/major), (3) the mechanism, and (4) clinical recommendation. Be precise and cite sources.`,
    quiz: `Generate 5 multiple-choice questions (MCQs) based on the topic from the source material. Format each as: Question, then options A-D, then the correct answer and a brief explanation. Medical exam style.`,
    image: `Based on the image description and the medical source material provided, give a clinical assessment. Note any relevant conditions, possible diagnoses, and recommend next steps.`,
  };

  const systemPrompt = `You are Dokita AI, a medical knowledge assistant for healthcare professionals and students in Nigeria. You answer questions ONLY from the provided textbook excerpts below. Do not invent information not in the sources.

${languageInstruction}

TASK: ${modeInstructions[mode] || modeInstructions.chat}

Always end your response with a "Sources" section listing which books/chapters you used. Add a brief disclaimer: "This is for educational purposes. Always apply clinical judgment."

SOURCE MATERIAL FROM MEDICAL TEXTBOOKS:
${contextText}`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: `\n\nQUESTION: ${query}` },
  ]);

  return result.response.text();
}

// Analyze an uploaded image with context from books
async function analyzeImage({ imageBase64, mimeType, query, chunks }) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const contextText = chunks
    .map((c, i) => `[Source ${i + 1}: ${c.book_title}]\n${c.content}`)
    .join('\n\n---\n\n');

  const prompt = `You are Dokita AI. Analyze this medical image (prescription, symptom photo, or clinical image). Cross-reference with the medical textbook material below.

User query: ${query || 'Please analyze this image'}

TEXTBOOK CONTEXT:
${contextText}

Provide: (1) What you observe in the image, (2) Clinical significance based on the textbooks, (3) Recommended action. Cite your sources. Add disclaimer about clinical judgment.`;

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { data: imageBase64, mimeType } },
  ]);

  return result.response.text();
}

module.exports = { embedText, generateAnswer, analyzeImage };
