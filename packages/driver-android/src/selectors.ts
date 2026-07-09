/**
 * Unified selector → UIA2 strategy mapping (spec §3.4, FR-030/031).
 *
 * testId maps to BOTH resource-id and content-desc (React Native puts testID
 * in different places depending on version/config), so it expands to two
 * queries whose results core-side dedupe merges.
 */
import type { SemanticRole, UnifiedSelector } from '@projectcrossplay/core';
import type { UIA2Strategy } from './bridge.js';

export interface UIA2Query {
  strategy: UIA2Strategy;
  selector: string;
}

/** Android widget classes with the same interaction semantics as the unified role. */
const ROLE_CLASS: Record<SemanticRole, string> = {
  button: 'android.widget.Button',
  textbox: 'android.widget.EditText',
  checkbox: 'android.widget.CheckBox',
  switch: 'android.widget.Switch',
  link: 'android.widget.TextView', // Android has no link widget; clickable TextView is the convention
  image: 'android.widget.ImageView',
  heading: 'android.widget.TextView', // no heading semantics; pair with { name } in practice
  listitem: 'android.view.ViewGroup', // RecyclerView rows; prefer testId for rows
};

/** UiSelector string literals need Java-style escaping. */
function uiString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function toQueries(selector: UnifiedSelector): UIA2Query[] {
  switch (selector.kind) {
    case 'testId':
      return [
        // resource-id: UiSelector resourceIdMatches tolerates unqualified ids
        // (RN and plain Android apps qualify differently).
        {
          strategy: '-android uiautomator',
          selector: `new UiSelector().resourceIdMatches(".*:id/${escapeRegex(selector.value)}|${escapeRegex(selector.value)}")`,
        },
        { strategy: 'accessibility id', selector: selector.value },
      ];
    case 'text':
      return [
        {
          strategy: '-android uiautomator',
          selector:
            selector.exact === false
              ? `new UiSelector().textContains(${uiString(selector.value)})`
              : `new UiSelector().text(${uiString(selector.value)})`,
        },
      ];
    case 'role': {
      const cls = ROLE_CLASS[selector.role];
      if (selector.name === undefined) {
        return [{ strategy: 'class name', selector: cls }];
      }
      return [
        {
          strategy: '-android uiautomator',
          selector: `new UiSelector().className(${uiString(cls)}).text(${uiString(selector.name)})`,
        },
      ];
    }
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
