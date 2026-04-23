import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

loadEnvFile(envPath);

const PORT = Number(process.env.PORT || 8787);
const DASHSCOPE_BASE_URL = (process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
const DASHSCOPE_ASR_MODEL = process.env.DASHSCOPE_ASR_MODEL || 'qwen3-asr-flash';
const DASHSCOPE_COACH_MODEL = process.env.DASHSCOPE_COACH_MODEL || 'qwen3.5-omni-flash';
const DASHSCOPE_QA_MODEL = process.env.DASHSCOPE_QA_MODEL || process.env.DASHSCOPE_COACH_MODEL || 'qwen-plus';
const DASHSCOPE_REPORT_MODEL = process.env.DASHSCOPE_REPORT_MODEL || 'qwen-plus';

const server = createServer(async (req, res) => {
  setCorsHeaders(res);

  if (!req.url) {
    sendJson(res, 400, { error: 'Missing request URL.' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        providerConfig: {
          dashscope: Boolean(process.env.DASHSCOPE_API_KEY),
        },
        modelConfig: {
          asr: DASHSCOPE_ASR_MODEL,
          coach: DASHSCOPE_COACH_MODEL,
          qa: DASHSCOPE_QA_MODEL,
          report: DASHSCOPE_REPORT_MODEL,
        },
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/asr') {
      const form = await toWebRequest(req).formData();
      const audioFile = form.get('audio_file');
      const language = String(form.get('language') || 'zh-CN');
      const mimeType = String(form.get('mime_type') || audioFile?.type || 'audio/x-m4a');

      if (!audioFile || typeof audioFile === 'string' || typeof audioFile.arrayBuffer !== 'function') {
        sendJson(res, 400, { error: 'audio_file is required.' });
        return;
      }

      ensureDashScopeConfigured();

      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      const dataUrl = `data:${mimeType};base64,${audioBuffer.toString('base64')}`;

      const payload = await requestDashScope({
        model: DASHSCOPE_ASR_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: {
                  data: dataUrl,
                  format: inferAudioFormat(mimeType),
                },
              },
            ],
          },
        ],
        stream: false,
        asr_options: {
          language: normalizeLanguage(language),
          enable_itn: true,
        },
      });

      sendJson(res, 200, {
        text: extractTextFromOpenAICompatiblePayload(payload),
        raw: payload,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/coach') {
      ensureDashScopeConfigured();

      const contentType = String(req.headers['content-type'] || '');
      const source = contentType.includes('multipart/form-data')
        ? await readCoachMultipartBody(req)
        : await readCoachJsonBody(req);

      const recentTranscript = source.text.trim().split(/\n+/).slice(-3).join('\n');

      if (source.scope === 'voice_content' && !recentTranscript && !source.audioDataUrl) {
        sendJson(res, 400, { error: 'text or audio_file is required for voice_content.' });
        return;
      }

      if (source.scope === 'body_visual' && !source.frameBase64) {
        sendJson(res, 400, { error: 'frameBase64 is required for body_visual.' });
        return;
      }

      let parsed = null;

      try {
        const payload = await requestCoachPayload({
          ...source,
          recentTranscript,
        });
        parsed = parseJsonBlock(extractTextFromOpenAICompatiblePayload(payload));
      } catch (error) {
        console.warn(`coach request failed for ${source.scope}, using fallback`, error);
      }

      sendJson(
        res,
        200,
        normalizeCoachPayload(parsed, {
          scope: source.scope,
          fullText: source.text,
          hasFrame: Boolean(source.frameBase64),
        }),
      );
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/qa/start') {
      ensureDashScopeConfigured();

      const body = await toWebRequest(req).json();
      const transcript = String(body?.transcript || '');
      const language = String(body?.language || 'zh-CN');
      const sceneTitle = String(body?.sceneTitle || '演讲训练');
      const sceneGoal = String(body?.sceneGoal || '完成当前场景的表达任务');
      const focusKeywords = Array.isArray(body?.focusKeywords)
        ? body.focusKeywords.map((item) => String(item)).filter(Boolean)
        : [];

      let parsed = null;

      try {
        const payload = await requestDashScope({
          model: DASHSCOPE_QA_MODEL,
          messages: [
            {
              role: 'user',
              content: buildQAStartPrompt({
                transcript,
                language,
                sceneTitle,
                sceneGoal,
                focusKeywords,
              }),
            },
          ],
          temperature: 0.45,
          stream: false,
        });
        parsed = parseJsonBlock(extractTextFromOpenAICompatiblePayload(payload));
      } catch (error) {
        console.warn('qa start failed, using fallback', error);
      }

      const fallbackQuestion = transcript
        ? '如果现在只能让听众记住一句话，你会把哪一句作为这一轮表达的核心结论？'
        : '先用一句话说出你这轮最想让听众记住的核心观点。';

      sendJson(res, 200, {
        question: typeof parsed?.question === 'string' && parsed.question.trim() ? parsed.question.trim() : fallbackQuestion,
        goal: typeof parsed?.goal === 'string' && parsed.goal.trim() ? parsed.goal.trim() : '先把核心结论说短、说清楚，再补一个支持理由。',
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/qa/continue') {
      ensureDashScopeConfigured();

      const body = await toWebRequest(req).json();
      const transcript = String(body?.transcript || '');
      const answerText = String(body?.answerText || '');
      const language = String(body?.language || 'zh-CN');
      const sceneTitle = String(body?.sceneTitle || '演讲训练');
      const sceneGoal = String(body?.sceneGoal || '完成当前场景的表达任务');
      const focusKeywords = Array.isArray(body?.focusKeywords)
        ? body.focusKeywords.map((item) => String(item)).filter(Boolean)
        : [];
      const currentQuestion = String(body?.currentQuestion || '');
      const history = Array.isArray(body?.history) ? body.history : [];

      let parsed = null;

      try {
        const payload = await requestDashScope({
          model: DASHSCOPE_QA_MODEL,
          messages: [
            {
              role: 'user',
              content: buildQAContinuePrompt({
                transcript,
                answerText,
                language,
                sceneTitle,
                sceneGoal,
                focusKeywords,
                currentQuestion,
                history,
              }),
            },
          ],
          temperature: 0.4,
          stream: false,
        });
        parsed = parseJsonBlock(extractTextFromOpenAICompatiblePayload(payload));
      } catch (error) {
        console.warn('qa continue failed, using fallback', error);
      }

      const answerLength = answerText.trim().replace(/\s+/g, '').length;
      const fallbackDone = answerLength > 90;

      sendJson(res, 200, {
        feedback:
          typeof parsed?.feedback === 'string' && parsed.feedback.trim()
            ? parsed.feedback.trim()
            : answerLength > 30
              ? '这轮回答方向是对的，下一句把结论再提前一点，并补一个更具体的例子。'
              : '现在的回答还偏短，先直接落结论，再补一个最有力的依据。',
        nextQuestion:
          typeof parsed?.nextQuestion === 'string' && parsed.nextQuestion.trim()
            ? parsed.nextQuestion.trim()
            : fallbackDone
              ? null
              : '如果把刚才这段收成一句更有说服力的话，你会怎么重新组织？',
        nextGoal:
          typeof parsed?.nextGoal === 'string' && parsed.nextGoal.trim()
            ? parsed.nextGoal.trim()
            : fallbackDone
              ? null
              : '把结论放在第一句，并补一个具体例子。',
        done: typeof parsed?.done === 'boolean' ? parsed.done : fallbackDone,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/final-report') {
      ensureDashScopeConfigured();

      const body = await toWebRequest(req).json();
      const transcript = String(body?.transcript || '');
      const language = String(body?.language || 'zh-CN');
      const sceneTitle = String(body?.sceneTitle || '演讲训练');

      if (!transcript.trim()) {
        sendJson(res, 400, { error: 'transcript is required.' });
        return;
      }

      const payload = await requestFinalReportPayload({ transcript, language, sceneTitle });

      const rawText = extractTextFromOpenAICompatiblePayload(payload);
      const report = normalizeFinalReport(parseJsonBlock(rawText));

      sendJson(res, 200, {
        report,
        raw: rawText,
      });
      return;
    }

    sendJson(res, 404, { error: 'Not found.' });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Unexpected server error.',
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SpeakOut local proxy listening on http://0.0.0.0:${PORT}`);
});

function ensureDashScopeConfigured() {
  if (!process.env.DASHSCOPE_API_KEY) {
    throw new Error('Missing DASHSCOPE_API_KEY in .env.');
  }
}

async function requestDashScope(payload) {
  const response = await fetchWithRetry(
    `${DASHSCOPE_BASE_URL}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify(payload),
    },
    1,
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || 'DashScope request failed.');
  }

  return data;
}

async function requestFinalReportPayload({ transcript, language, sceneTitle }) {
  const messages = [
    {
      role: 'system',
      content:
        '你是一位专业演讲评委，严格采用 Speak Up 场景化演讲评价体系。你必须严格输出 JSON，不要输出 markdown、解释、前后缀文本。JSON 结构为 {"totalScore":number,"summary":string,"radarScores":{"contentStructure":number,"languageExpression":number,"fluencyRhythm":number,"vocalDelivery":number,"nonverbalPresence":number,"audienceImpact":number},"actionableAdvice":[string,string,string]}。所有分数必须是 0 到 100 的整数，actionableAdvice 必须正好 3 条。',
    },
    {
      role: 'user',
      content: `请基于 Speak Up 场景化演讲评价体系分析以下真实演讲逐字稿，并严格按指定 JSON 返回。\n场景：${sceneTitle}\n语言：${language}\n统一六维：内容结构、语言表达、流利度与节奏、语音表现、非语言呈现、听众感与影响力。\n逐字稿：\n${transcript}`,
    },
  ];

  return requestDashScope({
    model: DASHSCOPE_REPORT_MODEL,
    temperature: 0.2,
    stream: false,
    response_format: {
      type: 'json_object',
    },
    messages,
  });
}

async function fetchWithRetry(url, init, retries = 1) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error('fetch failed');
}

async function requestCoachPayload(input) {
  const content =
    input.scope === 'voice_content'
      ? buildVoiceCoachRequestContent(input)
      : buildBodyCoachRequestContent(input);

  try {
    return await requestDashScope({
      model: DASHSCOPE_COACH_MODEL,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
      temperature: 0.05,
      stream: false,
      response_format: {
        type: 'json_object',
      },
    });
  } catch (error) {
    if (input.scope !== 'voice_content' || !input.audioDataUrl) {
      throw error;
    }

    return requestDashScope({
      model: DASHSCOPE_COACH_MODEL,
      messages: [
        {
          role: 'user',
          content: buildVoiceCoachRequestContent({
            ...input,
            audioDataUrl: '',
          }),
        },
      ],
      temperature: 0.05,
      stream: false,
      response_format: {
        type: 'json_object',
      },
    });
  }
}

async function readCoachJsonBody(req) {
  const body = await toWebRequest(req).json();

  return {
    scope: body?.scope === 'body_visual' ? 'body_visual' : 'voice_content',
    text: String(body?.text || ''),
    language: String(body?.language || 'zh-CN'),
    sceneTitle: String(body?.sceneTitle || '演讲训练'),
    sceneGoal: String(body?.sceneGoal || '完成当前场景的表达任务'),
    focusKeywords: Array.isArray(body?.focusKeywords)
      ? body.focusKeywords.map((item) => String(item)).filter(Boolean)
      : [],
    frameBase64: typeof body?.frameBase64 === 'string' ? body.frameBase64.trim() : '',
    speechContext: body?.speechContext && typeof body.speechContext === 'object' ? body.speechContext : null,
    audioDataUrl: '',
    audioTranscript: '',
  };
}

async function readCoachMultipartBody(req) {
  const form = await toWebRequest(req).formData();
  const audioFile = form.get('audio_file');
  const mimeType = String(form.get('mime_type') || audioFile?.type || 'audio/x-m4a');
  let audioDataUrl = '';

  if (audioFile && typeof audioFile !== 'string' && typeof audioFile.arrayBuffer === 'function') {
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    audioDataUrl = `data:${mimeType};base64,${audioBuffer.toString('base64')}`;
  }

  return {
    scope: form.get('scope') === 'body_visual' ? 'body_visual' : 'voice_content',
    text: String(form.get('text') || ''),
    language: String(form.get('language') || 'zh-CN'),
    sceneTitle: String(form.get('sceneTitle') || '演讲训练'),
    sceneGoal: String(form.get('sceneGoal') || '完成当前场景的表达任务'),
    focusKeywords: parseFocusKeywords(form.get('focusKeywords')),
    frameBase64: '',
    speechContext: null,
    audioDataUrl,
    audioTranscript: String(form.get('audioTranscript') || ''),
  };
}

function parseFocusKeywords(value) {
  if (!value || typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).filter(Boolean);
    }
  } catch {}

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildBodyCoachRequestContent({
  language,
  sceneTitle,
  sceneGoal,
  focusKeywords,
  frameBase64,
  speechContext,
}) {
  const focus = focusKeywords.length ? focusKeywords.join('、') : '围绕当前场景目标完成表达';

  return [
    {
      type: 'text',
      text: [
        'You are the AI Live Coach for Speak Out.',
        'You are only responsible for the body_visual lane.',
        'Only evaluate body_expression. Do not evaluate voice_pacing or content_expression.',
        'Use the latest camera frame and the nearby speech summary to judge whether the speaker looks tense, stable, open, natural, or disconnected.',
        'If the change is weak or the advice is nearly identical to the previous moment, set should_emit to false.',
        `Scene: ${sceneTitle}`,
        `Scene goal: ${sceneGoal}`,
        `Focus keywords: ${focus}`,
        `Output language: ${language}`,
        `Nearby speech context: ${speechContext ? JSON.stringify(speechContext) : 'none'}`,
        'Return JSON only.',
        'Schema: {"should_emit":boolean,"summary":"string","coachPanel":{"summary":{"title":"string","detail":"string","sourceDimension":"body_expression"},"bodyExpression":{"status":"doing_well|stable|adjust_now|analyzing","headline":"string","detail":"string"}}}',
      ].join('\n'),
    },
    {
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${frameBase64}`,
      },
    },
  ];
}

function buildVoiceCoachRequestContent({
  language,
  sceneTitle,
  sceneGoal,
  focusKeywords,
  recentTranscript,
  audioDataUrl,
  audioTranscript,
}) {
  const focus = focusKeywords.length ? focusKeywords.join('、') : '围绕当前场景目标完成表达';
  const content = [
    {
      type: 'text',
      text: [
        'You are the AI Live Coach for Speak Out.',
        'You are only responsible for the voice_content lane.',
        'Only update voice_pacing and content_expression. Do not output body_expression.',
        'Treat this request as one speaking turn that has just reached a natural pause.',
        'Use the nearby audio first to judge speaking pace, pause placement, sentence endings, repeated restarts, emphasis, breath pressure, and whether the delivery sounds rushed or steady.',
        'Use the transcript only to judge content_expression: whether the point lands early, whether the main line is clear, and whether the sentence finishes cleanly.',
        'If the change is weak or nearly identical to the previous turn, set should_emit to false.',
        `Scene: ${sceneTitle}`,
        `Scene goal: ${sceneGoal}`,
        `Focus keywords: ${focus}`,
        `Output language: ${language}`,
        'Return JSON only.',
        'Schema: {"should_emit":boolean,"summary":"string","coachPanel":{"summary":{"title":"string","detail":"string","sourceDimension":"voice_pacing|content_expression"},"voicePacing":{"status":"doing_well|stable|adjust_now|analyzing","headline":"string","detail":"string"},"contentExpression":{"status":"doing_well|stable|adjust_now|analyzing","headline":"string","detail":"string"}}}',
        `Transcript from the same turn:\n${recentTranscript || audioTranscript || 'No transcript provided.'}`,
      ].join('\n'),
    },
  ];

  if (audioDataUrl) {
    content.push({
      type: 'input_audio',
      input_audio: {
        data: audioDataUrl,
        format: inferAudioFormat('audio/x-m4a'),
      },
    });
  }

  return content;
}

function buildQAStartPrompt({ transcript, language, sceneTitle, sceneGoal, focusKeywords }) {
  const focus = focusKeywords.length ? focusKeywords.join('、') : '围绕当前场景目标完成表达';

  return [
    'You are a virtual speech coach for Speak Out.',
    'Ask one short, natural follow-up question that can be spoken aloud directly to the user.',
    'Do not output long explanations or multiple questions.',
    `Scene: ${sceneTitle}`,
    `Scene goal: ${sceneGoal}`,
    `Focus keywords: ${focus}`,
    `Output language: ${language}`,
    'Return JSON only.',
    'Schema: {"question":"string","goal":"string"}',
    'question is the spoken follow-up question.',
    'goal explains what the user should clarify next.',
    'Current transcript:',
    transcript || 'No transcript yet. Start with a warm opening question.',
  ].join('\n');
}

function buildQAContinuePrompt({
  transcript,
  answerText,
  language,
  sceneTitle,
  sceneGoal,
  focusKeywords,
  currentQuestion,
  history,
}) {
  const focus = focusKeywords.length ? focusKeywords.join('、') : '围绕当前场景目标完成表达';

  return [
    'You are a virtual speech coach for Speak Out.',
    'You are in a spoken coaching turn, so keep every line short enough to be read aloud naturally.',
    'Return JSON only.',
    'Schema: {"feedback":"string","nextQuestion":"string|null","nextGoal":"string|null","done":boolean}',
    `Scene: ${sceneTitle}`,
    `Scene goal: ${sceneGoal}`,
    `Focus keywords: ${focus}`,
    `Output language: ${language}`,
    `Current question: ${currentQuestion || 'none'}`,
    `Current answer: ${answerText || 'none'}`,
    `Full transcript: ${transcript || 'none'}`,
    `Recent history: ${JSON.stringify(history)}`,
    'feedback should be one short spoken coaching line.',
    'nextQuestion should be one short spoken follow-up question, or null if done.',
    'nextGoal should state what the user should clarify next, or null if done.',
  ].join('\n');
}

function normalizeCoachPayload(parsed, context) {
  const fallback = buildFallbackCoachPayload(context.fullText, context.hasFrame, context.scope);

  if (!parsed || typeof parsed !== 'object') {
    return fallback;
  }

  const shouldEmit = parsed.should_emit !== false;
  const coachPanel = parsed.coachPanel && typeof parsed.coachPanel === 'object' ? parsed.coachPanel : parsed;
  const now = Date.now();

  return {
    shouldEmit,
    insight:
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : typeof coachPanel.summary?.detail === 'string' && coachPanel.summary.detail.trim()
          ? coachPanel.summary.detail.trim()
          : fallback.insight,
    coachPanel: {
      summary: {
        title:
          typeof coachPanel.summary?.title === 'string' && coachPanel.summary.title.trim()
            ? coachPanel.summary.title.trim()
            : fallback.coachPanel.summary.title,
        detail:
          typeof coachPanel.summary?.detail === 'string' && coachPanel.summary.detail.trim()
            ? coachPanel.summary.detail.trim()
            : fallback.coachPanel.summary.detail,
        sourceDimension:
          coachPanel.summary?.sourceDimension === 'body_expression' ||
          coachPanel.summary?.sourceDimension === 'voice_pacing' ||
          coachPanel.summary?.sourceDimension === 'content_expression'
            ? coachPanel.summary.sourceDimension
            : fallback.coachPanel.summary.sourceDimension,
        updatedAtMs: now,
      },
      bodyExpression:
        context.scope === 'body_visual'
          ? normalizeCoachDimension(
              'body_expression',
              coachPanel.bodyExpression ?? coachPanel.body_expression,
              fallback.coachPanel.bodyExpression,
              now,
            )
          : fallback.coachPanel.bodyExpression,
      voicePacing:
        context.scope === 'voice_content'
          ? normalizeCoachDimension(
              'voice_pacing',
              coachPanel.voicePacing ?? coachPanel.voice_pacing,
              fallback.coachPanel.voicePacing,
              now,
            )
          : fallback.coachPanel.voicePacing,
      contentExpression:
        context.scope === 'voice_content'
          ? normalizeCoachDimension(
              'content_expression',
              coachPanel.contentExpression ?? coachPanel.content_expression,
              fallback.coachPanel.contentExpression,
              now,
            )
          : fallback.coachPanel.contentExpression,
    },
  };
}

function normalizeCoachDimension(id, candidate, fallback, updatedAtMs) {
  if (!candidate || typeof candidate !== 'object') {
    return {
      ...fallback,
      updatedAtMs,
    };
  }

  return {
    id,
    status: normalizeCoachStatus(candidate.status, fallback.status),
    headline:
      typeof candidate.headline === 'string' && candidate.headline.trim() ? candidate.headline.trim() : fallback.headline,
    detail: typeof candidate.detail === 'string' && candidate.detail.trim() ? candidate.detail.trim() : fallback.detail,
    updatedAtMs,
    source: 'ai',
  };
}

function normalizeCoachStatus(status, fallback) {
  if (status === 'doing_well' || status === 'stable' || status === 'adjust_now' || status === 'analyzing') {
    return status;
  }

  return fallback;
}

function buildFallbackCoachPayload(fullText, hasFrame, scope) {
  const compact = fullText.replace(/\s+/g, '');
  const longEnough = compact.length > 30;
  const now = Date.now();

  if (scope === 'body_visual') {
    return {
      shouldEmit: true,
      insight: hasFrame ? '镜头已接通，继续保持自然打开的上半身和稳定注视。' : '正在等待更稳定的画面，请继续正对镜头。',
      coachPanel: {
        summary: {
          title: hasFrame ? '肢体与表情已接入' : '等待画面输入',
          detail: hasFrame ? '已基于最近画面同步观察你的镜头状态。' : '下一帧到来后会补上肢体反馈。',
          sourceDimension: 'body_expression',
          updatedAtMs: now,
        },
        bodyExpression: {
          id: 'body_expression',
          status: hasFrame ? 'stable' : 'analyzing',
          headline: hasFrame ? '镜头状态基本稳定' : '等待画面信号',
          detail: hasFrame ? '继续保持正视镜头和自然打开的上半身。' : '继续面向镜头，下一帧会补充肢体反馈。',
          updatedAtMs: now,
          source: 'system',
        },
        voicePacing: {
          id: 'voice_pacing',
          status: 'analyzing',
          headline: '等待语音节奏',
          detail: '语音维度会由 voice_content lane 更新。',
          updatedAtMs: now,
          source: 'system',
        },
        contentExpression: {
          id: 'content_expression',
          status: 'analyzing',
          headline: '等待内容表达',
          detail: '内容维度会由 voice_content lane 更新。',
          updatedAtMs: now,
          source: 'system',
        },
      },
    };
  }

  return {
    shouldEmit: longEnough,
    insight: longEnough
      ? '这一轮先稳住语速，把句尾收干净，再把结论往前放。'
      : '继续往下讲，等一句完整落地后我再给更准确的语音与内容反馈。',
    coachPanel: {
      summary: {
        title: longEnough ? '语音与内容已完成一轮判断' : '等待完整一轮语音',
        detail: longEnough ? '已基于最近一轮语音与文本生成 lane A 反馈。' : '先让一句话完整落地，再给出更稳定的语音和内容建议。',
        sourceDimension: longEnough ? 'voice_pacing' : null,
        updatedAtMs: now,
      },
      bodyExpression: {
        id: 'body_expression',
        status: 'analyzing',
        headline: '等待画面反馈',
        detail: '肢体维度会由 body_visual lane 更新。',
        updatedAtMs: now,
        source: 'system',
      },
      voicePacing: {
        id: 'voice_pacing',
        status: longEnough ? 'stable' : 'analyzing',
        headline: longEnough ? '先稳住语速和句尾' : '继续往下讲',
        detail: longEnough ? '下一句把停顿留给重点词，节奏会更干净。' : '等一句完整落地后，我会补上更准确的节奏判断。',
        updatedAtMs: now,
        source: 'system',
      },
      contentExpression: {
        id: 'content_expression',
        status: longEnough ? 'stable' : 'analyzing',
        headline: longEnough ? '主线已经出现了' : '等待内容展开',
        detail: longEnough ? '下一句把结论再提前半句，会更像成熟表达。' : '先把你最想让听众记住的点讲出来。',
        updatedAtMs: now,
        source: 'system',
      },
    },
  };
}

function normalizeLanguage(language) {
  if (language === 'en-US') {
    return 'en';
  }

  return 'zh';
}

function inferAudioFormat(mimeType) {
  if (/wav/i.test(mimeType)) {
    return 'wav';
  }

  if (/mp3|mpeg/i.test(mimeType)) {
    return 'mp3';
  }

  if (/aac/i.test(mimeType)) {
    return 'aac';
  }

  return 'm4a';
}

function extractTextFromOpenAICompatiblePayload(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (item && typeof item.text === 'string') {
          return item.text;
        }

        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

function parseJsonBlock(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new Error('Model returned empty content.');
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const extracted = extractFirstJsonObject(candidate) ?? candidate;

  try {
    return JSON.parse(extracted);
  } catch (error) {
    const repaired = repairLooseJson(extracted);
    try {
      return JSON.parse(repaired);
    } catch {
      throw error;
    }
  }
}

function extractFirstJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function repairLooseJson(text) {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/:\s*"([^"]*?)"([^,}\]]*)(")(?=\s*[,}\]])/g, (_match, prefix, inner, closingQuote) => {
      const safeInner = `${prefix}${inner}`.replace(/"/g, '\\"');
      return `: "${safeInner}${closingQuote === '"' ? '' : closingQuote}"`;
    });
}

