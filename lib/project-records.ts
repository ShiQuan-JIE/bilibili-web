export type RawDoc = {
  _id: string;
  name?: string;
  data?: unknown;
  createTime?: string;
};

export type VideoRecord = {
  key: string;
  title: string;
  uploader: string;
  playCount: number;
  duration: string;
  publishTime: string;
  danmakuCount: number;
  coverUrl: string | null;
  videoUrl: string | null;
};

const CLOUD_STORAGE_DOMAIN =
  process.env.NEXT_PUBLIC_CLOUD_STORAGE_DOMAIN || "https://636c-cloud1-3gy44slx114f4c73-1258339218.tcb.qcloud.la";
const COVER_BASE_URL = `${CLOUD_STORAGE_DOMAIN}/covers/`;

const castToRecordArray = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    );
  }

  if (typeof payload === "object" && payload !== null) {
    return Object.values(payload as Record<string, unknown>).filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    );
  }

  return [];
};

const pickString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
};

const pickNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const padTwoDigits = (value: number): string => String(value).padStart(2, "0");

const formatDateTime = (date: Date): string => {
  const year = date.getFullYear();
  const month = padTwoDigits(date.getMonth() + 1);
  const day = padTwoDigits(date.getDate());
  const hours = padTwoDigits(date.getHours());
  const minutes = padTwoDigits(date.getMinutes());
  const seconds = padTwoDigits(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const coerceToDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // 处理秒级时间戳（10位）和毫秒级时间戳（13位）
    const timestamp = value > 1e12 ? value : value * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    // 处理字符串形式的时间戳
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        // 10位秒级或13位毫秒级
        const timestamp = numeric > 1e12 ? numeric : numeric * 1000;
        const date = new Date(timestamp);
        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

const resolvePublishTime = (item: Record<string, unknown>): string => {
  const timestampSources = [
    item.publishTime,        // 添加 publishTime 作为时间戳源
    item.publishTimestamp,
    item.publishTimeMs,
    item.publish_time,
    item.pubdate,
    item.pub_time,
    item.pubDate,
    item.ctime,
    item.createTime,
    item.created_at,
    item.createdAt,
  ];

  for (const source of timestampSources) {
    const date = coerceToDate(source);
    if (date) {
      return formatDateTime(date);
    }
  }

  return (
    pickString(
      item.publishTimeFormatted,
      item.publishTimeRaw,
      item.pubdateText,
      item.pub_time_text,
      item.time,
    ) ?? "未知时间"
  );
};
export function normalizeRecords(doc: RawDoc): VideoRecord[] {
  const segments = castToRecordArray(doc.data);

  const flattened = segments.map((item, index) => {
    const keyCandidate = pickString(item.id, item.bvid, `${doc._id}-${index}`) ??
      `${doc._id}-${index}`;

    // 处理封面 URL
    const coverValue = pickString(item.cover);
    let coverUrl: string | null = null;
    if (coverValue) {
      // 如果以 // 开头（协议相对 URL），添加 https:
      if (coverValue.startsWith('//')) {
        coverUrl = `https:${coverValue}`;
      }
      // 如果已经是完整的 URL（以 http:// 或 https:// 开头），直接使用
      else if (coverValue.startsWith('http://') || coverValue.startsWith('https://')) {
        coverUrl = coverValue;
      }
      // 否则拼接 COVER_BASE_URL
      else {
        coverUrl = `${COVER_BASE_URL}${coverValue}`;
      }
    }

    return {
      key: keyCandidate,
      title: pickString(item.title, "未命名稿件") ?? "未命名稿件",
      uploader: pickString(item.uploader, item.author, item.up, "未知投稿者") ?? "未知投稿者",
      playCount: pickNumber(item.playCount ?? item.play_count ?? item.view),
      duration: pickString(item.duration, item.length, "00:00") ?? "00:00",
      publishTime: resolvePublishTime(item),
      danmakuCount: pickNumber(
        item.danmakuCount ?? item.danmaku_count ?? item.danmuCount ?? item.reply,
      ),
      coverUrl,
      videoUrl: pickString(item.videourl, item.videoUrl, item.url),
    } satisfies VideoRecord;
  });

  return flattened.sort((a, b) => b.playCount - a.playCount);
}
