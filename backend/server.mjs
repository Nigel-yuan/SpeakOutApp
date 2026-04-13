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
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');

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
          deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
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

      if (!process.env.DASHSCOPE_API_KEY) {
        sendJson(res, 500, { error: 'Missing DASHSCOPE_API_KEY in .env.' });
        return;
      }

      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      const dataUrl = `data:${mimeType};base64,${audioBuffer.toString('base64')}`;

      const response = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'qwen3-asr-flash',
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
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        sendJson(res, response.status, {
          error: payload?.error?.message || payload?.message || 'DashScope ASR request failed.',
        });
        return;
      }

      sendJson(res, 200, {
        text: extractTextFromOpenAICompatiblePayload(payload),
        raw: payload,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/coach') {
      const body = await toWebRequest(req).json();
      const text = String(body?.text || '');
      const language = String(body?.language || 'zh-CN');
      const sceneTitle = String(body?.sceneTitle || '演讲训练');

      if (!text.trim()) {
        sendJson(res, 400, { error: 'text is required.' });
        return;
      }

      if (!process.env.DEEPSEEK_API_KEY) {
        sendJson(res, 500, { error: 'Missing DEEPSEEK_API_KEY in .env.' });
        return;
      }

      const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
          temperature: 0.7,
          stream: false,
          messages: [
            {
              role: 'system',
              content:
                '你是一位实时演讲教练。请只返回一句中文建议，要求具体、温和、可立即执行，不要分点。',
            },
            {
              role: 'user',
              content: `场景：${sceneTitle}\n语言：${language}\n最新演讲文本：\n${text}`,
            },
          ],
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        sendJson(res, response.status, {
          error: payload?.error?.message || payload?.message || 'DeepSeek request failed.',
        });
        return;
      }

      sendJson(res, 200, {
        insight: extractTextFromOpenAICompatiblePayload(payload),
        raw: payload,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/final-report') {
      const body = await toWebRequest(req).json();
      const transcript = String(body?.transcript || '');
      const language = String(body?.language || 'zh-CN');
      const sceneTitle = String(body?.sceneTitle || '演讲训练');

      if (!transcript.trim()) {
        sendJson(res, 400, { error: 'transcript is required.' });
        return;
      }

      if (!process.env.DEEPSEEK_API_KEY) {
        sendJson(res, 500, { error: 'Missing DEEPSEEK_API_KEY in .env.' });
        return;
      }

      const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
          temperature: 0.3,
          stream: false,
          messages: [
            {
              role: 'system',
              content:
                '你是一位专业演讲评委。你必须严格输出 JSON，不要输出 markdown、解释、前后缀文本。JSON 结构为 {"totalScore":number,"summary":string,"radarScores":{"pronunciation":number,"fluency":number,"contentStructure":number,"expressiveness":number,"emotionalResonance":number},"actionableAdvice":[string,string,string]}。所有分数必须是 0 到 100 的整数，actionableAdvice 必须正好 3 条。',
            },
            {
              role: 'user',
              content: `请分析以下真实演讲逐字稿，并严格按指定 JSON 返回。\n场景：${sceneTitle}\n语言：${language}\n逐字稿：\n${transcript}`,
            },
          ],
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        sendJson(res, response.status, {
          error: payload?.error?.message || payload?.message || 'DeepSeek final report request failed.',
        });
        return;
      }

      const rawText = extractTextFromOpenAICompatiblePayload(payload);
      const report = parseJsonBlock(rawText);

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

function toWebRequest(req) {
  return new Request(`http://${req.headers.host || '127.0.0.1'}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: req,
    duplex: 'half',
  });
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function normalizeLanguage(language) {
  if (language.startsWith('zh')) {
    return 'zh';
  }

  if (language.startsWith('en')) {
    return 'en';
  }

  return 'auto';
}

function inferAudioFormat(mimeType) {
  if (mimeType.includes('wav')) {
    return 'wav';
  }

  if (mimeType.includes('mp3')) {
    return 'mp3';
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

        if (item?.text) {
          return item.text;
        }

        if (item?.type === 'output_text' && item?.text) {
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
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  return JSON.parse(candidate);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
