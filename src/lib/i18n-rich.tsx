import { Fragment, type ReactNode } from "react";
import { t, type MessageKey } from "./i18n";

/**
 * A message with markup inside it: "agree to the <terms>terms</terms>".
 * Each tag name maps to a function that wraps its text, so a translation can
 * put the link wherever its grammar needs it. Tags are flat (no nesting) and
 * anything that isn't a known tag is left as text - a translator's typo
 * shows up as visible angle brackets, never as broken markup.
 */
export function rich(key: MessageKey, tags: Record<string, (text: string) => ReactNode>, vars: Record<string, string | number> = {}): ReactNode {
  const text = t(key, vars);
  const out: ReactNode[] = [];
  const re = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text))) {
    const wrap = tags[match[1]];
    if (!wrap) continue;
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push(<Fragment key={i++}>{wrap(match[2])}</Fragment>);
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
