'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  LayoutDashboard,
  MessageSquareText,
  Play,
  Send,
  Sparkles,
  Subtitles,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as echarts from "echarts";

import { db } from "@/lib/cloudbase";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RawDoc, VideoRecord } from "@/lib/project-records";
import { normalizeRecords } from "@/lib/project-records";
import { useCloudBaseAuth } from "@/hooks/useCloudBaseAuth";

type TabKey = "ai" | "dashboard";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
};

const TAB_ITEMS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  {
    key: "ai",
    label: "AI 对话",
    icon: MessageSquareText,
  },
  {
    key: "dashboard",
    label: "仪表盘",
    icon: LayoutDashboard,
  },
];

const compactNumberFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  compactDisplay: "short",
});

const integerFormatter = new Intl.NumberFormat("zh-CN");

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed text-[0.92rem]">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 text-[0.92rem] leading-relaxed last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 text-[0.92rem] leading-relaxed last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ className, children }) => {
    const isInline = !className;
    return isInline ? (
      <code className="rounded bg-black/20 px-1 py-0.5 text-[0.85rem]">
        {children}
      </code>
    ) : (
      <code className="block rounded-lg bg-black/80 p-3 text-[0.85rem] text-white">
        {children}
      </code>
    );
  },
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[#f27f0c] underline underline-offset-2"
    >
      {children}
    </a>
  ),
};

const parseDurationToSeconds = (duration: string): number => {
  const sanitized = duration.trim();
  if (!sanitized) {
    return 0;
  }

  const parts = sanitized.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) {
    return 0;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  return 0;
};

const formatSecondsToClock = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "00:00";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const generateMessageId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const PLAY_COUNT_RANGES = [
  { label: "0-1K", min: 0, max: 1000 },
  { label: "1K-5K", min: 1000, max: 5000 },
  { label: "5K-1万", min: 5000, max: 10000 },
  { label: "1万-5万", min: 10000, max: 50000 },
  { label: "5万-10万", min: 50000, max: 100000 },
  { label: "10万-50万", min: 100000, max: 500000 },
  { label: "50万-100万", min: 500000, max: 1000000 },
  { label: "100万+", min: 1000000, max: Infinity },
];

const DURATION_RANGES = [
  { label: "0-1分钟", min: 0, max: 60 },
  { label: "1-3分钟", min: 60, max: 180 },
  { label: "3-5分钟", min: 180, max: 300 },
  { label: "5-10分钟", min: 300, max: 600 },
  { label: "10-30分钟", min: 600, max: 1800 },
  { label: "30分钟+", min: 1800, max: Infinity },
];

const STOP_WORDS = new Set([
  "的", "了", "是", "在", "我", "有", "和", "就", "不", "人", "都", "一", "一个",
  "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好",
  "自己", "这", "那", "什么", "他", "她", "它", "们", "这个", "那个", "为", "与",
  "及", "等", "或", "从", "被", "把", "对", "让", "给", "但", "而", "如", "如果",
  "可以", "可能", "应该", "已经", "还是", "还有", "只是", "就是", "因为", "所以",
  "然后", "但是", "而且", "或者", "虽然", "不过", "之后", "以后", "之前", "以前",
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have",
  "has", "had", "do", "does", "did", "will", "would", "could", "should", "may",
  "might", "must", "shall", "can", "need", "dare", "ought", "used", "to", "of",
  "in", "for", "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "between", "under", "again", "further",
  "then", "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "just", "and", "but", "if", "or",
  "because", "until", "while", "about", "against", "what", "which", "who",
  "this", "that", "these", "those", "am", "it", "its", "his", "her", "their",
  "my", "your", "our", "me", "him", "them", "us", "i", "you", "he", "she", "we",
  "they", "ep", "BV", "bv", "av", "AV", "P", "p", "part", "Part", "PART",
]);

