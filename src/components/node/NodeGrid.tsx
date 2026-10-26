import { ServerGlobe } from "./ServerGlobe";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Check,
  CircleDollarSign,
  Cpu,
  HardDrive,
  Layers,
  Network,
  Pencil,
  Server,
  Sparkles,
  Timer,
  X,
} from "lucide-react";
import { StatMetricIcon } from "../ui/StatMetricIcon";
import { DraggableCostBall } from "@/components/node/DraggableCostBall";
import { useAuth } from "@/hooks/useAuth";
import { getLocalThemeSettings, saveLocalThemeSettings } from "@/services/themeSettingsStore";
import {
  useAllNodeMeta,
  useHomeNodeSummaries,
  useNodeOnlineSummaries,
  useNodeStoreStatus,
} from "@/hooks/useNode";
import { useHomepagePingOverview } from "@/hooks/usePingOverview";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { useViewMode } from "@/hooks/useViewMode";
import { usePriceVisibility } from "@/hooks/usePriceVisibility";
import { getNodeMetricsSnapshot, type HomeNodeSummary } from "@/services/wsStore";
import { formatBytes } from "@/utils/format";
import { calculateCostSummary, getExchangeRates } from "@/utils/cost";
import { useHiddenNodeUuids } from "@/hooks/useVisibleNodes";
import {
  getHomeGroupLabel,
  getHomeGroupOptions,
  getHomeRegionOptions,
  HOME_ALL_GROUP,
  HOME_ALL_REGION,
  mergeHomeRegionOrder,
  sortHomeGroupOptions,
} from "@/utils/homeNodes";
import { getDisplayRegionCode } from "@/utils/geo";
import { useHomeSort } from "@/hooks/useHomeSort";
import { useHomeNodeOrder } from "@/hooks/useHomeNodeOrder";
import { useHourlyClock } from "@/hooks/useClock";
import { useSlidingIndicator } from "@/hooks/useSlidingIndicator";
import { clsx } from "clsx";
import { preloadAssetsPage } from "@/services/assetsPageLoader";
import { HomeSortControl } from "./HomeSortControl";
import {
  getOverviewRating,
  type OverviewRating,
} from "@/utils/overviewRating";
import { CompactNodeCard } from "./CompactNodeCard";
import { MiniNodeCard } from "./MiniNodeCard";
import { NodeCard } from "./NodeCard";
import { NodeListView } from "./NodeListView";
import { RegionTabs } from "./RegionTabs";
import { RenewalReminder } from "./RenewalReminder";
import type { NodeViewMode, ClusterOverviewMode, MatrixColorTheme, MatrixBootEffect } from "@/utils/themeSettings";
import { getRenewalReminders, type RenewalReminderSource } from "@/utils/renewalReminder";
import { DiaTextReveal } from "@/components/ui/DiaTextReveal";
import { t, useLang } from "@/i18n";

// 卡片视图网格密度；列表档由独立组件布局。
const GRID_LAYOUT: Record<NodeViewMode, { className: string; minColumnWidth: number }> = {
  large: { className: "grid gap-4 xl:gap-5", minColumnWidth: 360 },
  compact: { className: "grid gap-3 xl:gap-4", minColumnWidth: 340 },
  mini: { className: "grid gap-3 xl:gap-3.5", minColumnWidth: 260 },
  // 占位以满足 Record 穷尽。
  list: { className: "", minColumnWidth: 0 },
};

type MiniGridStyle = CSSProperties & { "--mini-card-min-width": string };

// 标准 UUID 不含逗号，可安全拼成稳定签名。
const UUID_KEY_SEPARATOR = ",";
const EMPTY_REGION_ORDER: string[] = [];

type IdleCapableWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

interface HomeOverview {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  trafficUp: number;
  trafficDown: number;
  netUp: number;
  netDown: number;
  avgCpu: number;
  totalRamUsed: number;
  totalRamTotal: number;
  ramPct: number;
  totalDiskUsed: number;
  totalDiskTotal: number;
  diskPct: number;
  totalTcpConn: number;
  totalUdpConn: number;
  maxUptimeSeconds: number;
  recentRebootNode: { name: string; seconds: number } | null;
}

function formatRebootAgo(seconds: number): { value: string; unit: string; fullText: string } {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return { value: "—", unit: "", fullText: "—" };
  }
  if (seconds < 60) {
    return { value: t("刚刚"), unit: "", fullText: t("刚刚") };
  }
  const days = Math.floor(seconds / 86400);
  if (days >= 1) {
    return { value: String(days), unit: t("天前"), fullText: t("{n}天前", { n: days }) };
  }
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) {
    return { value: String(hours), unit: t("小时前"), fullText: t("{n}小时前", { n: hours }) };
  }
  const minutes = Math.max(1, Math.floor(seconds / 60));
  return { value: String(minutes), unit: t("分钟前"), fullText: t("{n}分钟前", { n: minutes }) };
}

function HomeBrand({ siteName }: { siteName: string }) {
  return (
    <header className="home-brand sr-only" aria-label={t("站点名称")}>
      <h1 className="home-brand-title" title={siteName}>
        {siteName}
      </h1>
    </header>
  );
}

