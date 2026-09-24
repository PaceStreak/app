import type { IconProps } from "@phosphor-icons/react";
import { Smiley, SmileyBlank, SmileyMeh, SmileySad, SmileyWink } from "../../components/phosphor";

export function FeelIcon({ value, ...props }: { value: number } & IconProps) {
  const Glyph = [SmileySad, SmileyMeh, SmileyBlank, Smiley, SmileyWink][Math.max(0, Math.min(4, value - 1))];
  return <Glyph aria-hidden {...props} />;
}
