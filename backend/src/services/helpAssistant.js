const Terminology = require('../models/Terminology');
const FrequentQA = require('../models/FrequentQA');
const HelpConversation = require('../models/HelpConversation');

const SYSTEM_PROMPT = `You are a labeling assistant for a football video annotation platform called Shrinik.

Your job is to help labellers decide how to label uncertain situations using ONLY the official terminology definitions provided in the context.

Rules:
1. Base every answer strictly on the official definitions, criteria, and common mistakes in the context. Do not invent rules.
2. When the situation is ambiguous, you MUST ask a clarifying question before giving a final label recommendation.
3. Clarifying questions MUST include 2–4 concrete options the labeller can choose from (short phrases, not paragraphs).
4. Only give a final answer when you have enough information. Final answers must state the recommended event type(s), why (cite criteria), and what frame/timing note applies if relevant.
5. If the question is outside football event labeling, politely redirect to terminology topics.
6. Keep messages concise and practical.

Respond in JSON only with this shape:
{
  "type": "clarify" | "answer",
  "message": "string shown to the labeller",
  "options": ["option A", "option B"],
  "relatedEventTypes": ["Pass", "Recovery"],
  "title": "short FAQ title — only when type is answer, max 80 chars"
}

When type is "clarify", options must have 2–4 entries.
When type is "answer", options must be an empty array and title is required.`;

async function loadTerminologyContext(relatedEventTypes = []) {
  const filter =
    relatedEventTypes.length > 0
      ? { eventType: { $in: relatedEventTypes } }
      : {};
  const terms = await Terminology.find(filter).sort({ order: 1 }).lean();
  const allTerms = terms.length ? terms : await Terminology.find().sort({ order: 1 }).lean();

  return allTerms
    .map((term) => {
      const parts = [
        `## ${term.eventType}`,
        term.definition,
        term.criteria?.length ? `Criteria: ${term.criteria.join('; ')}` : '',
        term.commonMistakes?.length ? `Common mistakes: ${term.commonMistakes.join('; ')}` : '',
      ].filter(Boolean);
      return parts.join('\n');
    })
    .join('\n\n');
}

async function loadFrequentQAContext(limit = 8) {
  const entries = await FrequentQA.find({ published: true })
    .sort({ viewCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  if (!entries.length) return '';

  return entries
    .map(
      (entry, index) =>
        `${index + 1}. Q: ${entry.question}\n   A: ${entry.answer}\n   Events: ${(entry.relatedEventTypes || []).join(', ') || 'general'}`
    )
    .join('\n\n');
}

function buildConversationMessages(conversation, terminologyContext, faqContext, contextMeta) {
  const contextBlock = [
    '--- OFFICIAL TERMINOLOGY ---',
    terminologyContext,
    faqContext ? `\n--- FREQUENT Q&A (past resolved cases) ---\n${faqContext}` : '',
    contextMeta
      ? `\n--- LABELLER CONTEXT ---\n${JSON.stringify(contextMeta, null, 2)}`
      : '',
  ].join('\n');

  const apiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: contextBlock },
  ];

  for (const msg of conversation.messages) {
    if (msg.role === 'user') {
      const text = msg.selectedOption
        ? `${msg.content}\n(Selected: ${msg.selectedOption})`
        : msg.content;
      apiMessages.push({ role: 'user', content: text });
    } else if (msg.role === 'assistant') {
      apiMessages.push({
        role: 'assistant',
        content: JSON.stringify({
          type: msg.messageType === 'answer' ? 'answer' : 'clarify',
          message: msg.content,
          options: msg.options || [],
          relatedEventTypes: conversation.relatedEventTypes || [],
        }),
      });
    }
  }

  return apiMessages;
}

async function callOpenAI(messages) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Chat assistant is not configured (OPENAI_API_KEY missing)');
  }

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.error?.message || response.statusText;
    throw new Error(`ChatGPT API error: ${detail}`);
  }

  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error('Empty response from ChatGPT');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON from ChatGPT');
  }

  if (!parsed.message || !['clarify', 'answer'].includes(parsed.type)) {
    throw new Error('Unexpected assistant response format');
  }

  return {
    type: parsed.type,
    message: String(parsed.message).trim(),
    options: Array.isArray(parsed.options) ? parsed.options.map(String).slice(0, 4) : [],
    relatedEventTypes: Array.isArray(parsed.relatedEventTypes)
      ? parsed.relatedEventTypes.map(String)
      : [],
    title: parsed.title ? String(parsed.title).trim().slice(0, 120) : '',
  };
}

