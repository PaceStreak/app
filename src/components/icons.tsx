import {
  Barbell,
  Boat,
  Lightning,
  Mountains,
  PersonSimpleBike,
  PersonSimpleHike,
  PersonSimpleRun,
  PersonSimpleSwim,
  PersonSimpleTaiChi,
  SoccerBall,
  Sparkle,
  type Icon,
  type IconProps,
} from "@phosphor-icons/react";

// One icon per discipline. The library's emoji field exists for plain-text
// surfaces (email, notifications); in the UI we draw real icons.
const DISCIPLINE_ICONS: Record<string, Icon> = {
  strength: Barbell,
  run: PersonSimpleRun,
  ride: PersonSimpleBike,
  swim: PersonSimpleSwim,
  walk: PersonSimpleHike,
  climb: Mountains,
  row: Boat,
  hiit: Lightning,
  yoga: PersonSimpleTaiChi,
  sport: SoccerBall,
  other: Sparkle,
};

export function DisciplineIcon({ id, ...props }: { id: string } & IconProps) {
  const Glyph = DISCIPLINE_ICONS[id] ?? Sparkle;
  return <Glyph aria-hidden {...props} />;
}
