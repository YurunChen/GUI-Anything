/**
 * FlowInsetGroup — timeline card shell driven by ThemeChrome (layout + border + motion).
 */

import type { ReactNode } from 'react';
import { useThemeChrome, useThemeMotionFrame, useThemeVersion, useTuiTheme } from '../../theme';
import {
  formatThemeSectionLabel,
  resolveCardShellChrome,
  resolveChromeFrame,
  resolveKnowledgeInsetChrome,
  resolveSectionLabelColor,
} from '../../themes/theme-profile';

interface FlowInsetGroupProps {
  children: ReactNode;
  /** Left accent for running exploration */
  accent?: boolean;
  /** One-shot left accent for a newly observed exploration. */
  fresh?: boolean;
  /** Latest card in timeline — keeps left-rail highlight when idle. */
  focused?: boolean;
}

export function FlowInsetGroup({
  children,
  accent = false,
  fresh = false,
  focused = false,
}: FlowInsetGroupProps): ReactNode {
  useThemeVersion();
  const tuiTheme = useTuiTheme();
  const chrome = useThemeChrome();
  const motionFrame = useThemeMotionFrame(accent || fresh);
  const shell = resolveCardShellChrome(
    chrome,
    { accent, fresh, focused },
    tuiTheme.modes.timeline.cardFills,
    motionFrame,
  );
  const leadGlyph = shell.showLeadColumn
    ? (accent
      ? resolveChromeFrame(chrome.runningLeadFrames, '▌', motionFrame)
      : resolveChromeFrame(chrome.freshAccentFrames, '▌', motionFrame))
    : '';

  const body = <>{children}</>;

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'column',
        marginBottom: shell.gap,
        paddingLeft: shell.padX,
        paddingRight: shell.padX,
        paddingTop: shell.padY,
        paddingBottom: shell.padY,
        backgroundColor: shell.backgroundColor,
        border: shell.border === false ? undefined : shell.border,
        borderColor: shell.borderColor,
        borderStyle: shell.border === false ? undefined : shell.borderStyle,
      }}
    >
      {leadGlyph ? (
        <box style={{ width: '100%', flexDirection: 'row' }}>
          <text fg={shell.borderColor} wrapMode="none">{leadGlyph}</text>
          <box style={{ flexDirection: 'column', width: '100%' }}>{body}</box>
        </box>
      ) : body}
    </box>
  );
}

interface FlowSectionProps {
  label: string;
  labelSuffix?: string;
  children: ReactNode;
  gap?: boolean;
}

export function FlowSection({ label, labelSuffix, children, gap = true }: FlowSectionProps): ReactNode {
  const tuiTheme = useTuiTheme();
  const chrome = useThemeChrome();
  const motionFrame = useThemeMotionFrame(Boolean(
    chrome.sectionSummaryFrames?.length || chrome.sectionSummaryColorFrames?.length,
  ));
  const header = formatThemeSectionLabel(chrome, 'summary', label, labelSuffix, motionFrame);
  const labelFg = resolveSectionLabelColor(
    chrome,
    'summary',
    tuiTheme.modes.timeline.summary.labelFallbackFg,
    motionFrame,
  );
  return (
    <>
      {gap && <FlowLineGap />}
      <text fg={labelFg}>{header}</text>
      {children}
    </>
  );
}

interface FlowFramedSectionProps {
  label: string;
  labelSuffix?: string;
  children: ReactNode;
  gap?: boolean;
  variant?: 'knowledge' | 'neutral';
}

export function FlowFramedSection({
  label,
  labelSuffix,
  children,
  gap = true,
  variant = 'neutral',
}: FlowFramedSectionProps): ReactNode {
  const tuiTheme = useTuiTheme();
  const chrome = useThemeChrome();
  const isKnowledge = variant === 'knowledge';
  const kind = isKnowledge ? 'knowledge' : 'summary';
  const motionFrame = useThemeMotionFrame(Boolean(
    isKnowledge
      ? chrome.sectionKnowledgeFrames?.length
        || chrome.sectionKnowledgeColorFrames?.length
        || chrome.knowledgeBorderColorFrames?.length
      : chrome.sectionSummaryFrames?.length
        || chrome.sectionSummaryColorFrames?.length,
  ));
  const header = formatThemeSectionLabel(chrome, kind, label, undefined, motionFrame);
  const labelFg = resolveSectionLabelColor(
    chrome,
    kind,
    isKnowledge ? tuiTheme.modes.wiki.labelFg : tuiTheme.modes.timeline.summary.labelFallbackFg,
    motionFrame,
  );
  const suffixFg = isKnowledge
    ? tuiTheme.semantic.label.secondary
    : tuiTheme.semantic.label.tertiary;
  const inset = resolveKnowledgeInsetChrome(
    chrome,
    variant,
    {
      wikiBackground: tuiTheme.modes.wiki.panel.backgroundColor,
      elevated: tuiTheme.semantic.fill.elevated,
      separator: tuiTheme.semantic.separator,
    },
    motionFrame,
  );

  if (chrome.cardKnowledgeInset === 'flat' && inset.border === false) {
    return (
      <>
        {gap && <FlowLineGap />}
        <FlowSectionHeader
          header={header}
          labelFg={labelFg}
          suffix={labelSuffix}
          suffixFg={suffixFg}
        />
        {children}
      </>
    );
  }

  if (inset.border === false) {
    return (
      <>
        {gap && <FlowLineGap />}
        <box
          style={{
            width: '100%',
            flexDirection: 'column',
            paddingLeft: inset.padX,
            paddingRight: inset.padX,
            paddingTop: inset.padY,
            paddingBottom: inset.padY > 0 ? 1 : 0,
            backgroundColor: inset.backgroundColor,
          }}
        >
          <FlowSectionHeader
            header={header}
            labelFg={labelFg}
            suffix={labelSuffix}
            suffixFg={suffixFg}
          />
          <FlowLineGap />
          {children}
        </box>
      </>
    );
  }

  return (
    <>
      {gap && <FlowLineGap />}
      <box
        style={{
          width: '100%',
          flexDirection: 'column',
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
          border: inset.border,
          borderColor: inset.borderColor,
          borderStyle: inset.borderStyle,
        }}
      >
        <box
          style={{
            width: '100%',
            flexDirection: 'column',
            paddingLeft: inset.padX,
            paddingRight: inset.padX,
            paddingTop: inset.padY,
            paddingBottom: inset.padY > 0 ? 1 : 0,
            backgroundColor: inset.backgroundColor,
          }}
        >
          <FlowSectionHeader
            header={header}
            labelFg={labelFg}
            suffix={labelSuffix}
            suffixFg={suffixFg}
          />
          <FlowLineGap />
          {children}
        </box>
      </box>
    </>
  );
}

interface FlowSectionHeaderProps {
  header: string;
  labelFg: string;
  suffix?: string;
  suffixFg: string;
}

function FlowSectionHeader({
  header,
  labelFg,
  suffix,
  suffixFg,
}: FlowSectionHeaderProps): ReactNode {
  return (
    <text wrapMode="none">
      <span fg={labelFg}>{header}</span>
      {suffix ? <span fg={suffixFg}>{`  ${suffix}`}</span> : null}
    </text>
  );
}

export function FlowLineGap(): ReactNode {
  return <text>{' '}</text>;
}