function extractClarifications(conversation) {
  const steps = [];
  for (let i = 0; i < conversation.messages.length; i += 1) {
    const msg = conversation.messages[i];
    if (msg.role !== 'assistant' || msg.messageType !== 'clarify') continue;

    const nextUser = conversation.messages[i + 1];
    steps.push({
      question: msg.content,
      options: msg.options || [],
      selectedOption: nextUser?.selectedOption || nextUser?.content || '',
    });
  }
  return steps;
}

function firstUserQuestion(conversation) {
  const first = conversation.messages.find((m) => m.role === 'user');
  return first?.content || 'Labeling question';
}

async function saveFrequentQA(conversation, assistantReply, user) {
  const clarifications = extractClarifications(conversation);
  const question = firstUserQuestion(conversation);

  const entry = await FrequentQA.create({
    title: assistantReply.title || question.slice(0, 80),
    question,
    answer: assistantReply.message,
    relatedEventTypes: assistantReply.relatedEventTypes.length
      ? assistantReply.relatedEventTypes
      : conversation.relatedEventTypes,
    clarifications,
    conversationId: conversation._id,
    createdBy: user._id,
    createdByName: user.name || '',
    published: true,
  });

  conversation.frequentQAId = entry._id;
  conversation.status = 'resolved';
  await conversation.save();

  return entry;
}

async function sendHelpMessage({
  user,
  conversationId,
  message,
  selectedOption,
  assignmentId,
  context = {},
}) {
  let conversation;

  if (conversationId) {
    conversation = await HelpConversation.findOne({
      _id: conversationId,
      userId: user._id,
    });
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    if (conversation.status === 'resolved') {
      throw new Error('This conversation is closed. Start a new question.');
    }
  } else {
    conversation = await HelpConversation.create({
      userId: user._id,
      assignmentId: assignmentId || undefined,
      context: {
        page: context.page || 'labeling',
        assignmentKind: context.assignmentKind,
        assignmentTitle: context.assignmentTitle,
        lastEventType: context.lastEventType,
        fps: context.fps,
      },
      messages: [],
    });
  }

  const userText = (selectedOption || message || '').trim();
  if (!userText) {
    throw new Error('Message is required');
  }

  conversation.messages.push({
    role: 'user',
    content: selectedOption ? selectedOption : userText,
    selectedOption: selectedOption || undefined,
    messageType: 'text',
  });

  const relatedTypes = conversation.relatedEventTypes || [];
  if (context.lastEventType && !relatedTypes.includes(context.lastEventType)) {
    relatedTypes.push(context.lastEventType);
  }

  const terminologyContext = await loadTerminologyContext(relatedTypes);
  const faqContext = await loadFrequentQAContext();
  const apiMessages = buildConversationMessages(
    conversation,
    terminologyContext,
    faqContext,
    conversation.context
  );

  const assistantReply = await callOpenAI(apiMessages);

  if (assistantReply.type === 'clarify' && assistantReply.options.length < 2) {
    assistantReply.options = ['Yes', 'No', 'Not sure — need more detail'];
  }

  conversation.messages.push({
    role: 'assistant',
    content: assistantReply.message,
    messageType: assistantReply.type === 'answer' ? 'answer' : 'clarify',
    options: assistantReply.type === 'clarify' ? assistantReply.options : [],
  });

  if (assistantReply.relatedEventTypes.length) {
    conversation.relatedEventTypes = [
      ...new Set([...(conversation.relatedEventTypes || []), ...assistantReply.relatedEventTypes]),
    ];
  }

  await conversation.save();

  let frequentQA = null;
  if (assistantReply.type === 'answer') {
    frequentQA = await saveFrequentQA(conversation, assistantReply, user);
  }

  return {
    conversation: conversation.toObject(),
    frequentQA: frequentQA?.toObject() || null,
  };
}

async function listFrequentQA({ search, eventType, includeUnpublished = false } = {}) {
  const filter = includeUnpublished ? {} : { published: true };

  if (eventType) {
    filter.relatedEventTypes = eventType;
  }

  if (search?.trim()) {
    const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: regex }, { question: regex }, { answer: regex }];
  }

  return FrequentQA.find(filter)
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name email role')
    .lean();
}

async function getFrequentQA(id, { incrementView = false } = {}) {
  const entry = await FrequentQA.findById(id).populate('createdBy', 'name email role').lean();
  if (!entry) return null;
  if (incrementView) {
    await FrequentQA.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
    entry.viewCount += 1;
  }
  return entry;
}

module.exports = {
  sendHelpMessage,
  listFrequentQA,
  getFrequentQA,
  loadTerminologyContext,
};
