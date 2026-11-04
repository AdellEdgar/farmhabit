import { cx } from '../../lib/cx';

/** Bocadillo con lo que dice una criatura. */
export function SpeechBubble({ text, className }: { text: string; className?: string }) {
  return (
    <p
      className={cx(
        'speech-bubble relative rounded-xl bg-elevado px-3 py-1.5 text-xs leading-snug',
        className,
      )}
    >
      {text}
    </p>
  );
}
