/**
 * FlowInsetGroup — timeline card shell driven by ThemeChrome (layout + border + motion).
 */

import type { ReactNode } from 'react';
import { useThemeChrome, useThemeMotionFrame, useThemeVersion, useTuiTheme } from '../../theme';
import {
  formatThemeSectionLabel,
  resolveCardShellChrome,
  resolveKnowledgeInsetChrome,
  resolveSectionLabelColor,
} from '../../themes/theme-profile';

interface FlowInsetGroupProps {
  children: ReactNode;
  /** Latest card in timeline — keeps left-rail highlight when idle. */
  focused?: boolean;
  /** Timeline-owned motion clock; keeps card chrome in sync with status text. */
  motionFrame?: number;
}

export function FlowInsetGroup({
  children,
  focused = false,
  motionFrame = 0,
}: FlowInsetGroupProps): ReactNode {
  useThemeVersion();
  const tuiTheme = useTuiTheme();
  const chrome = useThemeChrome();
  const shell = resolveCardShellChrome(
    chrome,
    { focused },
    tuiTheme.modes.timeline.cardFills,
    motionFrame,
  );

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
      {children}
    </box>
  );
}

interface FlowFramedSectionProps {
  label: string;
  labelSuffix?: string;
  children: ReactNode;
  gap?: boolean;
  variant?: 'knowledge' | 'neutral';
  motionFrame?: number;
}

export function FlowFramedSection({
  label,
  labelSuffix,
  children,
  gap = true,
  variant = 'neutral',
  motionFrame,
}: FlowFramedSectionProps): ReactNode {
  const tuiTheme = useTuiTheme();
  const chrome = useThemeChrome();
  const isKnowledge = variant === 'knowledge';
  const kind = isKnowledge ? 'knowledge' : 'summary';
  const localMotionFrame = useThemeMotionFrame(motionFrame === undefined && Boolean(
    isKnowledge
      ? chrome.sectionKnowledgeFrames?.length
        || chrome.sectionKnowledgeColorFrames?.length
        || chrome.knowledgeBorderColorFrames?.length
      : chrome.sectionSummaryFrames?.length
        || chrome.sectionSummaryColorFrames?.length,
  ));
  const sectionMotionFrame = motionFrame ?? localMotionFrame;
  const header = formatThemeSectionLabel(chrome, kind, label, undefined, sectionMotionFrame);
  const labelFg = resolveSectionLabelColor(
    chrome,
    kind,
    isKnowledge ? tuiTheme.modes.wiki.labelFg : tuiTheme.modes.timeline.summary.labelFallbackFg,
    sectionMotionFrame,
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
    sectionMotionFrame,
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