function normalizeFinalReport(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('Final report payload is missing.');
  }

  const radar = report.radarScores && typeof report.radarScores === 'object' ? report.radarScores : {};
  const actionableAdvice = Array.isArray(report.actionableAdvice)
    ? report.actionableAdvice.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
    : [];

  while (actionableAdvice.length < 3) {
    actionableAdvice.push(
      [
        '下一轮先把结论前置，再用一个例子补强主线。',
        '把句尾收干净，减少重复起句和中途重启。',
        '保持镜头注视和稳定节奏，让表达更有说服力。',
      ][actionableAdvice.length],
    );
  }

  return {
    totalScore: clampScore(report.totalScore, 60),
    summary:
      typeof report.summary === 'string' && report.summary.trim()
        ? report.summary.trim()
        : '本轮已经形成基本表达主线，继续加强结论前置和节奏稳定度，会更容易打动听众。',
    radarScores: {
      contentStructure: clampScore(radar.contentStructure, 72),
      languageExpression: clampScore(radar.languageExpression, 74),
      fluencyRhythm: clampScore(radar.fluencyRhythm, 70),
      vocalDelivery: clampScore(radar.vocalDelivery, 73),
      nonverbalPresence: clampScore(radar.nonverbalPresence, 71),
      audienceImpact: clampScore(radar.audienceImpact, 75),
    },
    actionableAdvice,
  };
}

function clampScore(value, fallback) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

function toWebRequest(req) {
  const origin = `http://${req.headers.host || '127.0.0.1'}`;
  return new Request(new URL(req.url || '/', origin), {
    method: req.method,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
    duplex: 'half',
  });
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
