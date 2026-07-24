export type Q54PromptPresentation = {
  passage: string;
  questions: string[];
};

export function parseQ54PromptPresentation(
  prompt: string,
): Q54PromptPresentation {
  const markers = Array.from(prompt.matchAll(/([1-3])\)\s*/gu)).filter(
    (match) => {
      const index = match.index;
      return index === 0 || /\s/u.test(prompt[index - 1] ?? "");
    },
  );
  const hasCompleteSequence =
    markers.length === 3 &&
    markers.every((marker, index) => marker[1] === String(index + 1));

  if (!hasCompleteSequence) {
    return {
      passage: prompt,
      questions: [],
    };
  }

  const firstMarker = markers[0];
  if (firstMarker.index === undefined) {
    return {
      passage: prompt,
      questions: [],
    };
  }

  return {
    passage: prompt.slice(0, firstMarker.index).trimEnd(),
    questions: markers.map((marker, index) => {
      const start = (marker.index ?? 0) + marker[0].length;
      const end = markers[index + 1]?.index ?? prompt.length;
      return prompt.slice(start, end).trim();
    }),
  };
}
