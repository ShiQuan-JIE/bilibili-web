import OpenAI from "openai";

import { getServerDb } from "@/lib/cloudbase-server";
import type { RawDoc, VideoRecord } from "@/lib/project-records";
import { normalizeRecords } from "@/lib/project-records";

const MODEL_NAME = "deepseek-chat";
const MAX_VIDEOS_IN_PROMPT = 50;

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const numberFormatter = new Intl.NumberFormat("zh-CN");

type ChatMessagePayload = {
  role: "user" | "assistant";
  content: string;
};

type RequestShape = {
  projectId?: string;
  messages?: ChatMessagePayload[];
};

const buildVideoDigest = (videos: VideoRecord[]): string => {
  if (!videos.length) {
    return "当前项目没有任何稿件，提醒用户先同步最新的数据。";
  }

  const limitedVideos = videos.slice(0, MAX_VIDEOS_IN_PROMPT);
  const lines = limitedVideos.map((video, index) => {
    const parts = [
      `序号: ${index + 1}`,
      `标题: ${video.title}`,
      `作者: ${video.uploader}`,
      `播放: ${numberFormatter.format(video.playCount)}`,
      `弹幕: ${numberFormatter.format(video.danmakuCount)}`,
      `时长: ${video.duration}`,
      `发布时间: ${video.publishTime}`,
    ];
    if (video.videoUrl) {
      parts.push(`链接: ${video.videoUrl}`);
    }
    return parts.join(" · ");
  });

  if (videos.length > limitedVideos.length) {
    lines.push(`……其余 ${videos.length - limitedVideos.length} 条稿件已省略。`);
  }

  return lines.join("\n");
};

const buildSystemPrompt = (params: {
  projectId: string;
  projectName: string;
  videos: VideoRecord[];
}) => {
  const { videos, projectId, projectName } = params;
  const totalPlay = videos.reduce((sum, video) => sum + video.playCount, 0);
  const totalDanmaku = videos.reduce(
    (sum, video) => sum + video.danmakuCount,
    0,
  );
  const summaryLines = [
    `项目 ID: ${projectId}`,
    `项目名称: ${projectName || "未命名项目"}`,
    `稿件数量: ${videos.length}`,
    `播放总量: ${numberFormatter.format(totalPlay)}`,
    `弹幕总量: ${numberFormatter.format(totalDanmaku)}`,
  ];

  return [
    "你是一名资深的 Bilibili 数据分析与热点标题共创顾问，具备内容策划、热点捕捉与 A/B 标题调优经验。",
    "请参考以下项目数据，结合用户的提问或需求，在回答中做到：",
    "1) 先给出清晰的洞察或建议，引用具体稿件或数据作为依据。",
    "2) 如果用户希望创作标题，请一次给出 3-5 个不同方向的候选标题，并在后面附上灵感来源或预期人群。",
    "3) 如果数据不足以回答，请明确指出并提示需要同步更多稿件。",
    "",
    "【项目概览】",
    summaryLines.join(" | "),
    "",
    "【稿件明细（省略封面等非必要字段）】",
    buildVideoDigest(videos),
  ].join("\n");
};

const fetchProjectVideos = async (projectId: string): Promise<{
  projectName: string;
  videos: VideoRecord[];
}> => {
  const db = getServerDb();
  const snapshot = await db.collection("bilibili-data").doc(projectId).get();

  const doc = snapshot.data?.[0] as RawDoc | undefined;
  if (!doc) {
    // 当没有数据时，返回空的视频列表而不是抛出错误
    return {
      projectName: "未命名项目",
      videos: [],
    };
  }

  const videos = normalizeRecords(doc);
  return {
    projectName: doc.name ?? "未命名项目",
    videos,
  };
};

// 添加CORS头部
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response(
      JSON.stringify({ error: "未配置 DEEPSEEK_API_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const { projectId, messages }: RequestShape = await request.json();

  if (!projectId || typeof projectId !== "string") {
    return new Response(
      JSON.stringify({ error: "projectId 必填" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages 不能为空" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const sanitizedMessages: ChatMessagePayload[] = messages
    .filter(
      (message): message is ChatMessagePayload =>
        typeof message?.content === "string" &&
        (message.role === "user" || message.role === "assistant"),
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0);

  if (!sanitizedMessages.length) {
    return new Response(
      JSON.stringify({ error: "messages 内容无效" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  try {
    const { projectName, videos } = await fetchProjectVideos(projectId);
    const systemPrompt = buildSystemPrompt({ projectId, projectName, videos });
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemPrompt },
        ...sanitizedMessages,
      ],
      temperature: 0.2,
      stream: true,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("[deepseek-chat] error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "服务异常",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
}