function getTimeGreetingInfo(
  totalNodes: number,
  onlineNodes: number,
  offlineNodes: number,
  renewalCount: number,
): { greeting: string; subtitle: string } {
  const hour = new Date().getHours();
  let greeting = t("早上好");
  if (hour >= 0 && hour < 5) greeting = t("夜深了");
  else if (hour >= 5 && hour < 11) greeting = t("早上好");
  else if (hour >= 11 && hour < 13) greeting = t("中午好");
  else if (hour >= 13 && hour < 18) greeting = t("下午好");
  else greeting = t("晚上好");

  // 1. 存在离线异常时，精准贴合实际情况告警提示
  if (totalNodes > 0 && offlineNodes > 0) {
    if (onlineNodes === 0) {
      return {
        greeting,
        subtitle: t("您的服务器已全部离线，请及时排查网络与连接状态。"),
      };
    }
    return {
      greeting,
      subtitle: t("检测到 {n} 台服务器处于离线状态，请及时排查处理。", { n: offlineNodes }),
    };
  }

  // 2. 暂未连接服务器
  if (totalNodes === 0) {
    return {
      greeting,
      subtitle: t("暂未检测到在线服务器，等待节点客户端数据上报。"),
    };
  }

  // 3. 临期提醒（无离线节点但有临近到期节点）
  if (renewalCount > 0) {
    return {
      greeting,
      subtitle: t("当前有 {n} 台服务器临近到期，请留意续费维护。", { n: renewalCount }),
    };
  }

  // 4. 全员在线健康：按时段给出贴切且长度均衡的生产/工作问候
  if (hour >= 0 && hour < 5) {
    return {
      greeting,
      subtitle: t("夜间全站服务器运行平稳，各项指标持续实时监控中。"),
    };
  }
  if (hour >= 5 && hour < 11) {
    return {
      greeting,
      subtitle: t("全站服务器运行健康，系统资源与网络指标持续监控中。"),
    };
  }
  if (hour >= 11 && hour < 13) {
    return {
      greeting,
      subtitle: t("当前所有服务器运行平稳，系统负载与核心指标持续采集中。"),
    };
  }
  if (hour >= 13 && hour < 18) {
    return {
      greeting,
      subtitle: t("所有服务器运行稳定，系统负载与网络吞吐持续监控中。"),
    };
  }
  return {
    greeting,
    subtitle: t("全站服务器运行良好，网络状态与系统负载数据持续采集中。"),
  };
}

interface OverviewMetricCards {
  connections: boolean;
  cpu: boolean;
  ram: boolean;
  disk: boolean;
  uptime: boolean;
}