const segmentChineseText = (text: string): string[] => {
  const words: string[] = [];
  const cleanedText = text
    .replace(/[【】\[\]「」『』（）()《》<>""''\"\']/g, " ")
    .replace(/[，。！？、；：·…—\-_|\/\\@#$%^&*+=~`]/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const segments = cleanedText.split(" ").filter(Boolean);

  for (const segment of segments) {
    if (/^[a-zA-Z]+$/.test(segment)) {
      if (segment.length >= 2 && !STOP_WORDS.has(segment.toLowerCase())) {
        words.push(segment.toLowerCase());
      }
    } else {
      for (let len = 4; len >= 2; len--) {
        for (let i = 0; i <= segment.length - len; i++) {
          const word = segment.slice(i, i + len);
          if (!STOP_WORDS.has(word) && /^[\u4e00-\u9fa5]+$/.test(word)) {
            words.push(word);
          }
        }
      }
    }
  }

  return words;
};

const parsePublishTime = (publishTime: string): Date | null => {
  if (!publishTime || publishTime === "未知时间") {
    return null;
  }

  const sanitized = publishTime.trim();
  if (!sanitized) {
    return null;
  }

  // 1. 处理标准日期时间格式（YYYY-MM-DD HH:mm:ss）
  const dateTimeMatch = sanitized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (dateTimeMatch) {
    const [, year, month, day, hours, minutes, seconds] = dateTimeMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds)
    );
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  // 2. 处理纯数字时间戳（10位秒或13位毫秒）
  if (/^\d+$/.test(sanitized)) {
    const timestamp = Number(sanitized);
    // 10位秒级时间戳（1000000000 到 9999999999）
    if (timestamp >= 1000000000 && timestamp <= 9999999999) {
      const date = new Date(timestamp * 1000);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
    // 13位毫秒级时间戳（1000000000000 到 9999999999999）
    if (timestamp >= 1000000000000 && timestamp <= 9999999999999) {
      const date = new Date(timestamp);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // 3. 处理关键词（今天、昨天、前天）
  const keywordMap: Record<string, number> = {
    今天: 0,
    昨天: 1,
    昨日: 1,
    前天: 2,
  };
  for (const [keyword, offset] of Object.entries(keywordMap)) {
    if (sanitized.includes(keyword)) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      date.setHours(0, 0, 0, 0); // 设置为当天0点
      return date;
    }
  }

  // 4. 处理"刚刚"
  if (sanitized === "刚刚") {
    return new Date();
  }

  // 5. 处理标准日期格式（2024-12-24, 2024/12/24, 2024.12.24, 2024年12月24日）
  const dateMatch = sanitized.match(/(\d{4})[-./年](\d{1,2})[-./月](\d{1,2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // 6. 处理相对时间（X小时前、X天前等）
  const relativeMatch = sanitized.match(/(\d+)\s*(小时|天|周|月|年|分钟|分|秒)前/);
  if (relativeMatch) {
    const [, amount, unit] = relativeMatch;
    const now = new Date();
    const value = Number(amount);
    switch (unit) {
      case "小时":
        now.setHours(now.getHours() - value);
        break;
      case "分钟":
      case "分":
        now.setMinutes(now.getMinutes() - value);
        break;
      case "秒":
        now.setSeconds(now.getSeconds() - value);
        break;
      case "天":
        now.setDate(now.getDate() - value);
        break;
      case "周":
        now.setDate(now.getDate() - value * 7);
        break;
      case "月":
        now.setMonth(now.getMonth() - value);
        break;
      case "年":
        now.setFullYear(now.getFullYear() - value);
        break;
    }
    return now;
  }

  // 7. 处理月-日格式（12-24）
  const monthDayMatch = sanitized.match(/^(\d{1,2})[-./](\d{1,2})$/);
  if (monthDayMatch) {
    const [, month, day] = monthDayMatch;
    const now = new Date();
    const date = new Date(now.getFullYear(), Number(month) - 1, Number(day));
    // 如果日期在未来，说明是去年的
    if (date > now) {
      date.setFullYear(now.getFullYear() - 1);
    }
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // 8. 尝试使用 Date 构造函数解析
  const parsedDate = new Date(sanitized);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate;
  }

  // 9. 无法解析，返回 null
  console.warn("无法解析的日期格式:", sanitized);
  return null;
};

type DashboardContentProps = {
  videos: VideoRecord[];
  loading: boolean;
};

function DashboardContent({ videos, loading }: DashboardContentProps) {
  const playCountChartRef = useRef<HTMLDivElement>(null);
  const durationChartRef = useRef<HTMLDivElement>(null);
  const wordCloudChartRef = useRef<HTMLDivElement>(null);
  const scatterChartRef = useRef<HTMLDivElement>(null);

  const playCountChartInstanceRef = useRef<echarts.ECharts | null>(null);
  const durationChartInstanceRef = useRef<echarts.ECharts | null>(null);
  const wordCloudChartInstanceRef = useRef<echarts.ECharts | null>(null);
  const scatterChartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [wordCloudReady, setWordCloudReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadWordCloudExtension = async () => {
      if (typeof window === "undefined") return;
      try {
        await import("echarts-wordcloud");
        if (!cancelled) {
          setWordCloudReady(true);
        }
      } catch (err) {
        console.error("加载 wordCloud 扩展失败", err);
      }
    };

    void loadWordCloudExtension();

    return () => {
      cancelled = true;
    };
  }, []);

  const top20ByPlayCount = useMemo(
    () => [...videos].sort((a, b) => b.playCount - a.playCount).slice(0, 20),
    [videos],
  );

  const top20ByDate = useMemo(() => {
    console.log("=== 最新视频排行调试 ===");
    console.log("总视频数:", videos.length);
    
    const videosWithDate = videos
      .map((video) => {
        const parsedDate = parsePublishTime(video.publishTime);
        if (!parsedDate) {
          console.log("无法解析的日期:", video.publishTime, "标题:", video.title);
        }
        return {
          ...video,
          parsedDate,
          // 添加格式化的显示日期
          displayDate: parsedDate 
            ? `${parsedDate.getMonth() + 1}月${parsedDate.getDate()}日 ${String(parsedDate.getHours()).padStart(2, '0')}:${String(parsedDate.getMinutes()).padStart(2, '0')}`
            : video.publishTime,
        };
      })
      .filter((video) => video.parsedDate !== null);
    
    console.log("成功解析日期的视频数:", videosWithDate.length);
    
    const sorted = videosWithDate.sort((a, b) => b.parsedDate!.getTime() - a.parsedDate!.getTime());
    return sorted.slice(0, 20);
  }, [videos]);

  const playCountDistribution = useMemo(() => {
    const distribution = PLAY_COUNT_RANGES.map((range) => ({
      ...range,
      count: 0,
    }));
    for (const video of videos) {
      for (const range of distribution) {
        if (video.playCount >= range.min && video.playCount < range.max) {
          range.count++;
          break;
        }
      }
    }
    return distribution;
  }, [videos]);

  const durationDistribution = useMemo(() => {
    const distribution = DURATION_RANGES.map((range) => ({
      ...range,
      count: 0,
    }));
    for (const video of videos) {
      const seconds = parseDurationToSeconds(video.duration);
      for (const range of distribution) {
        if (seconds >= range.min && seconds < range.max) {
          range.count++;
          break;
        }
      }
    }
    return distribution;
  }, [videos]);

  const wordCloudData = useMemo(() => {
    const wordFrequency: Record<string, number> = {};
    for (const video of videos) {
      const words = segmentChineseText(video.title);
      for (const word of words) {
        wordFrequency[word] = (wordFrequency[word] ?? 0) + 1;
      }
    }

    return Object.entries(wordFrequency)
      .filter(([, count]) => count >= 2)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 100);
  }, [videos]);

  const scatterChartData = useMemo(() => {
    const dateGroupMap: Record<string, { date: Date; videos: VideoRecord[] }> = {};
    const unparsedDates: string[] = [];
    
    for (const video of videos) {
      const parsedDate = parsePublishTime(video.publishTime);
      if (!parsedDate) {
        unparsedDates.push(video.publishTime);
        continue;
      }
      
      // 使用 YYYY-MM-DD 格式作为 key
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
      const day = String(parsedDate.getDate()).padStart(2, "0");
      const dateKey = `${year}-${month}-${day}`;
      
      if (!dateGroupMap[dateKey]) {
        // 创建当天0点的日期对象
        dateGroupMap[dateKey] = {
          date: new Date(year, parsedDate.getMonth(), parsedDate.getDate()),
          videos: []
        };
      }
      dateGroupMap[dateKey].videos.push(video);
    }

    const sortedEntries = Object.entries(dateGroupMap).sort((a, b) => {
      return a[1].date.getTime() - b[1].date.getTime();
    });

    console.log("=== 散点图日期调试 ===");
    console.log("所有视频数量:", videos.length);
    console.log("成功解析的日期数:", sortedEntries.length);
    console.log("日期范围:", sortedEntries.length > 0 ? {
      最早: sortedEntries[0][0],
      最晚: sortedEntries[sortedEntries.length - 1][0]
    } : "无数据");
    console.log("无法解析的 publishTime 值:", [...new Set(unparsedDates)]);

    const dataPoints: { value: [number, number]; title: string; date: string }[] = [];
    
    sortedEntries.forEach(([dateKey, { date, videos: videosInDate }]) => {
      const timestamp = date.getTime();
      console.log(`日期 ${dateKey} 的时间戳:`, timestamp, "视频数:", videosInDate.length);
      
      videosInDate.forEach((video) => {
        dataPoints.push({
          value: [timestamp, video.playCount],
          title: video.title,
          date: dateKey,
        });
      });
    });

    console.log("散点图数据点数量:", dataPoints.length);
    if (dataPoints.length > 0) {
      console.log("第一个数据点:", dataPoints[0]);
    }

    return {
      dates: sortedEntries.map(([key]) => key),
      data: dataPoints,
    };
  }, [videos]);



  useEffect(() => {
    if (loading || videos.length === 0) return;

    const initChart = (
      ref: React.RefObject<HTMLDivElement | null>,
      instanceRef: React.MutableRefObject<echarts.ECharts | null>,
    ) => {
      if (!ref.current) return null;
      if (instanceRef.current) {
        instanceRef.current.dispose();
      }
      const instance = echarts.init(ref.current);
      instanceRef.current = instance;
      return instance;
    };

    const playCountChart = initChart(playCountChartRef, playCountChartInstanceRef);
    if (playCountChart) {
      playCountChart.setOption({
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
        },
        grid: {
          left: "3%",
          right: "4%",
          bottom: "3%",
          top: "10%",
          containLabel: true,
        },
        xAxis: {
          type: "category",
          data: playCountDistribution.map((item) => item.label),
          axisLabel: {
            color: "#64748b",
            fontSize: 11,
            rotate: 30,
          },
          axisLine: { lineStyle: { color: "#e2e8f0" } },
        },
        yAxis: {
          type: "value",
          axisLabel: { color: "#64748b", fontSize: 11 },
          splitLine: { lineStyle: { color: "#f1f5f9" } },
        },
        series: [
          {
            type: "bar",
            data: playCountDistribution.map((item) => item.count),
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "#f27f0c" },
                { offset: 1, color: "#fbbf24" },
              ]),
              borderRadius: [4, 4, 0, 0],
            },
            barWidth: "60%",
          },
        ],
      });
    }

    const durationChart = initChart(durationChartRef, durationChartInstanceRef);
    if (durationChart) {
      durationChart.setOption({
        tooltip: {
          trigger: "item",
          formatter: "{b}: {c} ({d}%)",
        },
        legend: {
          orient: "vertical",
          right: "5%",
          top: "center",
          textStyle: { color: "#64748b", fontSize: 11 },
        },
        series: [
          {
            type: "pie",
            radius: ["40%", "70%"],
            center: ["35%", "50%"],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 6,
              borderColor: "#fff",
              borderWidth: 2,
            },
            label: {
              show: false,
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 14,
                fontWeight: "bold",
              },
            },
            data: durationDistribution.map((item, index) => ({
              value: item.count,
              name: item.label,
              itemStyle: {
                color: [
                  "#f27f0c",
                  "#fbbf24",
                  "#34d399",
                  "#60a5fa",
                  "#a78bfa",
                  "#f472b6",
                ][index],
              },
            })),
          },
        ],
      });
    }

    let wordCloudChart: echarts.ECharts | null = null;
    if (wordCloudReady) {
      wordCloudChart = initChart(wordCloudChartRef, wordCloudChartInstanceRef);
    }
    if (wordCloudChart && wordCloudData.length > 0) {
      wordCloudChart.setOption({
        tooltip: {
          show: true,
          formatter: (params: { name: string; value: number }) =>
            `${params.name}: ${params.value}次`,
        },
        series: [
          {
            type: "wordCloud",
            shape: "circle",
            left: "center",
            top: "center",
            width: "90%",
            height: "90%",
            sizeRange: [12, 48],
            rotationRange: [-45, 45],
            rotationStep: 45,
            gridSize: 8,
            drawOutOfBound: false,
            textStyle: {
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontWeight: "bold",
              color: () => {
                const colors = [
                  "#f27f0c",
                  "#ea580c",
                  "#fbbf24",
                  "#f59e0b",
                  "#10b981",
                  "#3b82f6",
                  "#8b5cf6",
                  "#ec4899",
                  "#64748b",
                  "#0f172a",
                ];
                return colors[Math.floor(Math.random() * colors.length)];
              },
            },
            emphasis: {
              textStyle: {
                shadowBlur: 10,
                shadowColor: "rgba(0, 0, 0, 0.3)",
              },
            },
            data: wordCloudData,
          },
        ],
      });
    }

    const scatterChart = initChart(scatterChartRef, scatterChartInstanceRef);
    if (scatterChart && scatterChartData.data.length > 0) {
      scatterChart.setOption({
        tooltip: {
          trigger: "item",
          formatter: (params: {
            data: { title: string; date: string; value: [number, number] };
          }) => {
            const { title, date, value } = params.data;
            return `<div style="max-width: 280px; white-space: normal; word-wrap: break-word;">
              <strong>${title}</strong><br/>
              发布日期: ${date}<br/>
              播放量: ${compactNumberFormatter.format(value[1])}
            </div>`;
          },
        },
        grid: {
          left: "3%",
          right: "4%",
          bottom: "18%",
          top: "10%",
          containLabel: true,
        },
        xAxis: {
          type: "time",
          axisLabel: {
            color: "#64748b",
            fontSize: 10,
            rotate: 45,
            interval: 0,
            formatter: (value: number) => {
              const date = new Date(value);
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            },
          },
          axisLine: { lineStyle: { color: "#e2e8f0" } },
          splitLine: { show: false },
        },
        yAxis: {
          type: "value",
          name: "播放量",
          nameTextStyle: { color: "#64748b", fontSize: 11 },
          axisLabel: {
            color: "#64748b",
            fontSize: 11,
            formatter: (value: number) => compactNumberFormatter.format(value),
          },
          splitLine: { lineStyle: { color: "#f1f5f9" } },
        },
        dataZoom: [
          {
            type: "inside",
            start: 0,
            end: 100,
          },
          {
            type: "slider",
            start: 0,
            end: 100,
            height: 20,
            bottom: 5,
          },
        ],
        series: [
          {
            type: "scatter",
            symbolSize: 12,
            data: scatterChartData.data,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "#f27f0c" },
                { offset: 1, color: "#fbbf24" },
              ]),
              shadowBlur: 4,
              shadowColor: "rgba(242, 127, 12, 0.3)",
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowColor: "rgba(242, 127, 12, 0.5)",
              },
            },
          },
        ],
      });
    }



    const handleResize = () => {
      playCountChartInstanceRef.current?.resize();
      durationChartInstanceRef.current?.resize();
      wordCloudChartInstanceRef.current?.resize();
      scatterChartInstanceRef.current?.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      playCountChartInstanceRef.current?.dispose();
      durationChartInstanceRef.current?.dispose();
      wordCloudChartInstanceRef.current?.dispose();
      scatterChartInstanceRef.current?.dispose();
    };
  }, [
    loading,
    videos,
    playCountDistribution,
    durationDistribution,
    wordCloudData,
    scatterChartData,
    wordCloudReady,
  ]);

  if (loading) {
    return (
      <section className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`dashboard-skeleton-${index}`}
              className="h-80 animate-pulse rounded-3xl bg-slate-200"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 overflow-y-auto px-6 py-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0f172a]">播放量排行</h3>
            <span className="text-xs text-[#64748b]">Top 20</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <ul className="space-y-2">
              {top20ByPlayCount.map((video, index) => (
                <li
                  key={`play-${video.key}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-2 transition hover:border-[#f27f0c]/40 hover:bg-slate-50"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-[#64748b]">
                    {index + 1}
                  </span>
                  <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {video.coverUrl ? (
                      <img
                        src={video.coverUrl}
                        alt={video.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-[#94a3b8]">
                        无封面
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-[#0f172a]">
                      {video.title}
                    </p>
                    <div className="mt-1 flex items-center gap-1 text-xs text-[#f27f0c]">
                      <Play className="h-3 w-3" />
                      {compactNumberFormatter.format(video.playCount)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0f172a]">最新视频排行</h3>
            <span className="text-xs text-[#64748b]">Top 20</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <ul className="space-y-2">
              {top20ByDate.map((video, index) => (
                <li
                  key={`date-${video.key}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-2 transition hover:border-[#f27f0c]/40 hover:bg-slate-50"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-[#64748b]">
                    {index + 1}
                  </span>
                  <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {video.coverUrl ? (
                      <img
                        src={video.coverUrl}
                        alt={video.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-[#94a3b8]">
                        无封面
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-[#0f172a]">
                      {video.title}
                    </p>
                    <div className="mt-1 flex items-center gap-1 text-xs text-[#64748b]">
                      <Timer className="h-3 w-3" />
                      {video.displayDate}
                      <Timer className="h-3 w-3" />
                      {video.displayDate}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-[#0f172a]">播放量分布</h3>
          <div ref={playCountChartRef} className="h-[300px] w-full" />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-[#0f172a]">视频时长分布</h3>
          <div ref={durationChartRef} className="h-[300px] w-full" />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-[#0f172a]">标题热词云</h3>
          <div ref={wordCloudChartRef} className="h-[300px] w-full" />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-[#0f172a]">
            发布日期与播放量分布
          </h3>
          <div ref={scatterChartRef} className="h-[300px] w-full" />
        </div>


      </div>
    </section>
  );
}

export default function ProjectPage() {
  const { status } = useCloudBaseAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState<string>("");
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("ai");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: generateMessageId(),
      role: "assistant",
      content:
        "你好，我是智能分析助手，已经加载项目稿件，可以随时分析数据并共创标题。",
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const chatRequestControllerRef = useRef<AbortController | null>(null);

  const handleSendMessage = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isResponding || !projectId) {
      return;
    }

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    const assistantMessage: ChatMessage = {
      id: generateMessageId(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    const history = chatMessages.map(({ role, content }) => ({ role, content }));
    const payload = {
      projectId,
      messages: [...history, { role: "user", content: trimmed }],
    };

    setChatMessages((prev) => [...prev, userMessage, assistantMessage]);
    setChatInput("");
    setIsResponding(true);
    setChatError(null);

    const controller = new AbortController();
    chatRequestControllerRef.current = controller;

    try {
      const response = await fetch("/api/deepseek-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        let errorMessage = "AI 对话服务异常";
        try {
          const errorPayload = await response.clone().json();
          errorMessage = errorPayload.error ?? errorMessage;
        } catch {
          // ignore
        }
        throw new Error(errorMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        const text = decoder.decode(value, { stream: true });
        if (text) {
          setChatMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, content: `${message.content}${text}` }
                : message,
            ),
          );
        }
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "AI 对话失败");
      setChatMessages((prev) =>
        prev.filter((message) => message.id !== assistantMessage.id),
      );
    } finally {
      setIsResponding(false);
      chatRequestControllerRef.current = null;
    }
  }, [chatInput, chatMessages, isResponding, projectId]);

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  useEffect(() => {
    // 开发环境下绕过登录认证检查
    if (process.env.NODE_ENV !== "development" && status === "unauthenticated") {
      router.replace("/login?redirect=/");
    }
  }, [router, status]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    return () => {
      if (chatRequestControllerRef.current) {
        chatRequestControllerRef.current.abort();
      }
    };
  }, []);

  const refreshData = useCallback(async () => {
    if (status !== "authenticated" || !projectId) return;

    setLoading(true);
    setError(null);

    try {
      const doc = await db.collection("bilibili-data").doc(projectId).get();
      if (doc.data && doc.data.length > 0) {
        const projectData = doc.data[0] as RawDoc;
        setProjectName(projectData.name || "未命名项目");
        const normalized = normalizeRecords(projectData);
        setVideos(normalized);
        setLastUpdated(new Date());
      } else {
        setError("项目不存在");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, status]);

  useEffect(() => {
    if (status === "authenticated") {
      void refreshData();
    }
  }, [status, refreshData]);

  if (status === "checking") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0f172a] text-[#fef3c7]">
        <Activity className="mb-4 h-8 w-8 animate-spin" />
        <p className="text-sm tracking-[0.3em] text-[#f7b733]">正在校验 CloudBase 身份</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50/50 text-[#0f172a]">
      <div className="relative border-b border-slate-200 bg-white/95 px-4 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 pr-24">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-lg p-2 text-[#64748b] transition hover:bg-slate-100 hover:text-[#0f172a]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Activity className="h-5 w-5 text-[#f27f0c]" />
          <div>
            <h2 className="text-sm font-semibold text-[#0f172a] md:text-base">{projectName}</h2>
            <p className="text-[11px] text-[#64748b] md:text-xs">
              共 {videos.length ? integerFormatter.format(videos.length) : "--"} 个视频
              {lastUpdated && ` · 更新于 ${timeFormatter.format(lastUpdated)}`}
            </p>
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 space-x-2 whitespace-nowrap">
          {TAB_ITEMS.map((tab) => {
            const isActive = tab.key === activeTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f27f0c] ${isActive ? "border-[#f27f0c] bg-[#fff7ed] text-[#0f172a]" : "border-slate-200 bg-white/30 text-[#475569] hover:border-slate-300"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="text-sm font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-900">
              {error}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {activeTab === "ai" ? (
          <section className="flex flex-1 flex-col gap-6 overflow-hidden px-6 py-6 lg:flex-row">
            <div className="flex flex-3 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">项目稿件</p>
                  <p className="text-xs text-[#64748b]">
                    已加载 {videos.length ? integerFormatter.format(videos.length) : "--"} 条记录
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#64748b]">
                  <Timer className="h-4 w-4 text-[#ea580c]" />
                  {lastUpdated ? `同步于 ${timeFormatter.format(lastUpdated)}` : "等待同步"}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {loading ? (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {Array.from({ length: 15 }).map((_, index) => (
                      <div
                        key={`ai-skeleton-${index}`}
                        className="h-64 animate-pulse rounded-2xl bg-slate-200"
                      />
                    ))}
                  </div>
                ) : videos.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[#64748b]">
                    <Timer className="h-12 w-12 text-[#ea580c]" />
                    <p className="text-base font-medium">暂未检索到任何稿件</p>
                    <p className="text-sm">请稍后再次刷新或检查数据源连接</p>
                  </div>
                ) : (
                  <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {videos.map((video) => (
                      <li
                        key={video.key}
                        className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-[#f27f0c]/60 hover:shadow-lg"
                      >
                        <div className="relative h-36 overflow-hidden">
                          {video.coverUrl ? (
                            <img
                              src={video.coverUrl}
                              alt={video.title}
                              sizes="(max-width: 1024px) 50vw, 16vw"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-[#64748b]">
                              无封面
                            </div>
                          )}
                          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                            <Timer className="h-3 w-3" />
                            {video.duration}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 p-3">
                          {video.videoUrl ? (
                            <a
                              href={video.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="line-clamp-2 text-sm font-semibold leading-snug text-[#0f172a] transition-colors hover:text-[#f27f0c]"
                            >
                              {video.title}
                            </a>
                          ) : (
                            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[#0f172a]">
                              {video.title}
                            </h3>
                          )}
                          <p className="truncate text-xs text-[#64748b]">{video.uploader}</p>

                          <div className="mt-1 flex items-center justify-between text-xs text-[#64748b]">
                            <div className="flex items-center gap-1">
                              <Play className="h-3 w-3 text-[#f27f0c]" />
                              {compactNumberFormatter.format(video.playCount)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Subtitles className="h-3 w-3 text-[#ea580c]" />
                              {compactNumberFormatter.format(video.danmakuCount)}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-1 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff1e6]">
                    <MessageSquareText className="h-5 w-5 text-[#f27f0c]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">AI 对话助手</p>
                    <p className="text-xs text-[#64748b]">DeepSeek · 洞察稿件并共创标题</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-[#0f172a]">
                  <Sparkles className="h-3 w-3 text-[#f27f0c]" />
                  实验功能
                </div>
              </div>

              <div
                ref={chatContainerRef}
                className="flex-1 space-y-3 overflow-y-auto px-5 py-4"
              >
                {chatError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                    {chatError}
                  </div>
                )}
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.role === "user" ? "rounded-br-md bg-[#f27f0c] text-white" : "rounded-bl-md bg-slate-100 text-[#0f172a]"}`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {message.content || ""}
                      </ReactMarkdown>
                      <p className={`mt-1 text-[10px] uppercase tracking-wide ${message.role === "user" ? "text-white/70" : "text-[#64748b]"}`}>
                        {timeFormatter.format(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                {isResponding && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-sm text-[#64748b]">
                      AI 正在思考...
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 p-4">
                <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/60">
                  <textarea
                    rows={3}
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="请输入你想了解的创作方向、投放建议或数据洞察..."
                    className="w-full resize-none rounded-2xl bg-transparent p-3 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus-visible:outline-none"
                  />
                  <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-[#94a3b8]">
                    <span>Shift + Enter 换行</span>
                    <button
                      type="button"
                      onClick={() => {
                        void handleSendMessage();
                      }}
                      disabled={!chatInput.trim().length || isResponding}
                      className="inline-flex items-center gap-1 rounded-full bg-[#f27f0c] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-[#fed7aa] disabled:text-white/80"
                    >
                      <Send className="h-3.5 w-3.5" />
                      发送
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <DashboardContent videos={videos} loading={loading} />
        )}
      </div>
    </div>
  );
}