function HomeOverviewCards({
  overview,
  costSummary,
  costLoading,
  showOverviewRatings,
  showBandwidthRating,
  bandwidthRatingLabels,
  showAssetRating,
  assetRatingLabels,
  showDetailButton,
  showAssetCard,
  metricCards,
  renewalReminderDays,
  renewalNodes,
  dense,
  username,
  loggedIn,
  visibleNodes,
  nameByUuid,
  clusterOverviewMode: _clusterOverviewMode = "classic",
  matrixColorTheme = "default",
  matrixMockFill: _matrixMockFill = false,
  matrixBootAnimation: _matrixBootAnimation = true,
  matrixBootEffect: _matrixBootEffect = "laser-scan",
  matrixCustomPattern: _matrixCustomPattern = null,
}: {
  overview: HomeOverview;
  costSummary: { remainingCny: number; totalOriginalPriceCny?: number } | null;
  costLoading: boolean;
  dense: boolean;
  showOverviewRatings: boolean;
  showBandwidthRating: boolean;
  bandwidthRatingLabels: string;
  showAssetRating: boolean;
  assetRatingLabels: string;
  showDetailButton: boolean;
  showAssetCard: boolean;
  /** 资产总值以外五张指标卡各自显示与否（设置页「首页 → 总览 → 指标卡」）。 */
  metricCards: OverviewMetricCards;
  renewalReminderDays: number;
  renewalNodes: RenewalReminderSource[];
  username: string;
  loggedIn: boolean;
  visibleNodes: HomeNodeSummary[];
  nameByUuid: Map<string, string>;
  clusterOverviewMode?: ClusterOverviewMode;
  matrixColorTheme?: MatrixColorTheme;
  matrixMockFill?: boolean;
  matrixBootAnimation?: boolean;
  matrixBootEffect?: MatrixBootEffect;
  matrixCustomPattern?: number[] | null;
}) {
  const queryClient = useQueryClient();
  const [renewalPopoverOpen, setRenewalPopoverOpen] = useState(false);
  const statCardCount =
    Object.values(metricCards).filter(Boolean).length + (showAssetCard ? 1 : 0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const handleStartEdit = () => {
    if (!loggedIn) return;
    setTempName(username === "Admin" ? "" : username);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    const finalName = tempName.trim().slice(0, 40);
    if (finalName) {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("cfsm_admin_username", finalName);
      }
      saveLocalThemeSettings({ ...getLocalThemeSettings(), adminNickname: finalName });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    }
    setIsEditingName(false);
  };

  const totalConnections = overview.totalTcpConn + overview.totalUdpConn;
  const [ramUsedValue, ramUsedUnit] = formatBytes(overview.totalRamUsed).split(" ");
  const [diskUsedValue, diskUsedUnit] = formatBytes(overview.totalDiskUsed).split(" ");
  const recentReboot = overview.recentRebootNode
    ? {
        name: overview.recentRebootNode.name,
        ...formatRebootAgo(overview.recentRebootNode.seconds),
      }
    : null;

  const onlinePct =
    overview.totalNodes > 0 ? (overview.onlineNodes / overview.totalNodes) * 100 : 0;
  const { isPriceVisible } = usePriceVisibility();
  const renderAssetValue = () => {
    if (!isPriceVisible) return t("保密");
    if (!costSummary) return costLoading ? t("计算中") : "—";
    const totalOriginal = costSummary.totalOriginalPriceCny ?? 0;
    if (totalOriginal > 0 || costSummary.remainingCny > 0) {
      return (
        <>
          <span>¥{Math.round(costSummary.remainingCny).toLocaleString("zh-CN")}</span>
          <em className="mao-stat-slash-total"> / ¥{Math.round(totalOriginal).toLocaleString("zh-CN")}</em>
        </>
      );
    }
    return "—";
  };

  const bandwidthRating =
    showOverviewRatings && showBandwidthRating
      ? getOverviewRating({
        kind: "bandwidth",
        value: overview.netUp + overview.netDown,
        customLabels: bandwidthRatingLabels,
      })
      : null;

  const assetRating =
    isPriceVisible && showOverviewRatings && showAssetRating && costSummary
      ? getOverviewRating({
        kind: "asset",
        value: costSummary.remainingCny,
        customLabels: assetRatingLabels,
      })
      : null;

  const renderRating = (rating: OverviewRating | null) =>
    rating ? (
      <span className="overview-card-rating" data-rating-level={rating.level} title={t(rating.label)}>
        {t(rating.label)}
      </span>
    ) : null;

  const isAllHealthy = overview.offlineNodes === 0 && overview.totalNodes > 0;
  const renewalReminders = getRenewalReminders(renewalNodes, Date.now(), {
    requireOnlineForExpired: true,
  });
  const renewalCount = renewalReminders.length;
  const greetingInfo = getTimeGreetingInfo(
    overview.totalNodes,
    overview.onlineNodes,
    overview.offlineNodes,
    renewalCount,
  );

  return (
    <section
      className={`mao-dashboard-hero home-overview${dense ? " is-dense" : ""}`}
      aria-label={t("首页总览")}
      data-stat-cards={statCardCount}
      data-palette={matrixColorTheme || "default"}
    >
      {/* 左侧主要区域：问候语 + 6 宫格指标小卡片 */}
      <div className="mao-hero-main">
        <div className="mao-hero-header">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div className="flex items-center gap-2">
              <div className="mao-badge">
                <Sparkles size={12} className="text-(--text-primary)" />
                <span>{t("监控总览")}</span>
              </div>
              <span className={`mao-status-pill ${isAllHealthy ? "is-healthy" : "is-warning"}`}>
                <span className="mao-status-dot" />
                {isAllHealthy ? t("状态健康") : overview.totalNodes === 0 ? t("未连接") : t("存在离线 ({n})", { n: overview.offlineNodes })}
              </span>
              {bandwidthRating && (
                <span
                  className="overview-card-rating is-bandwidth-badge"
                  data-rating-level={bandwidthRating.level}
                  title={t("全站实时带宽评级: {label}", { label: t(bandwidthRating.label) })}
                >
                  <span className="mao-status-dot" />
                  {t(bandwidthRating.label)}
                </span>
              )}
            </div>

            <div className="mao-cluster-mini-summary flex items-center gap-3 text-xs text-(--text-secondary) flex-wrap">
              <div className="flex items-center gap-1.5">
                <Activity size={13} className="text-(--text-primary)" />
                <span className="font-bold text-sm text-(--text-primary)">{onlinePct.toFixed(0)}%</span>
                <span>{t("在线率")}</span>
              </div>
              <div className="mao-node-blocks is-compact" role="presentation">
                {overview.totalNodes > 0 ? (
                  Array.from({ length: overview.totalNodes }, (_, i) => {
                    const isOnline = i < overview.onlineNodes;
                    const isOffline = i >= overview.totalNodes - overview.offlineNodes;
                    const statusClass = isOnline
                      ? "is-online"
                      : isOffline
                        ? "is-offline"
                        : "is-unknown";
                    return (
                      <span
                        key={i}
                        className={`mao-node-block ${statusClass}`}
                        title={t("服务器 {n}: {status}", { n: i + 1, status: isOnline ? t("在线") : isOffline ? t("离线") : t("未知") })}
                      />
                    );
                  })
                ) : (
                  <span className="mao-node-block is-unknown" />
                )}
              </div>
              <span className="text-[11px] text-(--text-tertiary)">
                {overview.onlineNodes}/{overview.totalNodes} {t("在线")}
              </span>
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-black/10 dark:border-white/10 text-[11px]">
                <span className="text-(--speed-up, #38bdf8)">↑ {formatBytes(overview.netUp)}/s</span>
                <span className="text-(--speed-down, #34d399)">↓ {formatBytes(overview.netDown)}/s</span>
              </div>
            </div>
          </div>
          <h1 className="mao-hero-greeting flex items-center gap-1.5 flex-wrap">
            <span>{greetingInfo.greeting}{t("，")}</span>
            {isEditingName ? (
              <span className="inline-flex items-center gap-1">
                <input
                  type="text"
                  autoFocus
                  maxLength={40}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") setIsEditingName(false);
                  }}
                  placeholder={t("输入昵称 (如 jerry)")}
                  className="px-2 py-0.5 text-base rounded bg-(--input-bg,rgba(0,0,0,0.3)) border border-(--accent) text-(--text-primary) focus:outline-none w-36"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="p-1 rounded bg-(--accent) text-white font-medium hover:opacity-90 transition-opacity"
                  title={t("保存")}
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="p-1 rounded bg-white/10 text-(--text-muted) hover:text-(--text-primary) transition-colors"
                  title={t("取消")}
                >
                  <X size={14} />
                </button>
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1.5 group ${loggedIn ? "cursor-pointer" : ""}`}
                onClick={loggedIn ? handleStartEdit : undefined}
                title={loggedIn ? t("点击快速修改管理员昵称") : undefined}
              >
                <DiaTextReveal text={username || "Guest"} />
                {loggedIn && (
                  <Pencil
                    size={13}
                    className="text-(--text-muted) opacity-0 group-hover:opacity-80 hover:text-(--accent) transition-all"
                  />
                )}
              </span>
            )}
          </h1>
          <p className="mao-hero-subtitle">
            {greetingInfo.subtitle}
          </p>
        </div>

        {/* 指标卡片（最多 6 张，可在设置里逐张关掉）：data-cards 是实际张数，CSS 按张数排版，避免留空格 */}
        {statCardCount > 0 && (
        <div className="mao-stat-grid" data-cards={statCardCount}>
          {/* 1. 活跃连接 (全站活跃连接数) */}
          {metricCards.connections && (
          <div className="mao-stat-card" data-metric="connections">
            <div className="mao-stat-head">
              <div className="mao-stat-title-wrap">
                <StatMetricIcon metric="connections" icon={Network} />
                <span className="mao-stat-label">{t("活跃连接")}</span>
              </div>
            </div>
            <div className="mao-stat-value">
              {totalConnections.toLocaleString()} <span className="mao-stat-unit">Conn</span>
            </div>
            <div className="mao-stat-footer">
              <span className="mao-stat-caption" title={t("TCP 连接: {tcp} · UDP 连接: {udp}", { tcp: overview.totalTcpConn.toLocaleString(), udp: overview.totalUdpConn.toLocaleString() })}>
                TCP {overview.totalTcpConn.toLocaleString()} · UDP {overview.totalUdpConn.toLocaleString()}
              </span>
            </div>
          </div>

          )}

          {/* 2. 平均 CPU */}
          {metricCards.cpu && (
          <div className="mao-stat-card" data-metric="cpu">
            <div className="mao-stat-head">
              <div className="mao-stat-title-wrap">
                <StatMetricIcon metric="cpu" icon={Cpu} />
                <span className="mao-stat-label">{t("平均 CPU")}</span>
              </div>
            </div>
            <div className="mao-stat-value">
              {overview.avgCpu.toFixed(1)} <span className="mao-stat-unit">%</span>
            </div>
            <div className="mao-stat-footer">
              <span className="mao-stat-caption">
                {overview.onlineNodes > 0 ? t("{n} 台在线服务器", { n: overview.onlineNodes }) : t("暂无在线服务器")}
              </span>
            </div>
          </div>

          )}

          {/* 3. 内存用量 */}
          {metricCards.ram && (
          <div className="mao-stat-card" data-metric="ram">
            <div className="mao-stat-head">
              <div className="mao-stat-title-wrap">
                <StatMetricIcon metric="ram" icon={Layers} />
                <span className="mao-stat-label">{t("内存用量")}</span>
              </div>
            </div>
            <div className="mao-stat-value">
              {ramUsedValue} <span className="mao-stat-unit">{ramUsedUnit}</span>
            </div>
            <div className="mao-stat-footer">
              <span className="mao-stat-caption" title={t("已用: {used} / 总量: {total}", { used: formatBytes(overview.totalRamUsed), total: formatBytes(overview.totalRamTotal) })}>
                {t("共 {total}", { total: formatBytes(overview.totalRamTotal) })} · {overview.ramPct.toFixed(1)}%
              </span>
            </div>
          </div>

          )}

          {/* 4. 硬盘用量 */}
          {metricCards.disk && (
          <div className="mao-stat-card" data-metric="disk">
            <div className="mao-stat-head">
              <div className="mao-stat-title-wrap">
                <StatMetricIcon metric="disk" icon={HardDrive} />
                <span className="mao-stat-label">{t("硬盘用量")}</span>
              </div>
            </div>
            <div className="mao-stat-value">
              {diskUsedValue} <span className="mao-stat-unit">{diskUsedUnit}</span>
            </div>
            <div className="mao-stat-footer">
              <span className="mao-stat-caption" title={t("已用: {used} / 总量: {total}", { used: formatBytes(overview.totalDiskUsed), total: formatBytes(overview.totalDiskTotal) })}>
                {t("共 {total}", { total: formatBytes(overview.totalDiskTotal) })} · {overview.diskPct.toFixed(1)}%
              </span>
            </div>
          </div>

          )}

          {/* 5. 最近重启 (全网最近重启时长 & 节点名称) */}
          {metricCards.uptime && (
          <div className="mao-stat-card" data-metric="uptime">
            <div className="mao-stat-head">
              <div className="mao-stat-title-wrap">
                <StatMetricIcon metric="uptime" icon={Timer} />
                <span className="mao-stat-label">{t("最近重启")}</span>
              </div>
            </div>
            <div className="mao-stat-value">
              {recentReboot ? (
                <>
                  {recentReboot.value}{" "}
                  {recentReboot.unit && (
                    <span className="mao-stat-unit">{recentReboot.unit}</span>
                  )}
                </>
              ) : (
                "—"
              )}
            </div>
            <div className="mao-stat-footer">
              <span
                className="mao-stat-caption truncate"
                title={
                  recentReboot
                    ? t("最近重启设备: {name} · {ago}", { name: recentReboot.name, ago: recentReboot.fullText })
                    : t("暂无在线设备")
                }
              >
                {recentReboot ? recentReboot.name : t("暂无在线设备")}
              </span>
            </div>
          </div>

          )}

          {/* 6. 资产总值 (右上角钱币图标集成临期提醒悬浮窗) */}
          {showAssetCard && (
            <div className={`mao-stat-card${renewalPopoverOpen ? " is-popover-open" : ""}`} data-metric="asset">
              <div className="mao-stat-head">
                <div className="mao-stat-title-wrap">
                  <StatMetricIcon metric="asset" icon={CircleDollarSign} />
                  <span className="mao-stat-label">{t("资产总值")}</span>
                </div>
                {showDetailButton && (
                  <RenewalReminder
                    nodes={renewalNodes}
                    warningDays={renewalReminderDays}
                    onOpenChange={setRenewalPopoverOpen}
                  >
                    <Link
                      to="/assets"
                      className="overview-card-action mao-stat-action"
                      aria-label={t("打开资产统计页")}
                      title={renewalCount > 0 ? t("{n} 台设备即将到期", { n: renewalCount }) : t("资产统计")}
                    >
                      <CircleDollarSign size={14} className={renewalCount > 0 ? "text-(--status-warning)" : ""} />
                    </Link>
                  </RenewalReminder>
                )}
              </div>
              <div className="mao-stat-value">
                {renderAssetValue()}
              </div>
              <div className="mao-stat-footer">
                <span className="mao-stat-caption">
                  {!isPriceVisible ? t("仅管理员可见") : t("实时汇率折算")}
                </span>
                {renderRating(assetRating)}
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* 右侧集群状态区域 */}
      <div className="mao-hero-side">
        <ServerGlobe nodes={visibleNodes} nameByUuid={nameByUuid} />
      </div>
    </section>
  );
}

function GroupTabs({
  groups,
  selectedGroup,
  onSelectGroup,
}: {
  groups: string[];
  selectedGroup: string;
  onSelectGroup: (group: string) => void;
}) {
  // 选中高亮滑过去，和详情页的时间段选择条一致。
  const { rootRef, animated, indicatorStyle } = useSlidingIndicator<HTMLDivElement>([
    groups,
    selectedGroup,
  ]);
  return (
    <div
      ref={rootRef}
      className="home-group-tabs has-indicator"
      role="group"
      aria-label={t("服务器分组")}
    >
      {indicatorStyle && (
        <span
          className={clsx("home-group-tabs-indicator", animated && "is-animated")}
          style={indicatorStyle}
          aria-hidden
        />
      )}
      <button
        type="button"
        aria-pressed={selectedGroup === HOME_ALL_GROUP}
        data-active={selectedGroup === HOME_ALL_GROUP ? "true" : "false"}
        onClick={() => onSelectGroup(HOME_ALL_GROUP)}
      >
        {t("全部")}
      </button>
      {groups.map((group) => (
        <button
          key={group}
          type="button"
          aria-pressed={selectedGroup === group}
          data-active={selectedGroup === group ? "true" : "false"}
          onClick={() => onSelectGroup(group)}
          title={group}
        >
          {group}
        </button>
      ))}
    </div>
  );
}

export function NodeGrid() {
  const now = useHourlyClock();
  const nodes = useHomeNodeSummaries();
  const nodeOnlineSummaries = useNodeOnlineSummaries();
  const allMeta = useAllNodeMeta();
  const { hydrated: storeHydrated, nodeInfoError } = useNodeStoreStatus();
  const { data: me } = useAuth();
  const { data: publicConfig } = usePublicConfig();
  const siteName = publicConfig?.sitename?.trim() || t("节点概览");
  const themeSettings = useThemeSettings();
  const { mode } = useViewMode();
  const sort = useHomeSort();
  // enableHomeSort 控制访客能否改排序;关闭时无视 session 覆盖、直接用管理员默认序(默认仍是 weight)。
  const sortEnabled = themeSettings.isReady && themeSettings.enableHomeSort;
  const sortField = sortEnabled ? sort.field : themeSettings.homeSortField;
  const sortDirection = sortEnabled ? sort.direction : themeSettings.homeSortDirection;
  const [selectedGroup, setSelectedGroup] = useState(HOME_ALL_GROUP);
  const [selectedRegion, setSelectedRegion] = useState(HOME_ALL_REGION);
  useHomepagePingOverview(mode);

  // 摘要不含名称，先从完整 meta 解析主题隐藏列表，再统一过滤各类数据。
  const hiddenUuids = useHiddenNodeUuids();
  const visibleNodes = useMemo(
    () =>
      nodes.filter(
        (node) => (me?.logged_in === true || !node.hidden) && !hiddenUuids.has(node.uuid),
      ),
    [me?.logged_in, nodes, hiddenUuids],
  );
  // 资产统计与卡片使用同一可见性规则，避免泄露隐藏节点信息。
  const visibleMeta = useMemo(
    () =>
      allMeta.filter(
        (node) => (me?.logged_in === true || !node.hidden) && !hiddenUuids.has(node.uuid),
      ),
    [allMeta, me?.logged_in, hiddenUuids],
  );
  const renewalNodes = useMemo<RenewalReminderSource[]>(() => {
    const onlineByUuid = new Map(
      nodeOnlineSummaries.map((node) => [node.uuid, node.online]),
    );
    return visibleMeta.map((node) => ({
      ...node,
      online: onlineByUuid.get(node.uuid) ?? null,
    }));
  }, [nodeOnlineSummaries, visibleMeta]);
  // 「名称」排序需要展示名(摘要无 name),从 meta 注入。
  const nameByUuid = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of visibleMeta) map.set(node.uuid, node.name?.trim() || node.uuid);
    return map;
  }, [visibleMeta]);
  const overview = useMemo<HomeOverview>(() => {
    let onlineNodes = 0;
    let offlineNodes = 0;
    let trafficUp = 0;
    let trafficDown = 0;
    let netUp = 0;
    let netDown = 0;
    let totalCpu = 0;
    let totalRamUsed = 0;
    let totalRamTotal = 0;
    let totalDiskUsed = 0;
    let totalDiskTotal = 0;
    let totalTcpConn = 0;
    let totalUdpConn = 0;

    for (const node of visibleNodes) {
      if (node.online === true) {
        onlineNodes += 1;
        totalCpu += node.cpuPct || 0;
        totalRamUsed += node.ramUsed || 0;
        totalDiskUsed += node.diskUsed || 0;
        totalTcpConn += node.tcpConn || 0;
        totalUdpConn += node.udpConn || 0;
      } else if (node.online === false) {
        offlineNodes += 1;
      }
      totalRamTotal += node.ramTotal || 0;
      totalDiskTotal += node.diskTotal || 0;
      trafficUp += node.trafficUp;
      trafficDown += node.trafficDown;
      netUp += node.netUp;
      netDown += node.netDown;
    }

    const avgCpu = onlineNodes > 0 ? totalCpu / onlineNodes : 0;
    const ramPct = totalRamTotal > 0 ? (totalRamUsed / totalRamTotal) * 100 : 0;
    const diskPct = totalDiskTotal > 0 ? (totalDiskUsed / totalDiskTotal) * 100 : 0;

    let maxUptimeSeconds = 0;
    let minUptimeSeconds = Number.POSITIVE_INFINITY;
    let recentRebootNode: { name: string; seconds: number } | null = null;

    for (const meta of visibleMeta) {
      const metrics = getNodeMetricsSnapshot(meta.uuid);
      if (metrics && metrics.online === true && Number.isFinite(metrics.uptime) && metrics.uptime > 0) {
        if (metrics.uptime > maxUptimeSeconds) {
          maxUptimeSeconds = metrics.uptime;
        }
        if (metrics.uptime < minUptimeSeconds) {
          minUptimeSeconds = metrics.uptime;
          recentRebootNode = {
            name: meta.name?.trim() || meta.uuid,
            seconds: metrics.uptime,
          };
        }
      }
    }

    return {
      totalNodes: visibleNodes.length,
      onlineNodes,
      offlineNodes,
      trafficUp,
      trafficDown,
      netUp,
      netDown,
      avgCpu,
      totalRamUsed,
      totalRamTotal,
      ramPct,
      totalDiskUsed,
      totalDiskTotal,
      diskPct,
      totalTcpConn,
      totalUdpConn,
      maxUptimeSeconds,
      recentRebootNode,
    };
  }, [visibleNodes, visibleMeta]);
  const showHomeOverview = themeSettings.isReady && themeSettings.showHomeOverview;
  const hasNodes = visibleMeta.length > 0;
  const loggedIn = Boolean(me?.logged_in);
  const canAccessAssets = loggedIn || themeSettings.showPriceForGuests;
  // 资产总值卡片：访客能不能看价格由 showPriceForGuests 管；整张卡还可以在设置里单独关掉（showAssetOverview）。
  const showAssetCard = showHomeOverview && hasNodes && themeSettings.showAssetOverview;
  const overviewMetricCards: OverviewMetricCards = {
    connections: themeSettings.showConnectionsOverview,
    cpu: themeSettings.showCpuOverview,
    ram: themeSettings.showRamOverview,
    disk: themeSettings.showDiskOverview,
    uptime: themeSettings.showUptimeOverview,
  };
  const showCostDetailButton =
    showAssetCard && themeSettings.isReady && themeSettings.showCostSummary && canAccessAssets;
  const showCostFloatingButton =
    themeSettings.isReady &&
    themeSettings.showCostSummaryFloatingButton &&
    hasNodes &&
    canAccessAssets &&
    !showCostDetailButton;

  useEffect(() => {
    if (!showCostDetailButton && !showCostFloatingButton) return;

    const idleWindow = window as IdleCapableWindow;
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(preloadAssetsPage, { timeout: 2_000 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    // Safari 等无 requestIdleCallback 的浏览器，在首页稳定后再低优先级预取。
    const handle = window.setTimeout(preloadAssetsPage, 1_000);
    return () => window.clearTimeout(handle);
  }, [showCostDetailButton, showCostFloatingButton]);

  // 资产入口存在时预热汇率，供概览、价格排序和资产页复用。
  const costNeeded = showAssetCard || showCostFloatingButton;
  const rateQuery = useQuery({
    queryKey: ["cost-rates", themeSettings.costRateApiUrl],
    queryFn: ({ signal }) => getExchangeRates(themeSettings.costRateApiUrl, { signal }),
    staleTime: 60 * 60 * 1000,
    // 「价格」排序也要汇率换算月化价,即便没显示资产卡也得拉一次;但空列表无需拉。
    enabled: (costNeeded || sortField === "price") && hasNodes,
    retry: 1,
  });
  const lang = useLang();
  const costSummary = useMemo(
    () =>
      rateQuery.data
        ? calculateCostSummary(
          visibleMeta,
          themeSettings.costIgnoredNodes,
          rateQuery.data.rates,
          themeSettings.costPremiums,
          now,
        )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 里面的文案按界面语言生成，切语言要重算
    [now, visibleMeta, themeSettings.costIgnoredNodes, themeSettings.costPremiums, rateQuery.data, lang],
  );
  // 「价格」排序键:月化价格(CNY);免费/忽略/汇率缺失的节点 null,排到默认序之后。
  const priceByUuid = useMemo(() => {
    const map = new Map<string, number | null>();
    if (costSummary) {
      for (const detail of costSummary.details) {
        map.set(detail.uuid, detail.counted ? detail.monthlyCny : null);
      }
    }
    return map;
  }, [costSummary]);
  const costLoading = costNeeded && rateQuery.isLoading;
  const groupOptions = useMemo(
    () =>
      sortHomeGroupOptions(
        getHomeGroupOptions(visibleNodes),
        themeSettings.isReady ? themeSettings.homeGroupOrder : [],
      ),
    [visibleNodes, themeSettings.homeGroupOrder, themeSettings.isReady],
  );
  // 站长设的默认分组只在首屏套一次：后面访客自己点了哪组就是哪组，配置回流不该把人拽回去。
  // 后端没有这个分组（改名 / 删了）时留在「全部」。
  const defaultGroupApplied = useRef(false);
  useEffect(() => {
    if (defaultGroupApplied.current) return;
    if (!themeSettings.isReady || groupOptions.length === 0) return;
    defaultGroupApplied.current = true;
    const preset = themeSettings.homeDefaultGroup;
    if (preset && groupOptions.includes(preset)) setSelectedGroup(preset);
  }, [groupOptions, themeSettings.homeDefaultGroup, themeSettings.isReady]);

  // 列表按延后的分组重排：点分组时标签的滑动高亮先动起来，几十张卡片的重排随后再做，不卡住那一下。
  const deferredGroup = useDeferredValue(selectedGroup);
  const groupFilteredNodes = useMemo(
    () =>
      deferredGroup === HOME_ALL_GROUP
        ? visibleNodes
        : visibleNodes.filter((node) => getHomeGroupLabel(node.group) === deferredGroup),
    [visibleNodes, deferredGroup],
  );
  // 地区选项在分组筛选之后统计,让国旗计数反映当前分组内的分布。
  const homeRegionOrder = themeSettings.isReady ? themeSettings.homeRegionOrder : EMPTY_REGION_ORDER;
  const regionOptions = useMemo(
    () => getHomeRegionOptions(groupFilteredNodes, homeRegionOrder),
    [groupFilteredNodes, homeRegionOrder],
  );
  // 地区栏上拖完的顺序直接写本机设置：访客只影响自己；登录站长跟别的设置一样自动同步到后端。
  // 当前分组只显示一部分地区，要并回完整顺序，别的分组里排好的不能丢（见 mergeHomeRegionOrder）。
  const handleRegionReorder = useCallback(
    (visibleAfter: string[]) => {
      saveLocalThemeSettings({
        ...getLocalThemeSettings(),
        homeRegionOrder: mergeHomeRegionOrder(
          homeRegionOrder,
          regionOptions.map((option) => option.code),
          visibleAfter,
        ),
      });
    },
    [homeRegionOrder, regionOptions],
  );
  const filteredNodes = useMemo(
    () =>
      selectedRegion === HOME_ALL_REGION
        ? groupFilteredNodes
        : groupFilteredNodes.filter((node) => getDisplayRegionCode(node.region) === selectedRegion),
    [groupFilteredNodes, selectedRegion],
  );
  // 排序在分组筛选之后。离线永远沉底(写死,见 homeSort);实时网速走防抖(键平滑+滞回+5s 重排)。
  const orderedNodes = useHomeNodeOrder({
    offlineFirst: themeSettings.isReady && themeSettings.offlineNodesFirst,
    nodes: filteredNodes,
    field: sortField,
    direction: sortDirection,
    nameByUuid,
    priceByUuid,
  });

  useEffect(() => {
    if (selectedGroup !== HOME_ALL_GROUP && !groupOptions.includes(selectedGroup)) {
      setSelectedGroup(HOME_ALL_GROUP);
    }
  }, [groupOptions, selectedGroup]);

  // 选中的地区在当前分组里不存在了(切换分组/节点变化)就回到全部。
  useEffect(() => {
    if (
      selectedRegion !== HOME_ALL_REGION &&
      !regionOptions.some((option) => option.code === selectedRegion)
    ) {
      setSelectedRegion(HOME_ALL_REGION);
    }
  }, [regionOptions, selectedRegion]);

  // 地区栏被配置关闭(热更新)时,清掉可能残留的地区筛选,否则会留下一个不可见的过滤条件。
  useEffect(() => {
    if (!themeSettings.showRegionBar && selectedRegion !== HOME_ALL_REGION) {
      setSelectedRegion(HOME_ALL_REGION);
    }
  }, [themeSettings.showRegionBar, selectedRegion]);

  useEffect(() => {
    if (!themeSettings.showGroupTabs && selectedGroup !== HOME_ALL_GROUP) {
      setSelectedGroup(HOME_ALL_GROUP);
    }
  }, [themeSettings.showGroupTabs, selectedGroup]);

  // 卡片列表只随 UUID 集合/顺序变化；卡片内部各自订阅实时数据。
  const uuidsKey = useMemo(
    () => orderedNodes.map((node) => node.uuid).join(UUID_KEY_SEPARATOR),
    [orderedNodes],
  );
  const orderedUuids = useMemo(
    () => (uuidsKey ? uuidsKey.split(UUID_KEY_SEPARATOR) : []),
    [uuidsKey],
  );
  // 列表档由下方 NodeListView 渲染,这里不必构造卡片元素。
  const cards = useMemo(
    () =>
      mode === "list"
        ? null
        : orderedUuids.map((uuid) => (
          <div key={uuid} className="min-w-0">
            {mode === "mini" ? (
              <MiniNodeCard uuid={uuid} />
            ) : mode === "compact" ? (
              <CompactNodeCard uuid={uuid} />
            ) : (
              <NodeCard uuid={uuid} />
            )}
          </div>
        )),
    [orderedUuids, mode],
  );
  const showGroupTabs =
    themeSettings.isReady && themeSettings.showGroupTabs && groupOptions.length > 0;
  const showHomeSort = sortEnabled && visibleNodes.length > 1;
  // 地区栏:只有一个地区时筛选无意义,>1 才显示。
  const showRegionBar =
    themeSettings.isReady && themeSettings.showRegionBar && regionOptions.length > 1;
  // 分组标签栏与卡片网格共用列定义，让标签栏左缘对齐首卡。
  const isMini = mode === "mini";
  const isList = mode === "list";
  const { className: gridClassName, minColumnWidth } = GRID_LAYOUT[mode];
  const gridWrapClassName = isMini ? `${gridClassName} node-grid-mini` : gridClassName;
  const gridStyle = isList
    ? undefined
    : isMini
      ? ({ "--mini-card-min-width": `${minColumnWidth}px` } as MiniGridStyle)
      : { gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minColumnWidth}px), 1fr))` };
  const gridElement = (
    <div className={gridWrapClassName} style={gridStyle}>
      {cards}
    </div>
  );
  // 迷你与列表档的控件栏借用小卡列宽，避免跟随密集内容列而被压窄。
  const borrowControlsGrid = isMini || isList;
  // 排序控件在这条栏里（没开顶部总览时）就占最后一列，分组标签只占到它前面；否则标签可占满整行。
  const sortInControlsBar = !showHomeOverview && showHomeSort;
  const controlsWrapClassName = clsx(
    borrowControlsGrid ? "grid gap-3" : gridWrapClassName,
    "home-controls-bar mb-4",
    sortInControlsBar && "has-sort",
  );
  const controlsStyle = borrowControlsGrid
    ? {
      gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${GRID_LAYOUT.compact.minColumnWidth}px), 1fr))`,
    }
    : gridStyle;

  if (!themeSettings.isReady || !storeHydrated) {
    if (!nodeInfoError) return null;
    return (
      <div
        className="flex h-[40vh] flex-col items-center justify-center gap-2 text-(--text-tertiary)"
        aria-live="polite"
      >
        <span className="text-[14px]">{t("节点数据暂时无法加载")}</span>
        <span className="text-[12px]">{t("正在等待后端自动重试")}</span>
      </div>
    );
  }

  // 资产页悬浮入口 + 首页概览卡在「空节点」与正常两个分支里完全一致，提取一次复用。
  const homeHeader = (
    <>
      {showCostFloatingButton && <DraggableCostBall />}
      <HomeBrand siteName={siteName} />
      {showHomeOverview && (
        <HomeOverviewCards
          overview={overview}
          dense={mode === "mini" || mode === "list"}
          showDetailButton={showCostDetailButton}
          showAssetCard={showAssetCard}
          metricCards={overviewMetricCards}
          renewalReminderDays={
            themeSettings.isReady ? themeSettings.renewalReminderDays : 0
          }
          renewalNodes={renewalNodes}
          costSummary={costSummary}
          costLoading={costLoading}
          showOverviewRatings={themeSettings.showOverviewRatings}
          showBandwidthRating={themeSettings.showBandwidthRating}
          bandwidthRatingLabels={themeSettings.bandwidthRatingLabels}
          showAssetRating={themeSettings.showAssetRating}
          assetRatingLabels={themeSettings.assetRatingLabels}
          username={
            me?.logged_in
              ? (themeSettings.adminNickname?.trim() || me?.username || "Admin")
              : "Guest"
          }
          loggedIn={Boolean(me?.logged_in)}
          visibleNodes={visibleNodes}
          nameByUuid={nameByUuid}
          clusterOverviewMode={themeSettings.clusterOverviewMode}
          matrixColorTheme={themeSettings.matrixColorTheme}
          matrixMockFill={themeSettings.matrixMockFill}
          matrixBootAnimation={themeSettings.matrixBootAnimation}
          matrixBootEffect={themeSettings.matrixBootEffect}
          matrixCustomPattern={themeSettings.matrixCustomPattern}
        />
      )}
    </>
  );

  if (visibleNodes.length === 0) {
    return (
      <>
        {homeHeader}
        <div className="flex h-[40vh] flex-col items-center justify-center gap-2 text-(--text-tertiary)">
          <span className="text-[15px]">{t("尚未连接到任何节点")}</span>
          <span className="text-[12px]">{t("等待后端推送或前往管理后台添加")}</span>
        </div>
      </>
    );
  }

  return (
    <>
      {homeHeader}
      <section
        className="mao-cluster-card"
        aria-label={t("服务器集群与监控列表")}
        data-palette={themeSettings.matrixColorTheme || "default"}
      >
        {showHomeOverview && (
          <div className="mao-section-header">
            <div className="mao-section-top-row">
              <div className="mao-badge">
                <Server size={12} className="text-(--text-primary)" />
                <span>{t("服务器集群")}</span>
              </div>
              {showHomeSort && (
                <div className="mao-section-header-actions">
                  <HomeSortControl state={sort} />
                </div>
              )}
            </div>
            <div className="mao-section-title-wrap">
              <h2 className="mao-section-title">{t("服务器矩阵与实时监控")}</h2>
              <p className="mao-section-sub">
                {t("实时监控服务器负载、资源占用、网络吞吐与在线状态。")}
              </p>
            </div>
          </div>
        )}
        {(sortInControlsBar || showGroupTabs) && (
          <div className={controlsWrapClassName} style={controlsStyle}>
            {showGroupTabs && (
              <GroupTabs
                groups={groupOptions}
                selectedGroup={selectedGroup}
                onSelectGroup={setSelectedGroup}
              />
            )}
            {sortInControlsBar && <HomeSortControl state={sort} />}
          </div>
        )}
        {showRegionBar && (
          <RegionTabs
            regions={regionOptions}
            selectedRegion={selectedRegion}
            onSelectRegion={setSelectedRegion}
            onReorder={handleRegionReorder}
          />
        )}
        {isList ? (
          <NodeListView uuids={orderedUuids} />
        ) : (
          gridElement
        )}
      </section>
    </>
  );
}
